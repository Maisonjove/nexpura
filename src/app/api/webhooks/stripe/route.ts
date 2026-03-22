import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSystemEmail } from "@/lib/email-sender";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

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
    console.error("Webhook processing error:", error);
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
  // Extract metadata
  const subdomain = session.metadata?.subdomain;
  const plan = session.metadata?.plan || "boutique";
  const fullName = session.metadata?.full_name || "";
  const customerEmail = session.customer_email;
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  if (!subdomain || !customerEmail) {
    console.error("Missing subdomain or email in checkout session metadata");
    return;
  }


  // Check if tenant already exists (idempotency)
  const { data: existingTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("subdomain", subdomain)
    .maybeSingle();

  if (existingTenant) {
    await supabase
      .from("tenants")
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan,
      })
      .eq("id", existingTenant.id);
    return;
  }

  // Create tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      name: fullName || subdomain,
      slug: subdomain,
      subdomain,
      plan,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      subscription_status: "trialing",
    })
    .select()
    .single();

  if (tenantErr || !tenant) {
    console.error("Failed to create tenant:", tenantErr);
    return;
  }

  // Create subscription record
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  await supabase.from("subscriptions").insert({
    tenant_id: tenant.id,
    plan,
    status: "trialing",
    stripe_customer_id: stripeCustomerId,
    stripe_sub_id: stripeSubscriptionId,
    trial_ends_at: trialEndsAt.toISOString(),
  });

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
  const currentPeriodEnd = subAny.current_period_end 
    ? new Date(subAny.current_period_end * 1000).toISOString()
    : new Date().toISOString();

  // Update subscription in database
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("stripe_sub_id", stripeSubId)
    .maybeSingle();

  if (sub) {
    await supabase
      .from("subscriptions")
      .update({
        status,
        plan,
        current_period_end: currentPeriodEnd,
      })
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
    await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", sub.id);

    await supabase
      .from("tenants")
      .update({ subscription_status: "cancelled" })
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
      console.error("Payment failure email error:", emailErr);
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
  const map: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "cancelled",
    unpaid: "suspended",
    incomplete: "incomplete",
    incomplete_expired: "cancelled",
    paused: "paused",
  };
  return map[status] || "active";
}
