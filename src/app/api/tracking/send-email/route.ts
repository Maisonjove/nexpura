import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
// PR-03 exception: this route needs a per-request Resend client because it
// uses a dedicated RESEND_TRACKING_API_KEY that can be rotated independently
// of the main transactional key. The sandbox gate is enforced inline
// below via isSandbox(); the factory is never reached in sandbox mode.
// eslint-disable-next-line no-restricted-imports
import { Resend } from "resend";
import { isSandbox, logSandboxSuppressedSend } from "@/lib/sandbox";
import logger from "@/lib/logger";
import { assertUserCanAccessLocation, LocationAccessDeniedError } from "@/lib/auth/assert-location";

/**
 * Launch-QA W7-CRIT-04: this route previously accepted `tenantId` from the
 * request body and used it as the scoping filter on the order lookup and
 * the tenant-business-name lookup. Any caller could (a) confirm the
 * existence of an (orderId, tenantId) pair across tenants and (b) trigger
 * a customer-facing tracking email under a foreign tenant's branding if
 * the orderId happened to collide. The fix:
 *   - Require an authenticated session.
 *   - Resolve the tenant from the session, never from the body.
 *   - Load the order with that tenant as the scoping filter.
 */

// Tracking emails can use a dedicated key (RESEND_TRACKING_API_KEY) so it can
// be rotated independently of the main transactional key. Falls back to
// RESEND_API_KEY if the dedicated one isn't set. Never hardcoded — the key
// is resolved lazily per-request, and if neither env var is present the
// route returns a clean 500 instead of crashing or silently "succeeding".
function getTrackingResendOrError(): { client: Resend } | { error: string } {
  const key = process.env.RESEND_TRACKING_API_KEY || process.env.RESEND_API_KEY;
  if (!key) {
    return { error: "Email provider is not configured (RESEND_API_KEY missing)." };
  }
  return { client: new Resend(key) };
}

interface SendTrackingEmailRequest {
  orderType: "repair" | "bespoke";
  orderId: string;
}

