import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFreeToPaidConversionEmail } from "@/lib/email/send";
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import { withSentryFlush } from "@/lib/sentry-flush";

/**
 * POST /api/cron/payment-required
 * Can be called by admin to start a 48h grace period for a tenant
 * Body: { tenantId: string }
 *
 * Joey 2026-05-03 P2-G audit: this endpoint is POST-only by design
 * (admin-triggered for a specific tenantId), but vercel.json had it
 * scheduled as a daily cron. Vercel Cron sends GET, so the daily
 * cron was hitting POST → 405 Method Not Allowed every day since
 * the schedule was added — i.e., the cron has never executed.
 * Removed from vercel.json so the cron stops bouncing. The admin-
 * triggered POST flow is preserved for ad-hoc ops use. The actual
 * "scan for tenants whose trial expired and put them in grace"
 * logic lives in trial-end-checker (which runs daily 00:00 UTC).
 */
export const POST = withSentryFlush(async (request: NextRequest) => {
  // Accept ONLY CRON_SECRET. Previously the service_role key was
  // accepted as a fallback bearer — that's a wildly over-privileged
  // credential for cron invocation and leaked anywhere (Vercel env
  // export, log line, deploy preview) would hand an attacker the
  // entire database.
  const authHeader = request.headers.get("authorization");
  if (!safeBearerMatch(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = await request.json();
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const graceEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  // Update subscription status
  await admin
    .from("subscriptions")
    .update({
      status: "payment_required",
      grace_period_ends_at: graceEnd,
      grace_24h_sent: false,
    })
    .eq("tenant_id", tenantId);

  // Update tenant subscription status
  await admin
    .from("tenants")
    .update({
      subscription_status: "grace_period",
      grace_period_ends_at: graceEnd,
      payment_required_notified_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  // Send email to tenant owner
  const { data: owner } = await admin
    .from("users")
    .select("email, full_name")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .single();

  if (owner?.email) {
    const deadline = new Date(graceEnd).toLocaleString("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Australia/Sydney",
    });
    await sendFreeToPaidConversionEmail(owner.email, owner.full_name ?? "there", deadline);
  }

  // Notification
  await admin.from("notifications").insert({
    tenant_id: tenantId,
    type: "payment_required",
    title: "Payment required",
    body: "Your free access is ending. Add payment within 48 hours to avoid suspension.",
    link: "/billing",
  });

  return NextResponse.json({ ok: true, graceEnd });
});
