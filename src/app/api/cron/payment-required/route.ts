import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFreeToPaidConversionEmail } from "@/lib/email/send";
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import { withSentryFlush } from "@/lib/sentry-flush";
import logger from "@/lib/logger";

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

  // Update subscription status. Destructive return-error: this is
  // billing state-of-record. A silent failure here means the
  // subscription row keeps its old status (e.g. still "trialing")
  // while the tenant row below may flip to grace_period — drift
  // between the two billing surfaces, and the 48h timer never starts
  // ticking against THIS row, so the next cron pass won't suspend.
  // 500 forces the admin operator (or Vercel cron retry) to retry.
  const { error: subErr } = await admin
    .from("subscriptions")
    .update({
      status: "payment_required",
      grace_period_ends_at: graceEnd,
      grace_24h_sent: false,
    })
    .eq("tenant_id", tenantId);
  if (subErr) {
    logger.error("[payment-required] subscriptions.status -> payment_required failed", {
      tenantId, err: subErr,
    });
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }

  // Update tenant subscription status. Destructive return-error: same
  // billing state-of-record reasoning. If the subscriptions row updated
  // (above) but the tenants row fails, the gating middleware (which
  // reads tenants.subscription_status) won't enforce grace-period UX,
  // and the 48h deadline on tenants.grace_period_ends_at never lands.
  const { error: tenErr } = await admin
    .from("tenants")
    .update({
      subscription_status: "grace_period",
      grace_period_ends_at: graceEnd,
      payment_required_notified_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  if (tenErr) {
    logger.error("[payment-required] tenants.subscription_status -> grace_period failed", {
      tenantId, err: tenErr,
    });
    return NextResponse.json({ error: tenErr.message }, { status: 500 });
  }

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

  // In-app notification. Cron-runner log+continue: the billing
  // state-of-record writes (subscriptions + tenants) already
  // succeeded above and the conversion email was already sent —
  // a missing notifications row is UX-only (no in-app banner), not
  // billing drift. Log it; don't 500 the admin trigger after the
  // canonical state already moved.
  const { error: notifErr } = await admin.from("notifications").insert({
    tenant_id: tenantId,
    type: "payment_required",
    title: "Payment required",
    body: "Your free access is ending. Add payment within 48 hours to avoid suspension.",
    link: "/billing",
  });
  if (notifErr) {
    logger.error("[payment-required] in-app notification insert failed (non-fatal — billing state already updated, email sent)", {
      tenantId, err: notifErr,
    });
  }

  return NextResponse.json({ ok: true, graceEnd });
});
