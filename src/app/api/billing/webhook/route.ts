import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentSuccessEmail, sendPaymentFailedEmail } from "@/lib/email/send";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig ?? "", webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed";
    console.error("Webhook error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const adminClient = createAdminClient();

  /**
   * Extract subscription ID from an Invoice object.
   * In Stripe API 2024-11-20.acacia, the subscription is on invoice.parent.subscription_details.subscription
   */
  function getSubIdFromInvoice(invoice: Stripe.Invoice): string | null {
    const parent = invoice.parent;
    if (parent?.type === "subscription_details" && parent.subscription_details) {
      const sub = parent.subscription_details.subscription;
      return typeof sub === "string" ? sub : sub.id;
    }
    return null;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;
        const stripeSubId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        const stripeCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;

        if (tenantId) {
          await adminClient
            .from("subscriptions")
            .update({
              status: "active",
              ...(stripeSubId ? { stripe_sub_id: stripeSubId } : {}),
              ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
            })
            .eq("tenant_id", tenantId);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId = getSubIdFromInvoice(invoice);

        if (stripeSubId) {
          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
          await adminClient
            .from("subscriptions")
            .update({
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : null,
            })
            .eq("stripe_sub_id", stripeSubId);

          // Send payment success email
          const { data: sub } = await adminClient
            .from("subscriptions")
            .select("tenant_id, plan")
            .eq("stripe_sub_id", stripeSubId)
            .single();
          if (sub) {
            const { data: owner } = await adminClient
              .from("users")
              .select("email, full_name")
              .eq("tenant_id", sub.tenant_id)
              .eq("role", "owner")
              .single();
            if (owner?.email) {
              const amount = (invoice.amount_paid ?? 0) / 100;
              const nextBillingDate = periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date().toISOString();
              await sendPaymentSuccessEmail(owner.email, owner.full_name ?? "there", amount, sub.plan ?? "Pro", nextBillingDate);
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId = getSubIdFromInvoice(invoice);

        if (stripeSubId) {
          await adminClient
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_sub_id", stripeSubId);

          // Send payment failed email
          const { data: sub } = await adminClient
            .from("subscriptions")
            .select("tenant_id")
            .eq("stripe_sub_id", stripeSubId)
            .single();
          if (sub) {
            const { data: owner } = await adminClient
              .from("users")
              .select("email, full_name")
              .eq("tenant_id", sub.tenant_id)
              .eq("role", "owner")
              .single();
            if (owner?.email) {
              const amount = (invoice.amount_due ?? 0) / 100;
              await sendPaymentFailedEmail(owner.email, owner.full_name ?? "there", amount, `${process.env.NEXT_PUBLIC_APP_URL}/billing`);
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await adminClient
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("stripe_sub_id", subscription.id);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const plan = subscription.metadata?.plan;
        // In newer Stripe API versions, current_period_end is on subscription items
        const itemPeriodEnd = subscription.items?.data?.[0]
          ? (subscription.items.data[0] as Stripe.SubscriptionItem & { current_period_end?: number }).current_period_end
          : undefined;
        await adminClient
          .from("subscriptions")
          .update({
            status: subscription.status,
            ...(plan ? { plan } : {}),
            ...(itemPeriodEnd
              ? { current_period_end: new Date(itemPeriodEnd * 1000).toISOString() }
              : {}),
          })
          .eq("stripe_sub_id", subscription.id);
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (error) {
    console.error(`Error handling webhook event ${event.type}:`, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
