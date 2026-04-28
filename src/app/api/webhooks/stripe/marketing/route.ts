import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTwilioWhatsApp } from "@/lib/twilio-whatsapp";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

// Lazy accessors so a missing env var in preview doesn't crash the
// module at load-time (which produces an unrelated 500 instead of the
// intended 503). Mirrors the main /api/webhooks/stripe/route.ts pattern.
let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  return _stripe;
}

function getMarketingWebhookSecret(): string | null {
  return process.env.STRIPE_MARKETING_WEBHOOK_SECRET || null;
}

export async function POST(req: NextRequest) {
  const _ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success: _rlSuccess } = await checkRateLimit(_ip);
  if (!_rlSuccess) {
    return new Response("Too many requests", { status: 429 });
  }

  const stripe = getStripe();
  const webhookSecret = getMarketingWebhookSecret();
  if (!stripe || !webhookSecret) {
    logger.error("[stripe-marketing-webhook] missing STRIPE_SECRET_KEY or STRIPE_MARKETING_WEBHOOK_SECRET — refusing request");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    logger.error("[stripe-marketing-webhook] No signature");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error("[stripe-marketing-webhook] Invalid signature:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }


  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Check if this is a WhatsApp campaign payment
    if (session.metadata?.type !== "whatsapp_campaign") {
      return NextResponse.json({ received: true });
    }

    const campaignId = session.metadata.campaign_id;
    const tenantId = session.metadata.tenant_id;

    if (!campaignId || !tenantId) {
      logger.error("[stripe-marketing-webhook] Missing metadata");
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Atomic idempotency guard keyed on Stripe event.id — matches the
    // pattern the main stripe/route.ts uses. Without this, any Stripe
    // retry (they retry non-2xx + on timeouts) would fire a second
    // sendWhatsAppCampaign, double-broadcasting to the entire recipient
    // list + double-charging Twilio.
    const { error: lockErr } = await admin
      .from("idempotency_locks")
      .insert({
        key: `stripe_marketing_event:${event.id}`,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      });
    if (lockErr?.code === "23505") {
      // Already processed this event — idempotent ack.
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (lockErr) {
      logger.warn("[stripe-marketing-webhook] idempotency lock unavailable, proceeding", { error: lockErr });
    }

    try {
      // Update campaign status
      await admin
        .from("whatsapp_campaigns")
        .update({
          payment_status: "paid",
          status: "paid",
          stripe_payment_intent_id: session.payment_intent as string,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      // Update purchase record
      await admin
        .from("marketing_purchases")
        .update({
          status: "completed",
          stripe_payment_intent_id: session.payment_intent as string,
          completed_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", session.id);

      // Trigger campaign send
      await sendWhatsAppCampaign(campaignId, tenantId, admin);

    } catch (err) {
      logger.error("[stripe-marketing-webhook] Error processing:", err);
      
      // Mark campaign as failed
      await admin
        .from("whatsapp_campaigns")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

async function sendWhatsAppCampaign(
  campaignId: string,
  tenantId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  // Update status to sending
  await admin
    .from("whatsapp_campaigns")
    .update({
      status: "sending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  // Get campaign details
  const { data: campaign } = await admin
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Get tenant for business name
  const { data: tenant } = await admin
    .from("tenants")
    .select("name, business_name")
    .eq("id", tenantId)
    .single();

  const businessName = tenant?.business_name || tenant?.name || "";

  // Get recipients based on campaign settings
  let recipients: Array<{ id: string; phone: string | null; mobile: string | null; full_name: string | null }> = [];

  const filter = campaign.recipient_filter as Record<string, unknown>;

  if (campaign.recipient_type === "all") {
    const { data } = await admin
      .from("customers")
      .select("id, phone, mobile, full_name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or("phone.not.is.null,mobile.not.is.null");
    recipients = data || [];
  } else if (campaign.recipient_type === "segment" && filter.segment_id) {
    // For segments, we'd need to evaluate segment rules
    // For now, just get all customers (simplified)
    const { data } = await admin
      .from("customers")
      .select("id, phone, mobile, full_name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or("phone.not.is.null,mobile.not.is.null");
    recipients = data || [];
  } else if (campaign.recipient_type === "tags" && Array.isArray(filter.tags)) {
    const { data } = await admin
      .from("customers")
      .select("id, phone, mobile, full_name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or("phone.not.is.null,mobile.not.is.null")
      .overlaps("tags", filter.tags as string[]);
    recipients = data || [];
  } else if (campaign.recipient_type === "manual" && Array.isArray(filter.customer_ids)) {
    const { data } = await admin
      .from("customers")
      .select("id, phone, mobile, full_name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or("phone.not.is.null,mobile.not.is.null")
      .in("id", filter.customer_ids as string[]);
    recipients = data || [];
  }

  // Dedupe by phone number — a customer can be in multiple
  // segments/tags, or have duplicate CRM rows; without dedup they
  // receive the same campaign N times. Pick the customer record with
  // the longest name (proxy for "most complete profile") when
  // collapsing duplicates so personalisation still works.
  const byPhone = new Map<string, typeof recipients[number]>();
  for (const r of recipients) {
    const phoneNumber = r.mobile || r.phone;
    if (!phoneNumber) continue;
    const norm = phoneNumber.replace(/\D/g, "");
    if (!norm) continue;
    const existing = byPhone.get(norm);
    if (!existing || (r.full_name?.length ?? 0) > (existing.full_name?.length ?? 0)) {
      byPhone.set(norm, r);
    }
  }
  const dedupedRecipients = Array.from(byPhone.values());

  // Idempotency on retry: filter out recipients we've already sent
  // this campaign to. Stripe webhooks retry on non-2xx + on timeout;
  // without this guard a flaky network during the very first send
  // would re-blast everyone we already messaged. We key on
  // (campaign_id, phone) since phone is the durable identifier.
  const { data: priorSends } = await admin
    .from("whatsapp_sends")
    .select("phone")
    .eq("tenant_id", tenantId)
    .eq("campaign_id", campaignId)
    .in("status", ["sent", "delivered"]);
  const alreadySentPhones = new Set(
    (priorSends ?? []).map((p) => (p.phone ?? "").replace(/\D/g, "")).filter(Boolean),
  );
  const recipientsToSend = dedupedRecipients.filter((r) => {
    const norm = (r.mobile || r.phone || "").replace(/\D/g, "");
    return norm && !alreadySentPhones.has(norm);
  });

  let sent = 0;
  let failed = 0;
  let delivered = 0;

  // Send messages (batch to avoid rate limits)
  const BATCH_SIZE = 10;
  const BATCH_DELAY = 1000; // 1 second between batches

  for (let i = 0; i < recipientsToSend.length; i += BATCH_SIZE) {
    const batch = recipientsToSend.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (recipient) => {
      // Get phone number (prefer mobile, fallback to phone)
      const phoneNumber = recipient.mobile || recipient.phone;
      if (!phoneNumber) return; // Skip if no phone number

      // Personalize message
      let message = campaign.message;
      message = message.replace(/\{\{\s*customer_name\s*\}\}/gi, recipient.full_name || "there");
      message = message.replace(/\{\{\s*business_name\s*\}\}/gi, businessName);

      try {
        const result = await sendTwilioWhatsApp(phoneNumber, message);

        // Log the send
        await admin.from("whatsapp_sends").insert({
          tenant_id: tenantId,
          campaign_id: campaignId,
          customer_id: recipient.id,
          phone: phoneNumber,
          message,
          message_type: "marketing",
          status: result.success ? "sent" : "failed",
          twilio_sid: result.messageId,
          error_message: result.error,
        });

        if (result.success) {
          sent++;
          delivered++; // Assume delivered for now (Twilio webhooks would update this)
        } else {
          failed++;
        }
      } catch (err) {
        logger.error(`[sendWhatsAppCampaign] Error sending to ${phoneNumber}:`, err);

        await admin.from("whatsapp_sends").insert({
          tenant_id: tenantId,
          campaign_id: campaignId,
          customer_id: recipient.id,
          phone: phoneNumber,
          message,
          message_type: "marketing",
          status: "failed",
          error_message: err instanceof Error ? err.message : "Unknown error",
        });

        failed++;
      }
    });

    await Promise.all(promises);

    // Update progress periodically
    if (i % (BATCH_SIZE * 5) === 0) {
      await admin
        .from("whatsapp_campaigns")
        .update({
          stats: { sent, delivered, failed },
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
    }

    // Wait between batches to respect rate limits
    if (i + BATCH_SIZE < recipientsToSend.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }

  // Final update
  await admin
    .from("whatsapp_campaigns")
    .update({
      status: "sent",
      stats: { sent, delivered, failed },
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

}
