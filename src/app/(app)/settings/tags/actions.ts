"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function getTenantId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data } = await supabase.from("users").select("tenant_id").eq("id", user.id).single()
  if (!data?.tenant_id) throw new Error("No tenant")
  return { supabase, tenantId: data.tenant_id as string }
}

export async function getTagTemplates() {
  const { supabase, tenantId } = await getTenantId()
  const { data } = await supabase
    .from("stock_tag_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
  return data ?? []
}

export async function createTagTemplate(formData: FormData) {
  const { supabase, tenantId } = await getTenantId()

  const { error } = await supabase.from("stock_tag_templates").insert({
    tenant_id: tenantId,
    name: formData.get("name") as string,
    width_mm: parseInt(formData.get("width_mm") as string) || 50,
    height_mm: parseInt(formData.get("height_mm") as string) || 25,
    orientation: (formData.get("orientation") as string) || "landscape",
    show_price: formData.get("show_price") === "true",
    show_sku: formData.get("show_sku") === "true",
    show_barcode: formData.get("show_barcode") === "true",
    show_qr: formData.get("show_qr") === "true",
    show_metal: formData.get("show_metal") === "true",
    show_stone: formData.get("show_stone") === "true",
    show_weight: formData.get("show_weight") === "true",
    show_store_name: formData.get("show_store_name") === "true",
    font_size_name: parseInt(formData.get("font_size_name") as string) || 10,
    font_size_details: parseInt(formData.get("font_size_details") as string) || 7,
    font_size_price: parseInt(formData.get("font_size_price") as string) || 11,
    is_default: false,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/settings/tags")
}

export async function updateTagTemplate(id: string, formData: FormData) {
  const { supabase, tenantId } = await getTenantId()

  const { error } = await supabase
    .from("stock_tag_templates")
    .update({
      name: formData.get("name") as string,
      width_mm: parseInt(formData.get("width_mm") as string) || 50,
      height_mm: parseInt(formData.get("height_mm") as string) || 25,
      orientation: (formData.get("orientation") as string) || "landscape",
      show_price: formData.get("show_price") === "true",
      show_sku: formData.get("show_sku") === "true",
      show_barcode: formData.get("show_barcode") === "true",
      show_qr: formData.get("show_qr") === "true",
      show_metal: formData.get("show_metal") === "true",
      show_stone: formData.get("show_stone") === "true",
      show_weight: formData.get("show_weight") === "true",
      show_store_name: formData.get("show_store_name") === "true",
      font_size_name: parseInt(formData.get("font_size_name") as string) || 10,
      font_size_details: parseInt(formData.get("font_size_details") as string) || 7,
      font_size_price: parseInt(formData.get("font_size_price") as string) || 11,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)
  if (error) throw new Error(error.message)
  revalidatePath("/settings/tags")
}

export async function deleteTagTemplate(id: string): Promise<{ success?: boolean; error?: string }> {
  const { supabase, tenantId } = await getTenantId()

  // Check count — can't delete if only one
  const { count } = await supabase
    .from("stock_tag_templates")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
  if ((count ?? 0) <= 1) return { error: "Cannot delete the only template" }

  const { error } = await supabase
    .from("stock_tag_templates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
  if (error) return { error: error.message }
  revalidatePath("/settings/tags")
  return { success: true }
}

export async function setDefaultTemplate(id: string): Promise<{ success?: boolean; error?: string }> {
  const { supabase, tenantId } = await getTenantId()

  // Unset all defaults first
  await supabase
    .from("stock_tag_templates")
    .update({ is_default: false })
    .eq("tenant_id", tenantId)

  const { error } = await supabase
    .from("stock_tag_templates")
    .update({ is_default: true })
    .eq("id", id)
    .eq("tenant_id", tenantId)
  if (error) return { error: error.message }
  revalidatePath("/settings/tags")
  return { success: true }
}
