/**
 * Shared tracking-email send logic.
 *
 * Extracted from /api/tracking/send-email/route.ts so server actions
 * (createRepair / createBespokeJob / etc.) can call it directly without
 * a server-to-server HTTP fetch. The HTTP route still exists for the
 * authenticated UI re-send button — it now wraps this shared function
 * after session + location gates.
 *
 * Pre-extraction the helper in lib/tracking.ts did
 *   await fetch(`${baseUrl}/api/tracking/send-email`, …)
 * with no cookies forwarded → the route's session check (added by
 * W7-CRIT-04 hardening) returned 401 on every internal call → every
 * post-create tracking email failed silently.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isSandbox, logSandboxSuppressedSend } from "@/lib/sandbox";
import logger from "@/lib/logger";
// Tracking emails can use a dedicated key (RESEND_TRACKING_API_KEY) so
// it can be rotated independently of the main transactional key. The
// rest of the transactional stack reads the centralised resend client;
// this surface uses its own to keep PR-03 sandbox semantics correct.
// eslint-disable-next-line no-restricted-imports
import { Resend } from "resend";

interface SendTrackingEmailResult {
  success: boolean;
  messageId?: string;
  trackingId?: string;
  error?: string;
}

interface OrderForEmail {
  tracking_id: string;
  customer_email: string | null;
  item_description: string;
  item_type?: string;
  estimated_completion_date: string | null;
}

function getTrackingResendOrError(): { client: Resend } | { error: string } {
  const key = process.env.RESEND_TRACKING_API_KEY || process.env.RESEND_API_KEY;
  if (!key) {
    return { error: "Email provider is not configured (RESEND_API_KEY missing)." };
  }
  return { client: new Resend(key) };
}

/**
 * Resolve order details (tracking_id, customer email, etc.) given a
 * tenant_id-scoped (orderType, orderId). Returns null if the order
 * doesn't exist within that tenant — caller should treat as
 * "nothing to send".
 */
async function loadOrderForEmail(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  orderType: "repair" | "bespoke",
  orderId: string,
): Promise<{ order: OrderForEmail; locationId: string | null } | null> {
  if (orderType === "repair") {
    const { data } = await admin
      .from("repairs")
      .select("tracking_id, customer_email, item_description, item_type, estimated_completion_date, location_id")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .single();
    if (!data || !data.tracking_id) return null;
    return {
      order: {
        tracking_id: data.tracking_id,
        customer_email: data.customer_email,
        item_description: data.item_description,
        item_type: data.item_type ?? undefined,
        estimated_completion_date: data.estimated_completion_date,
      },
      locationId: data.location_id as string | null,
    };
  }
  // bespoke
  const { data } = await admin
    .from("bespoke_jobs")
    .select("tracking_id, customer_email, description, jewellery_type, estimated_completion_date, location_id")
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .single();
  if (!data || !data.tracking_id) return null;
  return {
    order: {
      tracking_id: data.tracking_id,
      customer_email: data.customer_email,
      item_description: data.description,
      item_type: data.jewellery_type ?? undefined,
      estimated_completion_date: data.estimated_completion_date,
    },
    locationId: data.location_id as string | null,
  };
}

function buildEmailHtml(
  order: OrderForEmail,
  orderTypeLabel: string,
  orderType: "repair" | "bespoke",
  businessName: string,
  trackingUrl: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 48px; height: 48px; background: #1a1a1a; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
          <span style="color: white; font-weight: bold; font-size: 24px;">N</span>
        </div>
        <h1 style="margin: 16px 0 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">${businessName}</h1>
      </div>
      <div style="text-align: center;">
        <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px;">Thank you for your ${orderTypeLabel.toLowerCase()}. Here are your order details:</p>
        <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: left;">
          <p style="margin: 0 0 8px; color: #1a1a1a; font-weight: 600;">${order.item_type || "Jewellery Item"}</p>
          <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">${order.item_description}</p>
          ${
            order.estimated_completion_date
              ? `<p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Est. Completion:</strong> ${new Date(order.estimated_completion_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>`
              : ""
          }
        </div>
        <div style="margin-bottom: 32px;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Tracking ID</p>
          <p style="margin: 0; font-family: monospace; font-size: 20px; font-weight: 600; color: #1a1a1a; background: #f3f4f6; padding: 12px 24px; border-radius: 8px; display: inline-block;">${order.tracking_id}</p>
        </div>
        <a href="${trackingUrl}" style="display: inline-block; background: #1a1a1a; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">Track Your Order</a>
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 14px;">Or copy this link: <a href="${trackingUrl}" style="color: #6b7280;">${trackingUrl}</a></p>
      </div>
    </div>
    <div style="text-align: center; margin-top: 24px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">Powered by <a href="https://nexpura.com" style="color: #1a1a1a; font-weight: 600; text-decoration: none;">Nexpura</a></p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send the customer tracking email for a freshly-created repair or
 * bespoke job. Trusted-server context — caller is expected to have
 * already authenticated/authorised. Returns soft-failure shape so the
 * caller can log without crashing the create flow.
 *
 * Use the HTTP route /api/tracking/send-email for the authenticated
 * UI re-send button — that wraps this with session + location gates.
 */
export async function sendTrackingEmailInternal(params: {
  tenantId: string;
  orderType: "repair" | "bespoke";
  orderId: string;
}): Promise<SendTrackingEmailResult & { locationId?: string | null }> {
  try {
    const admin = createAdminClient();
    const result = await loadOrderForEmail(admin, params.tenantId, params.orderType, params.orderId);
    if (!result) {
      return { success: false, error: "Order not found in tenant" };
    }
    const { order, locationId } = result;
    if (!order.customer_email) {
      return { success: false, error: "No customer email on order", locationId };
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select("business_name, name")
      .eq("id", params.tenantId)
      .single();
    const businessName = tenant?.business_name || tenant?.name || "Your Jeweller";
    const trackingUrl = `https://nexpura.com/track/${order.tracking_id}`;
    const orderTypeLabel = params.orderType === "repair" ? "Repair" : "Bespoke Order";

    if (isSandbox()) {
      logSandboxSuppressedSend({
        channel: "email",
        to: order.customer_email,
        subject: `Your ${orderTypeLabel} - Tracking ID: ${order.tracking_id}`,
      });
      return {
        success: true,
        messageId: "sandbox-suppressed",
        trackingId: order.tracking_id,
        locationId,
      };
    }

    const resendResult = getTrackingResendOrError();
    if ("error" in resendResult) {
      logger.error("[tracking-email] " + resendResult.error);
      return { success: false, error: "Email provider unavailable", locationId };
    }

    const { data: emailResult, error: emailError } = await resendResult.client.emails.send({
      from: `${businessName} <noreply@nexpura.com>`,
      to: order.customer_email,
      subject: `Your ${orderTypeLabel} - Tracking ID: ${order.tracking_id}`,
      html: buildEmailHtml(order, orderTypeLabel, params.orderType, businessName, trackingUrl),
    });

    if (emailError) {
      logger.error("[tracking-email] send failed:", emailError);
      return { success: false, error: "Failed to send email", locationId };
    }

    logger.info(`[tracking-email] sent to ${order.customer_email} for ${order.tracking_id}`);
    return {
      success: true,
      messageId: emailResult?.id,
      trackingId: order.tracking_id,
      locationId,
    };
  } catch (err) {
    logger.error("[tracking-email] exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
