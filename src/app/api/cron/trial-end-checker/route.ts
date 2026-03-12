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

  // Expired trials → suspend
  const { data: expired } = await admin
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("status", "trialing")
    .lt("trial_ends_at", now.toISOString())

  for (const sub of expired ?? []) {
    await admin.from("subscriptions").update({ status: "suspended" }).eq("id", sub.id)

    await admin.from("notifications").insert({
      tenant_id: sub.tenant_id,
      type: "trial_expired",
      title: "Your trial has ended",
      body: "Your account has been suspended. Choose a plan to continue.",
      link: "/billing",
    })
  }

  return NextResponse.json({
    ok: true,
    endingSoon: endingSoon?.length ?? 0,
    expired: expired?.length ?? 0,
  })
}
