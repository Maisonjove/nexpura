"use server"

import { createClient } from "@/lib/supabase/server"

async function getTenantId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data } = await supabase.from("users").select("tenant_id").eq("id", user.id).single()
  if (!data?.tenant_id) throw new Error("No tenant")
  return { supabase, tenantId: data.tenant_id as string, userId: user.id }
}

export async function getNotifications() {
  try {
    const { supabase, tenantId } = await getTenantId()
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(30)
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: String(e) }
  }
}

export async function markAsRead(id: string) {
  try {
    const { supabase, tenantId } = await getTenantId()
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("tenant_id", tenantId)
    if (error) return { error: error.message }
    return { success: true }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function markAllAsRead() {
  try {
    const { supabase, tenantId } = await getTenantId()
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("tenant_id", tenantId)
      .eq("is_read", false)
    if (error) return { error: error.message }
    return { success: true }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const { supabase, tenantId } = await getTenantId()
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_read", false)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}
