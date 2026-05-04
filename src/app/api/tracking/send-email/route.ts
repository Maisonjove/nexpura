import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTrackingEmailInternal } from "@/lib/tracking-email";
import logger from "@/lib/logger";
import { assertUserCanAccessLocation, LocationAccessDeniedError } from "@/lib/auth/assert-location";
import { withSentryFlush } from "@/lib/sentry-flush";

/**
 * Authenticated UI re-send button. Wraps lib/tracking-email's
 * `sendTrackingEmailInternal` with:
 *   1. Session check (W7-CRIT-04: tenant from session, never body)
 *   2. Location-scope guard
 *
 * Server actions that just created the order should call
 * `sendTrackingEmailInternal` directly via lib/tracking#sendTrackingEmail
 * — no need to round-trip through HTTP.
 */

interface SendTrackingEmailRequest {
  orderType: "repair" | "bespoke";
  orderId: string;
}

export const POST = withSentryFlush(async (request: NextRequest) => {
  try {
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
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Resolve location for the gate check before delegating the send.
    const admin = createAdminClient();
    const { data: order } = await admin
      .from(orderType === "repair" ? "repairs" : "bespoke_jobs")
      .select("location_id")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    try {
      await assertUserCanAccessLocation(user.id, tenantId, order.location_id as string | null);
    } catch (e) {
      if (e instanceof LocationAccessDeniedError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw e;
    }

    const result = await sendTrackingEmailInternal({ tenantId, orderType, orderId });
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      trackingId: result.trackingId,
    });
  } catch (error) {
    logger.error("[tracking/send-email] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
