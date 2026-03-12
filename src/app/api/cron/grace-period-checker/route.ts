import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendAccountSuspendedEmail, sendGracePeriod24hEmail } from "@/lib/email/send"

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Find expired grace periods → suspend
  const { data: expired } = await admin
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("status", "payment_required")
    .lt("grace_period_ends_at", now.toISOString())

  for (const sub of expired ?? []) {
    await admin.from("subscriptions").update({ status: "suspended" }).eq("id", sub.id)

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
    await admin.from("notifications").insert({
      tenant_id: sub.tenant_id,
      type: "account_suspended",
      title: "Account suspended",
      body: "Your account has been suspended due to non-payment. Pay to reactivate.",
      link: "/billing",
    })
  }

  // Find 24h warnings not yet sent
  const { data: warning24h } = await admin
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("status", "payment_required")
    .eq("grace_24h_sent", false)
    .lt("grace_period_ends_at", in24h.toISOString())
    .gt("grace_period_ends_at", now.toISOString())

  for (const sub of warning24h ?? []) {
    await admin.from("subscriptions").update({ grace_24h_sent: true }).eq("id", sub.id)

    const { data: owner } = await admin
      .from("users")
      .select("email, full_name")
      .eq("tenant_id", sub.tenant_id)
      .eq("role", "owner")
      .single()

    if (owner?.email) {
      await sendGracePeriod24hEmail(owner.email, owner.full_name ?? "there")
    }

    await admin.from("notifications").insert({
      tenant_id: sub.tenant_id,
      type: "grace_period_24h",
      title: "24 hours to pay",
      body: "Your account will be suspended in 24 hours if payment is not received.",
      link: "/billing",
    })
  }

  return NextResponse.json({
    ok: true,
    expired: expired?.length ?? 0,
    warned: warning24h?.length ?? 0,
  })
}
