import { NextRequest, NextResponse } from "next/server";
import debug from "@/lib/debug";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSystemEmail } from "@/lib/email-sender";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

// Lazy initialization to avoid build-time errors when env vars are not available
function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("[stripe/route] STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(stripeSecretKey);
}

function getWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("[stripe/route] STRIPE_WEBHOOK_SECRET is not set");
  }
  return webhookSecret;
}

export async function POST(request: NextRequest) {
  const _ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success: _rlSuccess } = await checkRateLimit(_ip, 'webhook');
  if (!_rlSuccess) {
    return new Response("Too many requests", { status: 429 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();
  
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Atomic idempotency: one round-trip INSERT. The unique constraint on
  // idempotency_locks.key is the only gate — if two concurrent workers
  // both receive the same Stripe event (retry + race), exactly one INSERT
  // succeeds and proceeds; the other gets `code === "23505"` and returns
  // early. Previously this was a SELECT-then-INSERT pair with a
  // check-then-act TOCTOU window.
  const eventKey = `stripe_event:${event.id}`;
  const { data: lockRow, error: lockError } = await supabase
    .from("idempotency_locks")
    .insert({
      key: eventKey,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    })
    .select("key")
    .maybeSingle();
  if (lockError?.code === "23505") {
    debug.log(`[stripe/route] Skipping duplicate event: ${event.id} (${event.type})`);
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (lockError || !lockRow) {
    logger.error("[stripe/route] Failed to acquire idempotency lock:", lockError);
    return NextResponse.json({ error: "idempotency_lock_failed" }, { status: 500 });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      default:
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Webhook processing error:", error);
    // Roll back idempotency lock so Stripe can retry
    await supabase.from("idempotency_locks").delete().eq("key", eventKey);

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  // Extract metadata. user_id is set by the new /signup → checkout flow
  // (PR #46) so the webhook can link the auth user to the tenant it
  // creates. Older sessions without user_id fall back to the previous
  // behaviour (tenant exists, user link gets created later by
  // completeOnboarding).
  const subdomain = session.metadata?.subdomain;
  const plan = session.metadata?.plan || "boutique";
  const fullName = session.metadata?.full_name || "";
  const userId = session.metadata?.user_id || null;
  const customerEmail = session.customer_email;
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  if (!subdomain || !customerEmail) {
    logger.error("Missing subdomain or email in checkout session metadata");
    return;
  }


  // Check if tenant already exists (idempotency)
  const { data: existingTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("subdomain", subdomain)
    .maybeSingle();

  let tenantId: string;

  if (existingTenant) {
    await supabase
      .from("tenants")
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan,
        email: customerEmail,
      })
      .eq("id", existingTenant.id);
    tenantId = existingTenant.id;
  } else {
    // Create tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .insert({
        name: fullName || subdomain,
        slug: subdomain,
        subdomain,
        plan,
        email: customerEmail,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_status: "trialing",
      })
      .select()
      .single();

    if (tenantErr || !tenant) {
      logger.error("Failed to create tenant:", tenantErr);
      return;
    }
    tenantId = tenant.id;

    // Create subscription record
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    await supabase.from("subscriptions").insert({
      tenant_id: tenantId,
      plan,
      status: "trialing",
      stripe_customer_id: stripeCustomerId,
      stripe_sub_id: stripeSubscriptionId,
      trial_ends_at: trialEndsAt.toISOString(),
    });

    // Default location — onboarding used to do this; do it here so that
    // the tenant is fully usable the moment the webhook lands. Idempotent:
    // if onboarding later runs and finds a row, it'll skip insertion.
    await supabase
      .from("locations")
      .insert({
        tenant_id: tenantId,
        name: `${fullName || subdomain} - Main Store`.slice(0, 100),
        type: "retail",
        is_active: true,
      });
  }

  // Link the auth user to this tenant. Without this, completeOnboarding
  // looks at users.tenant_id, finds nothing, and creates a SECOND
  // orphaned tenant — that's the bug Joey hit on 2026-04-28 where one
  // signup produced two tenants and the user got linked to the wrong one.
  if (userId) {
    const { error: userLinkErr } = await supabase
      .from("users")
      .upsert(
        {
          id: userId,
          tenant_id: tenantId,
          email: customerEmail,
          full_name: fullName || "Owner",
          role: "owner",
        },
        { onConflict: "id" },
      );
    if (userLinkErr) {
      logger.error("[stripe-webhook] failed to link user → tenant:", userLinkErr);
    }
  }
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  const stripeSubId = subscription.id;
  const stripeCustomerId = subscription.customer as string;
  const status = mapStripeStatus(subscription.status);
  const plan = subscription.metadata?.plan || "boutique";
  // Access current_period_end from items if available, or use any type assertion
  const subAny = subscription as { current_period_end?: number };
  // Pre-fix: missing current_period_end fell back to NEW Date() (i.e.
  // "right now"). Combined with the middleware's subscription-expiry
  // check this could push a freshly active subscription into a "past
  // period" state. Now: don't write the field if Stripe doesn't carry
  // it on this event — the previous DB value stays intact.
  const currentPeriodEnd = subAny.current_period_end
    ? new Date(subAny.current_period_end * 1000).toISOString()
    : null;

  // Phase 1.5 post-audit (Joey 2026-05-03): capture stripe_price_id +
  // currency from the subscription so calculateMRRByCurrency can
  // match against src/data/pricing.ts PLANS without N round-trips
  // back to Stripe per page load.
  //
  // Stripe items.data is an array — a sub can in theory carry
  // multiple line items. Nexpura's plans are single-price subs so
  // index 0 is correct; if a future plan adds an add-on item, this
  // will need to pick the primary plan price (likely by checking
  // metadata or the largest unit_amount).
  const firstItem = subscription.items?.data?.[0];
  const stripePriceId = firstItem?.price?.id ?? null;
  // Stripe sends currency as lowercase 3-letter code; normalise to
  // upper-case to match PLANS keys + the new currency CHECK.
  const currency = (firstItem?.price?.currency ?? subscription.currency ?? null);
  const currencyUpper = currency ? currency.toUpperCase() : null;

  // Update subscription in database
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("stripe_sub_id", stripeSubId)
    .maybeSingle();

  if (sub) {
    const subUpdate: Record<string, string | null> = { status, plan };
    if (currentPeriodEnd !== null) {
      subUpdate.current_period_end = currentPeriodEnd;
    }
    if (stripePriceId !== null) subUpdate.stripe_price_id = stripePriceId;
    if (currencyUpper !== null) subUpdate.currency = currencyUpper;
    await supabase
      .from("subscriptions")
      .update(subUpdate)
      .eq("id", sub.id);

    // Also update tenant
    await supabase
      .from("tenants")
      .update({
        plan,
        subscription_status: status,
      })
      .eq("id", sub.tenant_id);
  } else {
    // Try to find by customer ID
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();

    if (tenant) {
      await supabase.from("subscriptions").upsert({
        tenant_id: tenant.id,
        plan,
        status,
        stripe_customer_id: stripeCustomerId,
        stripe_sub_id: stripeSubId,
        current_period_end: currentPeriodEnd,
        stripe_price_id: stripePriceId,
        currency: currencyUpper,
      });

      await supabase
        .from("tenants")
        .update({
          plan,
          subscription_status: status,
          stripe_subscription_id: stripeSubId,
        })
        .eq("id", tenant.id);
    }
  }

}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  const stripeSubId = subscription.id;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("stripe_sub_id", stripeSubId)
    .maybeSingle();

  if (sub) {
    // subscriptions.status CHECK constraint only accepts 'canceled'
    // (US spelling). Writing 'cancelled' (UK) raised 23514 on every
    // customer.subscription.deleted event → handler 500'd, idempotency
    // lock rolled back, Stripe retried forever, tenant stayed "active"
    // in our DB after they cancelled in the portal.
    await supabase
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("id", sub.id);

    await supabase
      .from("tenants")
      .update({ subscription_status: "canceled" })
      .eq("id", sub.tenant_id);
  }

}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  const stripeCustomerId = invoice.customer as string;
  const invoiceAny = invoice as { subscription?: string | null };
  const subscriptionId = invoiceAny.subscription as string;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (tenant) {
    await supabase
      .from("tenants")
      .update({ subscription_status: "past_due" })
      .eq("id", tenant.id);

    await supabase
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("stripe_sub_id", subscriptionId);

// Send email notification about failed payment
    try {
      const { data: tenantContact } = await supabase
        .from("tenants")
        .select("email, name")
        .eq("stripe_customer_id", stripeCustomerId)
        .single();
      if (tenantContact?.email) {
        await sendSystemEmail({
          to: tenantContact.email,
          subject: "Payment Failed – Action Required",
          html: `<p>Hi ${tenantContact.name ?? "there"},</p><p>We were unable to process your recent subscription payment. Please update your payment method to prevent service interruption.</p><p>— The Nexpura Team</p>`,
        });
      }
    } catch (emailErr) {
      logger.error("Payment failure email error:", emailErr);
    }
  }
}

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  const stripeCustomerId = invoice.customer as string;
  const invoiceAny = invoice as { subscription?: string | null };
  const subscriptionId = invoiceAny.subscription as string;

  // Reactivate if was past_due
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, subscription_status")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (tenant && tenant.subscription_status === "past_due") {
    await supabase
      .from("tenants")
      .update({ subscription_status: "active" })
      .eq("id", tenant.id);

    await supabase
      .from("subscriptions")
      .update({ status: "active" })
      .eq("stripe_sub_id", subscriptionId);

  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  // subscriptions.status CHECK constraint accepts only US spelling
  // 'canceled' (and not 'cancelled'). Mapping to 'cancelled' here
  // raised 23514 on every cancellation flow and rolled back the
  // idempotency lock — Stripe retried forever.
  const map: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "suspended",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    paused: "paused",
  };
  return map[status] || "active";
}
