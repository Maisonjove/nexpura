import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { STRIPE_PRICES, type PlanKey, type IntervalKey } from "@/lib/stripe/prices";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

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

    const body = await request.json() as { plan: PlanKey; interval: IntervalKey };
    const { plan, interval } = body;

    if (!plan || !interval) {
      return NextResponse.json(
        { error: "Missing plan or interval" },
        { status: 400 }
      );
    }

    // Get user's tenant and subscription
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, email, full_name")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", userData.tenant_id)
      .single();

    // Get or create Stripe customer
    let stripeCustomerId = subscription?.stripe_customer_id as string | null;

    if (!stripeCustomerId) {
      const customer = await getStripe().customers.create({
        email: userData.email ?? user.email ?? undefined,
        name: userData.full_name ?? undefined,
        metadata: {
          tenant_id: userData.tenant_id,
          user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Save stripe_customer_id
      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("tenant_id", userData.tenant_id);
    }

    const priceId = STRIPE_PRICES[plan][interval];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get("host")}`;

    // Determine if trial applies
    const hasTrialed =
      subscription?.status !== "trialing" &&
      subscription?.trial_ends_at !== null;

    const session = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: hasTrialed ? undefined : 14,
        metadata: {
          tenant_id: userData.tenant_id,
          user_id: user.id,
        },
      },
      metadata: {
        tenant_id: userData.tenant_id,
        user_id: user.id,
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
