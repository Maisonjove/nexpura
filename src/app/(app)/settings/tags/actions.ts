"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, updateTag } from "next/cache"
import { logger } from "@/lib/logger"
import { requireAuth, requireRole } from "@/lib/auth-context"

import { flushSentry } from "@/lib/sentry-flush";
async function getTenantId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("tenant_id").eq("id", user.id).single()
  if (!data?.tenant_id) throw new Error("No tenant")
  return { supabase, tenantId: data.tenant_id as string }
}

// Note: `getTagTemplates()` was removed in the cacheComponents-migration
// refactor of page.tsx. The same read is now split into
// `resolveTenantId()` + `loadTagTemplatesByTenant(tenantId)` inside
// page.tsx — this separates the request-time cookies/auth access from
// the per-tenant DB read, so the latter can be marked `'use cache'`
// once the global cacheComponents flag is flipped. The server actions
// below (create/update/delete/setDefault) continue to use the single
// `getTenantId()` helper because they run at request time via
// formAction/startTransition from the client, not during the page
// render. Their cookie access is therefore safe under cacheComponents
// already.

export async function createTagTemplate(formData: FormData) {
  try {
    // Group 15 audit: tag templates configure printed stock labels — they
    // determine what data leaves the building on every printed tag (price,
    // SKU, store name). Pre-fix only deleteTagTemplate was role-gated;
    // create/update were callable by any authenticated tenant member, so
    // a salesperson could ship a template that hides the price field or
    // reduces font sizes. Bringing this in line with the delete gate.
    try {
      await requireRole("owner", "manager");
    } catch {
      return { error: "Only owner or manager can create tag templates." };
    }
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
    if (error) return { error: error.message }
    revalidatePath("/settings/tags")
    updateTag(`tag-templates:${tenantId}`)
    return { success: true }
  } catch (error) {
    logger.error("createTagTemplate failed", { error })
    await flushSentry();
    return { error: "Operation failed" }
  }
}

export async function updateTagTemplate(id: string, formData: FormData) {
  try {
    // Same gate as createTagTemplate (Group 15 audit fix).
    try {
      await requireRole("owner", "manager");
    } catch {
      return { error: "Only owner or manager can update tag templates." };
    }
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
    if (error) return { error: error.message }
    revalidatePath("/settings/tags")
    updateTag(`tag-templates:${tenantId}`)
    return { success: true }
  } catch (error) {
    logger.error("updateTagTemplate failed", { error })
    await flushSentry();
    return { error: "Operation failed" }
  }
}

export async function deleteTagTemplate(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    // RBAC: tag templates configure printed stock labels. Owner/manager only.
    const authCtx = await requireAuth()
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can delete tag templates." }
    }
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
    updateTag(`tag-templates:${tenantId}`)
    return { success: true }
  } catch (error) {
    logger.error("deleteTagTemplate failed", { error })
    await flushSentry();
    return { error: "Operation failed" }
  }
}

export async function setDefaultTemplate(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    // Group 15 audit: changing the default template changes which template
    // every staff print job picks up by default. Same gate as the rest of
    // the tag-template mutations.
    try {
      await requireRole("owner", "manager");
    } catch {
      return { error: "Only owner or manager can change the default tag template." };
    }
    const { supabase, tenantId } = await getTenantId()

    // Unset all defaults first. Group 15 audit: the prior version of this
    // action had a bare `await supabase.from(...).update(...)` here with no
    // {error} destructure — the systemic swallowed-update pattern Joey
    // flagged. Capture + surface it so a partial state ("unset succeeded
    // but new default-set fails") can't leave the tenant with zero
    // defaults silently.
    const { error: clearErr } = await supabase
      .from("stock_tag_templates")
      .update({ is_default: false })
      .eq("tenant_id", tenantId)
    if (clearErr) return { error: clearErr.message }

    const { error } = await supabase
      .from("stock_tag_templates")
      .update({ is_default: true })
      .eq("id", id)
      .eq("tenant_id", tenantId)
    if (error) return { error: error.message }
    revalidatePath("/settings/tags")
    updateTag(`tag-templates:${tenantId}`)
    return { success: true }
  } catch (error) {
    logger.error("setDefaultTemplate failed", { error })
    await flushSentry();
    return { error: "Operation failed" }
  }
}
