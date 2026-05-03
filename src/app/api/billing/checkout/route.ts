import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { PLANS, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/data/pricing";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/billing/checkout
 *
 * Owner-initiated plan change for an EXISTING tenant. Distinct from
 * /api/stripe/create-checkout-session which handles new-signup flow.
 *
 * Phase 1.5 post-audit (Joey 2026-05-03): migrated off the deleted
 * src/lib/stripe/prices.ts (which used STRIPE_PRICE_*_MONTHLY env
 * vars pointing at OLD price IDs e.g. price_1TDvgp...). Now reads
 * the canonical PLANS table from src/data/pricing.ts and looks up
 * the price ID by tenant.currency. Annual paths dropped — the
 * `interval` parameter is no longer required (monthly only).
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { plan?: string };
    const plan = body.plan;

    if (!plan || !PLANS.some((p) => p.id === plan)) {
      return NextResponse.json(
        { error: "Invalid or missing plan. Must be boutique, studio, or atelier." },
        { status: 400 }
      );
    }

    // RBAC: creating a Stripe checkout for a plan upgrade affects the
    // tenant's billing — owner only. Pre-fix any session-authed staff
    // could redirect the tenant to a paid Stripe checkout for a
    // different plan. Verified Group 15 audit (PR #114).
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, email, full_name, role")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (userData.role !== "owner") {
      return NextResponse.json(
        { error: "Only the tenant owner can change the subscription plan." },
        { status: 403 },
      );
    }

    // Resolve tenant's currency for the price-ID lookup. tenants.currency
    // is set at signup time per locale; defaults to AUD if missing.
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("currency")
      .eq("id", userData.tenant_id)
      .single();
    const tenantCurrency: CurrencyCode =
      SUPPORTED_CURRENCIES.includes((tenantRow?.currency ?? "").toUpperCase() as CurrencyCode)
        ? (tenantRow!.currency!.toUpperCase() as CurrencyCode)
        : "AUD";

    const planRow = PLANS.find((p) => p.id === plan)!;
    const priceId = planRow.pricing[tenantCurrency]?.stripePriceId;
    if (!priceId) {
      logger.error(
        `[billing/checkout] no priceId for ${plan}/${tenantCurrency} on tenant ${userData.tenant_id}`,
      );
      return NextResponse.json(
        { error: "Pricing not configured for that region. Please contact support." },
        { status: 500 },
      );
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", userData.tenant_id)
      .single();

    // Get or create Stripe customer
    let stripeCustomerId = subscription?.stripe_customer_id as string | null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userData.email ?? user.email ?? undefined,
        name: userData.full_name ?? undefined,
        metadata: {
          tenant_id: userData.tenant_id,
          user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Save stripe_customer_id
      const { error: subUpdateErr } = await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("tenant_id", userData.tenant_id);
      if (subUpdateErr) {
        logger.error(
          "[billing/checkout] failed to persist stripe_customer_id",
          subUpdateErr,
        );
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get("host")}`;

    // Determine if trial applies
    const hasTrialed =
      subscription?.status !== "trialing" &&
      subscription?.trial_ends_at !== null;

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: hasTrialed ? undefined : 14,
        metadata: {
          tenant_id: userData.tenant_id,
          user_id: user.id,
          plan,
          currency: tenantCurrency,
        },
      },
      metadata: {
        tenant_id: userData.tenant_id,
        user_id: user.id,
        plan,
        currency: tenantCurrency,
      },
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("Checkout error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
