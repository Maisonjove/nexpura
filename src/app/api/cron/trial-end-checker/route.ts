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
  const { data: endingSoon } = await admin
    .from("subscriptions")
    .select("id, tenant_id, trial_ends_at, tenants!inner(deleted_at, is_free_forever)")
    .eq("status", "trialing")
    .lt("trial_ends_at", in3days.toISOString())
    .gt("trial_ends_at", now.toISOString())
    .is("tenants.deleted_at", null)
    .neq("tenant_id", NEXPURA_DOGFOOD_TENANT_ID)

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
      logger.error("[cron/trial-end-checker] notification insert failed (ending_soon)", {
        tenantId: sub.tenant_id, err: notifErr,
      })
    }
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
      logger.error("[cron/trial-end-checker] subscriptions.update failed", { subId: sub.id, err: subErr })
      continue
    }

    // Also update tenant record
    const { error: tenantErr } = await admin.from("tenants").update({
      subscription_status: "grace_period",
      grace_period_ends_at: graceEnd.toISOString(),
    }).eq("id", sub.tenant_id)
    if (tenantErr) {
      logger.error("[cron/trial-end-checker] tenants.update failed", { tenantId: sub.tenant_id, err: tenantErr })
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
      logger.error("[cron/trial-end-checker] notification insert failed (trial_expired)", {
        tenantId: sub.tenant_id, err: notifExpErr,
      })
    }
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
