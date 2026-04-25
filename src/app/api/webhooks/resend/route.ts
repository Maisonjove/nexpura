import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyResendSvixSignature } from "@/lib/webhook-security";
import logger from "@/lib/logger";

/**
 * Resend Webhook Handler
 *
 * Handles email delivery events from Resend:
 *  - email.delivered — successfully delivered
 *  - email.bounced   — invalid address
 *  - email.complained — recipient marked as spam
 *
 * W7-CRIT-01 fix: the previous handler fell back to `return no-secret => valid`
 * when `RESEND_WEBHOOK_SECRET` was unset, which meant prod traffic was never
 * authenticated. Runtime QA proved a forged body returned 200 `{received:true}`.
 *
 * New contract:
 *  - In production the secret MUST be set; missing secret => 503.
 *  - Missing / invalid signature => 401. Never 200.
 *  - Replayed event ids => idempotent 200 with `{duplicate:true}`.
 */

const IS_PROD = process.env.NODE_ENV === "production";
// In prod/staging we require the signing secret. Dev/test keeps a clear log.
function getResendSecret(): string | null {
  return process.env.RESEND_WEBHOOK_SECRET || null;
}

interface ResendWebhookEvent {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.bounced"
    | "email.complained"
    | "email.opened"
    | "email.clicked";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    bounce?: {
      message: string;
    };
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  const secret = getResendSecret();
  if (!secret) {
    if (IS_PROD) {
      logger.error("[resend-webhook] RESEND_WEBHOOK_SECRET missing in production — refusing request");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    // Non-prod fallback: loud log, still reject so tests can't pass accidentally.
    logger.warn("[resend-webhook] RESEND_WEBHOOK_SECRET unset — rejecting (dev)");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  const signatureOk = verifyResendSvixSignature(
    body,
    { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
    secret,
  );

  if (!signatureOk) {
    logger.warn("[resend-webhook] Invalid or missing signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Atomic idempotency on Svix message-id. Two simultaneous retries of the
  // same event can only enter the mutation block once.
  if (svixId) {
    const { error: lockError } = await supabase
      .from("idempotency_locks")
      .insert({
        key: `resend_event:${svixId}`,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      });
    if (lockError?.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (lockError) {
      // Don't drop the event on lock failure — but log loudly.
      logger.warn("[resend-webhook] idempotency lock unavailable, proceeding", { error: lockError });
    }
  }

  try {
    switch (event.type) {
      case "email.bounced": {
        const emails = event.data.to;
        logger.info(`[resend-webhook] Email bounced for: ${emails.join(", ")}`);

        // Pre-fix this updated customers across ALL tenants matching
        // the bounced email. Two tenants legitimately sharing a customer
        // email (common in jewellery — same retail customer at multiple
        // stores) meant Tenant A's bounce silently un-mailable'd that
        // person at Tenant B without warning. Scope to the tenant whose
        // email_logs row matched this resend_id.
        //
        // If we can't resolve the tenant (no log row), skip the
        // customer update entirely rather than fall back to the
        // cross-tenant ilike. The email_logs.status update below still
        // fires (keyed by resend_id), so we don't lose the bounce
        // signal — we just decline to mark customers as bounced when
        // we can't be sure which tenant they belong to.
        const { data: emailLog } = await supabase
          .from("email_logs")
          .select("tenant_id")
          .eq("resend_id", event.data.email_id)
          .maybeSingle();
        const scopedTenantId = (emailLog?.tenant_id as string | undefined) ?? null;

        for (const email of emails) {
          if (!scopedTenantId) {
            logger.warn(`[resend-webhook] bounce for ${email} — no tenant scope (resend_id not in email_logs); skipping customer update`);
            // Still update email_logs by resend_id below so the bounce
            // signal isn't completely lost.
            await supabase
              .from("email_logs")
              .update({
                status: "bounced",
                bounce_reason: event.data.bounce?.message || "Email bounced",
              })
              .eq("resend_id", event.data.email_id);
            continue;
          }
          const { data: customers } = await supabase
            .from("customers")
            .select("id, email_status")
            .ilike("email", email)
            .eq("tenant_id", scopedTenantId);

          if (customers && customers.length > 0) {
            await supabase
              .from("customers")
              .update({
                email_status: "bounced",
                email_bounced_at: new Date().toISOString(),
              })
              .in("id", customers.map(c => c.id));

            logger.info(`[resend-webhook] Marked ${customers.length} customer(s) as bounced: ${email}`);
          }

          await supabase
            .from("email_logs")
            .update({
              status: "bounced",
              bounce_reason: event.data.bounce?.message || "Email bounced",
            })
            .eq("resend_id", event.data.email_id);
        }
        break;
      }

      case "email.complained": {
        const emails = event.data.to;
        logger.info(`[resend-webhook] Spam complaint from: ${emails.join(", ")}`);

        for (const email of emails) {
          const { data: customers } = await supabase
            .from("customers")
            .select("id")
            .ilike("email", email);

          if (customers && customers.length > 0) {
            await supabase
              .from("customers")
              .update({
                email_status: "complained",
                email_opted_out: true,
                email_opted_out_at: new Date().toISOString(),
              })
              .in("id", customers.map(c => c.id));

            logger.warn(`[resend-webhook] Marked ${customers.length} customer(s) as opted-out due to spam complaint: ${email}`);
          }
        }
        break;
      }

      case "email.delivered": {
        await supabase
          .from("email_logs")
          .update({ status: "delivered" })
          .eq("resend_id", event.data.email_id);
        break;
      }

      default:
        // Ignore other events (sent, opened, clicked)
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("[resend-webhook] Processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
