import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import { PLANS, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/data/pricing";

// Multi-currency Stripe Checkout Session creation per Joey 2026-04-26.
// Price IDs are read from src/data/pricing.ts (the single marketing source
// of truth) keyed by (plan, currency). Trial is 14 days and Stripe collects
// the card up-front under mode=subscription, so the customer is auto-charged
// the moment the trial ends — no user re-engagement required.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type RequestBody = {
  plan?: string;
  currency?: string;
  subdomain?: string;
  email?: string;
  fullName?: string;
};

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const { success: rlSuccess } = await checkRateLimit(`stripe-checkout:${ip}`);
    if (!rlSuccess) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = (await request.json()) as RequestBody;
    const { plan, currency, subdomain, email, fullName } = body;

    if (!plan || !subdomain || !email) {
      return NextResponse.json(
        { error: "Missing required fields: plan, subdomain, email" },
        { status: 400 }
      );
    }

    if (!PLANS.some((p) => p.id === plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be boutique, studio, or atelier" },
        { status: 400 }
      );
    }

    // Default to USD when no/unknown currency arrives — matches the
    // marketing-side fallback in src/data/pricing.ts countryToCurrency().
    const resolvedCurrency: CurrencyCode = SUPPORTED_CURRENCIES.includes(
      currency as CurrencyCode
    )
      ? (currency as CurrencyCode)
      : "USD";

    // When the deployment is running with a Stripe TEST key (preview /
    // sandbox), live price IDs from src/data/pricing.ts will fail with
    // "no such price". Read test-mode price IDs from env vars instead so
    // the same code can run on preview (sk_test) and prod (sk_live).
    const isTestMode = (process.env.STRIPE_SECRET_KEY ?? "").startsWith(
      "sk_test_"
    );
    let priceId: string | undefined;
    if (isTestMode) {
      const envKey = `STRIPE_PRICE_TEST_${plan.toUpperCase()}_${resolvedCurrency}`;
      priceId = process.env[envKey];
    } else {
      const planRow = PLANS.find((p) => p.id === plan)!;
      priceId = planRow.pricing[resolvedCurrency].stripePriceId;
    }
    if (!priceId) {
      logger.error(
        `[stripe-checkout] missing price for ${plan}/${resolvedCurrency} (testMode=${isTestMode})`
      );
      return NextResponse.json(
        { error: "Pricing not configured for that region. Please contact support." },
        { status: 500 }
      );
    }

    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json(
        { error: "Invalid subdomain format" },
        { status: 400 }
      );
    }

    // Reject if the subdomain already exists. Pre-fix this was a public
    // unauthenticated POST that created Stripe checkout for ANY
    // subdomain string passing the regex. The webhook's `existingTenant`
    // branch then silently rewrote the existing tenant's
    // stripe_customer_id / stripe_subscription_id → billing-hijack of an
    // already-running tenant by anyone who knew the subdomain.
    const admin = createAdminClient();
    const { data: existingTenant } = await admin
      .from("tenants")
      .select("id")
      .eq("subdomain", subdomain)
      .maybeSingle();
    if (existingTenant) {
      return NextResponse.json(
        { error: "That subdomain is already taken. Please choose another." },
        { status: 409 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com";

    // mode=subscription with trial_period_days collects the card up-front
    // and Stripe auto-charges on the day after the trial ends. No
    // payment_method_collection override needed — that's the default for
    // priced subscriptions.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      automatic_tax: { enabled: true },
      customer_email: email,
      metadata: {
        subdomain,
        plan,
        currency: resolvedCurrency,
        full_name: fullName || "",
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          subdomain,
          plan,
          currency: resolvedCurrency,
        },
      },
      success_url: `${baseUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/signup?cancelled=true&plan=${plan}&currency=${resolvedCurrency}`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("Stripe checkout error:", error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
