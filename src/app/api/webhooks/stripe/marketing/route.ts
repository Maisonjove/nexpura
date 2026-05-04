import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTwilioWhatsApp } from "@/lib/twilio-whatsapp";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { logWebhookAudit } from "@/lib/webhook-audit";
import { withSentryFlush } from "@/lib/sentry-flush";

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

export const POST = withSentryFlush(async (req: NextRequest) => {
  const _ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success: _rlSuccess } = await checkRateLimit(_ip);
  if (!_rlSuccess) {
    return new Response("Too many requests", { status: 429 });
  }

  const stripe = getStripe();
  const webhookSecret = getMarketingWebhookSecret();
  const body = await req.text();
  if (!stripe || !webhookSecret) {
    logger.error("[stripe-marketing-webhook] missing STRIPE_SECRET_KEY or STRIPE_MARKETING_WEBHOOK_SECRET — refusing request");
    await logWebhookAudit({
      handlerName: "stripe_marketing",
      signatureStatus: "not_configured",
      request: req,
      body,
    });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    logger.error("[stripe-marketing-webhook] No signature");
    await logWebhookAudit({
      handlerName: "stripe_marketing",
      signatureStatus: "missing_signature",
      request: req,
      body,
    });
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error("[stripe-marketing-webhook] Invalid signature:", err);
    await logWebhookAudit({
      handlerName: "stripe_marketing",
      signatureStatus: "invalid_signature",
      request: req,
      body,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Valid-signature audit row before any DB mutation. Fire-and-forget
  // — audit failure must not break the response (logWebhookAudit
  // swallows internally).
  await logWebhookAudit({
    handlerName: "stripe_marketing",
    signatureStatus: "valid",
    request: req,
    body,
    eventId: event.id,
    eventType: event.type,
  });


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
    const eventKey = `stripe_marketing_event:${event.id}`;
    const { error: lockErr } = await admin
      .from("idempotency_locks")
      .insert({
        key: eventKey,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      });
    if (lockErr?.code === "23505") {
      // Already processed this event — idempotent ack.
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (lockErr) {
      // P2-F audit (Joey 2026-05-04): pre-fix this proceeded on lock
      // unavailable. A duplicate Stripe retry during a transient DB
      // error would double-send the WhatsApp campaign + double-charge
      // Twilio. Fail closed instead — Stripe retries on 5xx so the
      // campaign send happens exactly once.
      logger.error("[stripe-marketing-webhook] idempotency lock failed — refusing to proceed", { error: lockErr });
      return NextResponse.json({ error: "idempotency_lock_failed" }, { status: 500 });
    }

    try {
      // Update campaign status. Destructive — on error we throw, the
      // catch block below rolls back the idempotency lock + returns
      // 500 so Stripe retries.
      const { error: campaignPaidErr } = await admin
        .from("whatsapp_campaigns")
        .update({
          payment_status: "paid",
          status: "paid",
          stripe_payment_intent_id: session.payment_intent as string,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
      if (campaignPaidErr) {
        throw new Error(`whatsapp_campaigns paid-status update failed: ${campaignPaidErr.message}`);
      }

      // Update purchase record
      const { error: purchaseErr } = await admin
        .from("marketing_purchases")
        .update({
          status: "completed",
          stripe_payment_intent_id: session.payment_intent as string,
          completed_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", session.id);
      if (purchaseErr) {
        throw new Error(`marketing_purchases update failed: ${purchaseErr.message}`);
      }

      // Trigger campaign send
      await sendWhatsAppCampaign(campaignId, tenantId, admin);

    } catch (err) {
      logger.error("[stripe-marketing-webhook] Error processing:", err);

      // Mark campaign as failed
      const { error: failUpdErr } = await admin
        .from("whatsapp_campaigns")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
      if (failUpdErr) {
        logger.error("[stripe-marketing-webhook] failed-status update failed", { campaignId, err: failUpdErr });
      }

      // P2-F audit (Joey 2026-05-04): pre-fix the idempotency lock
      // was left in place after a processing failure → Stripe's
      // retry hit the duplicate check and 200'd → campaign stayed
      // "failed" forever, no recovery path. Drop the lock so the
      // retry can re-enter the mutation block.
      try {
        const { error: rollbackErr } = await admin
          .from("idempotency_locks")
          .delete()
          .eq("key", eventKey);
        if (rollbackErr) {
          logger.error("[stripe-marketing-webhook] failed to roll back idempotency lock", { eventKey, err: rollbackErr });
        }
      } catch (rollbackErr) {
        logger.error("[stripe-marketing-webhook] idempotency-lock rollback threw", { eventKey, err: rollbackErr });
      }

      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
});

async function sendWhatsAppCampaign(
  campaignId: string,
  tenantId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  // Update status to sending. Throws on failure → caller's catch
  // returns 500 → Stripe retries. Pre-fix this was a bare update.
  const { error: sendingErr } = await admin
    .from("whatsapp_campaigns")
    .update({
      status: "sending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (sendingErr) {
    throw new Error(`whatsapp_campaigns sending-status update failed: ${sendingErr.message}`);
  }

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

        // Per-send audit log. Policy: log-on-error, do NOT throw —
        // a single failed audit insert shouldn't blow up the entire
        // campaign send. The Twilio call already succeeded; missing
        // the local row is recoverable from Twilio's own dashboard.
        const { error: sendInsErr } = await admin.from("whatsapp_sends").insert({
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
        if (sendInsErr) {
          logger.error("[sendWhatsAppCampaign] whatsapp_sends insert failed", { campaignId, phone: phoneNumber, err: sendInsErr });
        }

        if (result.success) {
          sent++;
          delivered++; // Assume delivered for now (Twilio webhooks would update this)
        } else {
          failed++;
        }
      } catch (err) {
        logger.error(`[sendWhatsAppCampaign] Error sending to ${phoneNumber}:`, err);

        const { error: failInsErr } = await admin.from("whatsapp_sends").insert({
          tenant_id: tenantId,
          campaign_id: campaignId,
          customer_id: recipient.id,
          phone: phoneNumber,
          message,
          message_type: "marketing",
          status: "failed",
          error_message: err instanceof Error ? err.message : "Unknown error",
        });
        if (failInsErr) {
          logger.error("[sendWhatsAppCampaign] whatsapp_sends fail-row insert failed", { campaignId, phone: phoneNumber, err: failInsErr });
        }

        failed++;
      }
    });

    await Promise.all(promises);

    // Update progress periodically. Policy: log-on-error, do NOT
    // throw — progress updates are observability, not state of
    // record. The campaign keeps sending; we just lose interim
    // stats visibility for this batch.
    if (i % (BATCH_SIZE * 5) === 0) {
      const { error: progressErr } = await admin
        .from("whatsapp_campaigns")
        .update({
          stats: { sent, delivered, failed },
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
      if (progressErr) {
        logger.error("[sendWhatsAppCampaign] progress update failed (non-fatal)", { campaignId, err: progressErr });
      }
    }

    // Wait between batches to respect rate limits
    if (i + BATCH_SIZE < recipientsToSend.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }

  // Final update — destructive state-of-record transition. Throws
  // on error → outer catch returns 500 → Stripe retries.
  const { error: finalErr } = await admin
    .from("whatsapp_campaigns")
    .update({
      status: "sent",
      stats: { sent, delivered, failed },
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (finalErr) {
    throw new Error(`whatsapp_campaigns final-status update failed: ${finalErr.message}`);
  }
}
