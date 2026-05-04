import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";

/**
 * P2-F audit follow-on (Joey 2026-05-04). Persistent forensic trail
 * for inbound webhook deliveries — signature attempts + valid traffic
 * alike. See supabase/migrations/20260504_webhook_audit_log.sql.
 *
 * Body is NOT stored — `payload_hash` (sha256 of body) is the only
 * correlation key. Storing full bodies would balloon the table on a
 * platform that handles thousands of Stripe events / month and would
 * land customer PII inside the audit table.
 *
 * Usage:
 *   await logWebhookAudit({
 *     handlerName: 'stripe',
 *     signatureStatus: 'valid',
 *     request,
 *     body,
 *     eventId: event.id,
 *     eventType: event.type,
 *   });
 *
 * Failures are swallowed (warn-logged) — audit-log writes must never
 * affect the webhook handler's HTTP response, since the provider
 * decides retry behaviour off that response.
 */

export type WebhookHandlerName =
  | "stripe"
  | "stripe_marketing"
  | "resend"
  | "woocommerce";

export type WebhookSignatureStatus =
  | "valid"
  | "invalid_signature"
  | "missing_signature"
  | "missing_headers"
  | "not_configured";

export interface LogWebhookAuditArgs {
  handlerName: WebhookHandlerName;
  signatureStatus: WebhookSignatureStatus;
  request: Request;
  body?: string;
  eventId?: string | null;
  eventType?: string | null;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function logWebhookAudit(args: LogWebhookAuditArgs): Promise<void> {
  const { handlerName, signatureStatus, request, body, eventId, eventType } = args;
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = request.headers.get("user-agent") || null;
    const url = new URL(request.url);
    const admin = createAdminClient();
    const { error } = await admin.from("webhook_audit_log").insert({
      handler_name: handlerName,
      signature_status: signatureStatus,
      request_path: url.pathname,
      ip_address: ip,
      user_agent: ua,
      payload_hash: body ? sha256Hex(body) : null,
      event_id: eventId ?? null,
      event_type: eventType ?? null,
    });
    if (error) {
      logger.warn("[webhook-audit] insert failed", {
        handlerName,
        signatureStatus,
        err: error,
      });
    }
  } catch (err) {
    // Never throw — audit-log failures must not break the response.
    logger.warn("[webhook-audit] threw", { handlerName, err });
  }
}