export async function POST(request: NextRequest) {
  try {
    // Require a valid session; resolve tenant from it (never from body).
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    const tenantId = profile?.tenant_id as string | undefined;
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SendTrackingEmailRequest = await request.json();
    const { orderType, orderId } = body;

    if (!orderType || !orderId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Get order details (incl. location_id for scope gating)
    let order: {
      tracking_id: string;
      customer_email: string | null;
      item_description: string;
      item_type?: string;
      estimated_completion_date: string | null;
      location_id: string | null;
    } | null = null;

    if (orderType === "repair") {
      const { data } = await admin
        .from("repairs")
        .select("tracking_id, customer_email, item_description, item_type, estimated_completion_date, location_id")
        .eq("id", orderId)
        .eq("tenant_id", tenantId)
        .single();
      order = data;
    } else {
      // bespoke_jobs has `jewellery_type`, NOT `item_type`. Selecting
      // item_type returned PGRST204 → order stayed null → 404 "Order not
      // found" for every bespoke tracking-email retry. Customers of bespoke
      // jobs never received the resend-tracking-link email.
      const { data } = await admin
        .from("bespoke_jobs")
        .select("tracking_id, customer_email, description, jewellery_type, estimated_completion_date, location_id")
        .eq("id", orderId)
        .eq("tenant_id", tenantId)
        .single();
      if (data) {
        order = {
          tracking_id: data.tracking_id,
          customer_email: data.customer_email,
          item_description: data.description,
          item_type: data.jewellery_type,
          estimated_completion_date: data.estimated_completion_date,
          location_id: data.location_id,
        };
      }
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // W2-006: tracking email must only be sendable by staff whose
    // allowed_location_ids include the order's location.
    try {
      await assertUserCanAccessLocation(user.id, tenantId, order.location_id);
    } catch (e) {
      if (e instanceof LocationAccessDeniedError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw e;
    }

    if (!order.customer_email) {
      return NextResponse.json(
        { error: "No customer email on order" },
        { status: 400 }
      );
    }

    // Get tenant info for business name
    const { data: tenant } = await admin
      .from("tenants")
      .select("business_name")
      .eq("id", tenantId)
      .single();

    const businessName = tenant?.business_name || "Your Jeweller";
    const trackingUrl = `https://nexpura.com/track/${order.tracking_id}`;
    const orderTypeLabel = orderType === "repair" ? "Repair" : "Bespoke Order";

    // Sandbox short-circuit — preview/dev/SANDBOX_MODE must never hit real
    // customer inboxes. Returns a synthetic messageId + logs the intent so
    // QA can verify what would have gone out.
    if (isSandbox()) {
      logSandboxSuppressedSend({
        channel: "email",
        to: order.customer_email,
        subject: `Your ${orderTypeLabel} - Tracking ID: ${order.tracking_id}`,
      });
      return NextResponse.json({
        success: true,
        messageId: "sandbox-suppressed",
        trackingId: order.tracking_id,
      });
    }

    // Resolve the Resend client lazily; fail cleanly if the key isn't set.
    const resendResult = getTrackingResendOrError();
    if ("error" in resendResult) {
      logger.error("[tracking/send-email] " + resendResult.error);
      return NextResponse.json(
        { error: "Email service unavailable. Please contact support." },
        { status: 500 }
      );
    }
    const trackingResend = resendResult.client;

    // Send email
    const { data: emailResult, error: emailError } = await trackingResend.emails.send({
      from: `${businessName} <noreply@nexpura.com>`,
      to: order.customer_email,
      subject: `Your ${orderTypeLabel} - Tracking ID: ${order.tracking_id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <!-- Logo/Header -->
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="width: 48px; height: 48px; background: #1a1a1a; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                  <span style="color: white; font-weight: bold; font-size: 24px;">N</span>
                </div>
                <h1 style="margin: 16px 0 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                  ${businessName}
                </h1>
              </div>

              <!-- Content -->
              <div style="text-align: center;">
                <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px;">
                  Thank you for your ${orderTypeLabel.toLowerCase()}. Here are your order details:
                </p>

                <!-- Order Card -->
                <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: left;">
                  <div style="margin-bottom: 16px;">
                    <span style="display: inline-block; padding: 4px 12px; background: ${orderType === 'repair' ? '#dbeafe' : '#f3e8ff'}; color: ${orderType === 'repair' ? '#1d4ed8' : '#7c3aed'}; border-radius: 9999px; font-size: 12px; font-weight: 500;">
                      ${orderTypeLabel}
                    </span>
                  </div>
                  <p style="margin: 0 0 8px; color: #1a1a1a; font-weight: 600;">
                    ${order.item_type || 'Jewellery Item'}
                  </p>
                  <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">
                    ${order.item_description}
                  </p>
                  ${order.estimated_completion_date ? `
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      <strong>Est. Completion:</strong> ${new Date(order.estimated_completion_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  ` : ''}
                </div>

                <!-- Tracking ID -->
                <div style="margin-bottom: 32px;">
                  <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">
                    Tracking ID
                  </p>
                  <p style="margin: 0; font-family: monospace; font-size: 20px; font-weight: 600; color: #1a1a1a; background: #f3f4f6; padding: 12px 24px; border-radius: 8px; display: inline-block;">
                    ${order.tracking_id}
                  </p>
                </div>

                <!-- CTA Button -->
                <a href="${trackingUrl}" style="display: inline-block; background: #1a1a1a; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                  Track Your Order
                </a>

                <p style="margin: 24px 0 0; color: #9ca3af; font-size: 14px;">
                  Or copy this link: <a href="${trackingUrl}" style="color: #6b7280;">${trackingUrl}</a>
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 24px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Powered by <a href="https://nexpura.com" style="color: #1a1a1a; font-weight: 600; text-decoration: none;">Nexpura</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      logger.error("[tracking/send-email] Failed to send:", emailError);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    logger.info(`[tracking/send-email] Sent tracking email for ${order.tracking_id} to ${order.customer_email}`);

    return NextResponse.json({
      success: true,
      messageId: emailResult?.id,
      trackingId: order.tracking_id,
    });
  } catch (error) {
    logger.error("[tracking/send-email] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
