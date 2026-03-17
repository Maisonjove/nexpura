import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Stripe Product IDs for LIVE mode
const STRIPE_PRICES: Record<string, string> = {
  // These are Price IDs, not Product IDs
  // Joey needs to create prices for each product, or we use the product ID with default price
  boutique: process.env.STRIPE_PRICE_BOUTIQUE || "price_boutique_placeholder",
  studio: process.env.STRIPE_PRICE_STUDIO || "price_studio_placeholder",
  atelier: process.env.STRIPE_PRICE_ATELIER || "price_atelier_placeholder",
};

// Product IDs (for reference)
// Boutique $89/month AUD - prod_UAJ5YPkVeuRXpw
// Studio $179/month AUD - prod_UAJ5ggVHq4ChKY
// Atelier $299/month AUD - prod_UAJ5cAOEp1PLvb

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, subdomain, email, fullName } = body;

    if (!plan || !subdomain || !email) {
      return NextResponse.json(
        { error: "Missing required fields: plan, subdomain, email" },
        { status: 400 }
      );
    }

    // Validate plan
    if (!["boutique", "studio", "atelier"].includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be boutique, studio, or atelier" },
        { status: 400 }
      );
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json(
        { error: "Invalid subdomain format" },
        { status: 400 }
      );
    }

    const priceId = STRIPE_PRICES[plan];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com";

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Store metadata for webhook processing
      metadata: {
        subdomain,
        plan,
        full_name: fullName || "",
      },
      customer_email: email,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          subdomain,
          plan,
        },
      },
      success_url: `${baseUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/signup?cancelled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
