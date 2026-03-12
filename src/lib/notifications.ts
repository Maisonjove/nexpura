"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export async function createNotification({
  tenantId,
  userId,
  type,
  title,
  body,
  link,
}: {
  tenantId: string
  userId?: string | null
  type: string
  title: string
  body?: string
  link?: string
}) {
  const admin = createAdminClient()
  await admin.from("notifications").insert({
    tenant_id: tenantId,
    user_id: userId ?? null,
    type,
    title,
    body: body ?? null,
    link: link ?? null,
  })
}
