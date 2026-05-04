import { withSentryFlush } from "@/lib/sentry-flush";
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendAccountSuspendedEmail, sendGracePeriod24hEmail } from "@/lib/email/send"
import { safeBearerMatch } from "@/lib/timing-safe-compare"
import { NEXPURA_DOGFOOD_TENANT_ID } from "@/lib/dogfood-tenant"
import logger from "@/lib/logger"

export const GET = withSentryFlush(async (request: NextRequest) => {
  // Verify cron secret — constant-time compare to block timing-attack
  // recovery of CRON_SECRET over repeated probes.
  const authHeader = request.headers.get("authorization")
  if (!safeBearerMatch(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
  const admin = createAdminClient()
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Find expired grace periods → suspend. Joey 2026-05-03 P2-G audit:
  // exclude soft-deleted tenants and the dogfood tenant. Without this
  // skip, soft-deleted tenants stuck in payment_required get suspend
  // emails sent to former owners, and the dogfood tenant could end up
  // suspended if anything ever flips its status to payment_required.
  const { data: expired } = await admin
    .from("subscriptions")
    .select("id, tenant_id, tenants!inner(deleted_at)")
    .eq("status", "payment_required")
    .lt("grace_period_ends_at", now.toISOString())
    .is("tenants.deleted_at", null)
    .neq("tenant_id", NEXPURA_DOGFOOD_TENANT_ID)

  // Capture-amplification fix (no-logger-error-in-loop): collect
  // per-iteration failures into arrays and log ONCE after each loop
  // ends, so a many-tenant batch of failures doesn't blow past the
  // PromiseBuffer cap.
  const expiredFailures: Array<{ phase: string; subId?: string; tenantId?: string; err: { message: string } }> = []

  for (const sub of expired ?? []) {
    const { error: subErr } = await admin.from("subscriptions").update({ status: "suspended" }).eq("id", sub.id)
    if (subErr) {
      expiredFailures.push({ phase: "suspend_update", subId: sub.id, err: subErr })
      continue
    }

    // Get tenant owner email
    const { data: owner } = await admin
      .from("users")
      .select("email, full_name")
      .eq("tenant_id", sub.tenant_id)
      .eq("role", "owner")
      .single()

    if (owner?.email) {
      await sendAccountSuspendedEmail(owner.email, owner.full_name ?? "there")
    }

    // Create in-app notification
    const { error: notifErr } = await admin.from("notifications").insert({
      tenant_id: sub.tenant_id,
      type: "account_suspended",
      title: "Account suspended",
      body: "Your account has been suspended due to non-payment. Pay to reactivate.",
      link: "/billing",
    })
    if (notifErr) {
      expiredFailures.push({ phase: "suspended_notification_insert", tenantId: sub.tenant_id, err: notifErr })
    }
  }
  if (expiredFailures.length > 0) {
    logger.error(
      `[cron/grace-period-checker] expired-batch had ${expiredFailures.length} failure(s)`,
      { count: expiredFailures.length, failures: expiredFailures },
    )
  }

  // Find 24h warnings not yet sent — same dogfood + soft-delete exclusions.
  const { data: warning24h } = await admin
    .from("subscriptions")
    .select("id, tenant_id, tenants!inner(deleted_at)")
    .eq("status", "payment_required")
    .eq("grace_24h_sent", false)
    .lt("grace_period_ends_at", in24h.toISOString())
    .gt("grace_period_ends_at", now.toISOString())
    .is("tenants.deleted_at", null)
    .neq("tenant_id", NEXPURA_DOGFOOD_TENANT_ID)

  const warning24hFailures: Array<{ phase: string; subId?: string; tenantId?: string; err: { message: string } }> = []

  for (const sub of warning24h ?? []) {
    const { error: warnUpdErr } = await admin.from("subscriptions").update({ grace_24h_sent: true }).eq("id", sub.id)
    if (warnUpdErr) {
      warning24hFailures.push({ phase: "grace_24h_sent_update", subId: sub.id, err: warnUpdErr })
      continue
    }

    const { data: owner } = await admin
      .from("users")
      .select("email, full_name")
      .eq("tenant_id", sub.tenant_id)
      .eq("role", "owner")
      .single()

    if (owner?.email) {
      await sendGracePeriod24hEmail(owner.email, owner.full_name ?? "there")
    }

    const { error: warnNotifErr } = await admin.from("notifications").insert({
      tenant_id: sub.tenant_id,
      type: "grace_period_24h",
      title: "24 hours to pay",
      body: "Your account will be suspended in 24 hours if payment is not received.",
      link: "/billing",
    })
    if (warnNotifErr) {
      warning24hFailures.push({ phase: "warning24h_notification_insert", tenantId: sub.tenant_id, err: warnNotifErr })
    }
  }
  if (warning24hFailures.length > 0) {
    logger.error(
      `[cron/grace-period-checker] warning-batch had ${warning24hFailures.length} failure(s)`,
      { count: warning24hFailures.length, failures: warning24hFailures },
    )
  }

  return NextResponse.json({
    ok: true,
    expired: expired?.length ?? 0,
    warned: warning24h?.length ?? 0,
  })
  } catch (err) {
    // Audit finding (Medium): cron routes had no error handling; a 3am DB
    // timeout went entirely silent, suspended tenants didn't get notified,
    // and no one knew until month-end reports. logger.error routes to
    // Sentry via the wired-up instrumentation.
    logger.error("[cron/grace-period-checker] failed", { error: err })
    return NextResponse.json({ ok: false, error: "cron_failed" }, { status: 500 })
  }
});
