import { withSentryFlush } from "@/lib/sentry-flush";
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTrialEndingSoonEmail } from "@/lib/email/send"
import { safeBearerMatch } from "@/lib/timing-safe-compare"
import { NEXPURA_DOGFOOD_TENANT_ID } from "@/lib/dogfood-tenant"
import logger from "@/lib/logger"

export const GET = withSentryFlush(async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization")
  if (!safeBearerMatch(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
  const admin = createAdminClient()
  const now = new Date()
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  // Trial ending soon (within 3 days). Joey 2026-05-03 P2-G audit:
  // exclude soft-deleted tenants (their trials shouldn't trigger
  // cancellation emails to former owners) and exclude the dogfood
  // tenant by id (NEXPURA_DOGFOOD_TENANT_ID is the canonical
  // free-forever exemption — without this skip, the dogfood tenant's
  // 14-day trial expiry would fire payment_required and auto-suspend
  // Joey's own ops/test surface).
  //
  // Idempotency (cleanup #9, Joey 2026-05-04): we only send the
  // ending-soon reminder ONCE per trial. Pre-fix, a 3-day-out trial
  // would receive the email on each of the 3 daily cron runs —
  // jewellers found this nagging. Filter on
  // `trial_ending_soon_sent_at IS NULL` so already-reminded subs are
  // skipped. The flag is reset to NULL on subscription updates that
  // change trial_ends_at (renewal, plan change) — see callers that
  // touch trial_ends_at for the matching reset writes.
  const { data: endingSoon } = await admin
    .from("subscriptions")
    .select("id, tenant_id, trial_ends_at, tenants!inner(deleted_at, is_free_forever)")
    .eq("status", "trialing")
    .lt("trial_ends_at", in3days.toISOString())
    .gt("trial_ends_at", now.toISOString())
    .is("trial_ending_soon_sent_at", null)
    .is("tenants.deleted_at", null)
    .neq("tenant_id", NEXPURA_DOGFOOD_TENANT_ID)

  // Capture-amplification fix (no-logger-error-in-loop): collect
  // per-tenant failures into arrays and log ONCE after each loop.
  const endingSoonFailures: Array<{ tenantId: string; err: { message: string } }> = []

  // Send trial_ending_soon emails
  for (const sub of endingSoon ?? []) {
    const { data: owner } = await admin
      .from("users")
      .select("email, full_name")
      .eq("tenant_id", sub.tenant_id)
      .eq("role", "owner")
      .single()

    if (owner?.email) {
      await sendTrialEndingSoonEmail(owner.email, owner.full_name ?? "there", sub.trial_ends_at)
    }

    // In-app notification. Joey 2026-05-03 P2-G audit: capture {error}
    // so a silent failure (RLS, schema drift) shows up in logs.
    const trialEnd = new Date(sub.trial_ends_at)
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const { error: notifErr } = await admin.from("notifications").insert({
      tenant_id: sub.tenant_id,
      type: "trial_ending_soon",
      title: `Your trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      body: "Upgrade now to keep your data and features.",
      link: "/billing",
    })
    if (notifErr) {
      endingSoonFailures.push({ tenantId: sub.tenant_id, err: notifErr })
    }

    // Idempotency mark — only flip the flag if we actually got
    // through email + notification. If the notification insert
    // failed, we keep the flag NULL so the next run will retry.
    // (Email sends already swallow internal failures via the email/
    // send wrapper; if Resend is down the email isn't actually sent,
    // but the cron will not retry until the next day — acceptable
    // trade-off given Resend uptime.)
    if (!notifErr) {
      const { error: markErr } = await admin
        .from("subscriptions")
        .update({ trial_ending_soon_sent_at: now.toISOString() })
        .eq("id", sub.id)
      if (markErr) {
        endingSoonFailures.push({ tenantId: sub.tenant_id, err: markErr })
      }
    }
  }
  if (endingSoonFailures.length > 0) {
    logger.error(
      `[cron/trial-end-checker] ending_soon notification insert failed for ${endingSoonFailures.length} tenant(s)`,
      { count: endingSoonFailures.length, failures: endingSoonFailures },
    )
  }

  // Expired trials → start 48h grace period (NOT immediate suspend).
  // Same dogfood + soft-delete exclusions as the ending-soon branch.
  const { data: expired } = await admin
    .from("subscriptions")
    .select("id, tenant_id, tenants!inner(deleted_at, is_free_forever)")
    .eq("status", "trialing")
    .lt("trial_ends_at", now.toISOString())
    .is("tenants.deleted_at", null)
    .neq("tenant_id", NEXPURA_DOGFOOD_TENANT_ID)

  const graceEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000) // 48 hours from now
  // Capture-amplification fix — collect per-tenant failures, log
  // once after the loop.
  const expiredFailures: Array<{ phase: string; subId?: string; tenantId?: string; err: { message: string } }> = []

  for (const sub of expired ?? []) {
    // Start grace period instead of suspending. Joey 2026-05-03
    // P2-G audit: capture {error} so a silent failure on either
    // update (RLS, schema drift, FK constraint) shows up in logs
    // rather than leaving the user in an inconsistent state.
    const { error: subErr } = await admin.from("subscriptions").update({
      status: "payment_required",
      grace_period_ends_at: graceEnd.toISOString(),
    }).eq("id", sub.id)
    if (subErr) {
      expiredFailures.push({ phase: "subscriptions_update", subId: sub.id, err: subErr })
      continue
    }

    // Also update tenant record
    const { error: tenantErr } = await admin.from("tenants").update({
      subscription_status: "grace_period",
      grace_period_ends_at: graceEnd.toISOString(),
    }).eq("id", sub.tenant_id)
    if (tenantErr) {
      expiredFailures.push({ phase: "tenants_update", tenantId: sub.tenant_id, err: tenantErr })
    }

    // Get owner for email
    const { data: owner } = await admin
      .from("users")
      .select("email, full_name")
      .eq("tenant_id", sub.tenant_id)
      .eq("role", "owner")
      .single()

    // Send payment required email
    if (owner?.email) {
      const { sendGracePeriodStartedEmail } = await import("@/lib/email/send")
      const deadline = graceEnd.toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Australia/Sydney",
      })
      await sendGracePeriodStartedEmail(
        owner.email, 
        owner.full_name ?? "there",
        deadline,
        `${process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com"}/billing`
      )
    }

    const { error: notifExpErr } = await admin.from("notifications").insert({
      tenant_id: sub.tenant_id,
      type: "trial_expired",
      title: "Your trial has ended — 48h to upgrade",
      body: "Add payment details within 48 hours to keep your account. After that, your account will be suspended.",
      link: "/billing",
    })
    if (notifExpErr) {
      expiredFailures.push({ phase: "trial_expired_notification_insert", tenantId: sub.tenant_id, err: notifExpErr })
    }
  }
  if (expiredFailures.length > 0) {
    logger.error(
      `[cron/trial-end-checker] expired-batch had ${expiredFailures.length} failure(s)`,
      { count: expiredFailures.length, failures: expiredFailures },
    )
  }

  return NextResponse.json({
    ok: true,
    endingSoon: endingSoon?.length ?? 0,
    expired: expired?.length ?? 0,
  })
  } catch (err) {
    logger.error("[cron/trial-end-checker] failed", { error: err })
    return NextResponse.json({ ok: false, error: "cron_failed" }, { status: 500 })
  }
});
