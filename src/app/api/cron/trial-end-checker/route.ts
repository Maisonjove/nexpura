import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTrialEndingSoonEmail } from "@/lib/email/send"

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  // Trial ending soon (within 3 days)
  const { data: endingSoon } = await admin
    .from("subscriptions")
    .select("id, tenant_id, trial_ends_at")
    .eq("status", "trialing")
    .lt("trial_ends_at", in3days.toISOString())
    .gt("trial_ends_at", now.toISOString())

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

    // In-app notification
    const trialEnd = new Date(sub.trial_ends_at)
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    await admin.from("notifications").insert({
      tenant_id: sub.tenant_id,
      type: "trial_ending_soon",
      title: `Your trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      body: "Upgrade now to keep your data and features.",
      link: "/billing",
    })
  }

  // Expired trials → start 48h grace period (NOT immediate suspend)
  const { data: expired } = await admin
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("status", "trialing")
    .lt("trial_ends_at", now.toISOString())

  const graceEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000) // 48 hours from now

  for (const sub of expired ?? []) {
    // Start grace period instead of suspending
    await admin.from("subscriptions").update({ 
      status: "payment_required",
      grace_period_ends_at: graceEnd.toISOString(),
    }).eq("id", sub.id)

    // Also update tenant record
    await admin.from("tenants").update({
      subscription_status: "grace_period",
      grace_period_ends_at: graceEnd.toISOString(),
    }).eq("id", sub.tenant_id)

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

    await admin.from("notifications").insert({
      tenant_id: sub.tenant_id,
      type: "trial_expired",
      title: "Your trial has ended — 48h to upgrade",
      body: "Add payment details within 48 hours to keep your account. After that, your account will be suspended.",
      link: "/billing",
    })
  }

  return NextResponse.json({
    ok: true,
    endingSoon: endingSoon?.length ?? 0,
    expired: expired?.length ?? 0,
  })
}
