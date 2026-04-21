"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, requirePermission } from "@/lib/auth-context";

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  return { supabase, userId: user.id, tenantId: userData.tenant_id };
}

export async function getSuppliers() {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { data: null, error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, contact_name, email, phone, website, created_at")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  return { data, error: error?.message ?? null };
}

export async function getSupplierById(id: string) {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { data: null, error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  return { data, error: error?.message ?? null };
}

export async function createSupplier(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  // W3-MED-02 / W3-RBAC-08: edit_inventory gate + name required.
  try {
    await requirePermission("edit_inventory");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to create suppliers." : "Not authenticated" };
  }

  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  const str = (key: string) => (formData.get(key) as string) || null;
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!name) return { error: "Supplier name is required" };

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      tenant_id: tenantId,
      name,
      contact_name: str("contact_name"),
      email: str("email"),
      phone: str("phone"),
      website: str("website"),
      address: str("address"),
      notes: str("notes"),
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create supplier" };

  // Log audit event
  await logAuditEvent({
    tenantId,
    userId,
    action: "supplier_create",
    entityType: "supplier",
    entityId: data.id,
    newData: { name, email: str("email"), phone: str("phone") },
  });

  revalidatePath("/suppliers");
  redirect(`/suppliers/${data.id}`);
}

export async function updateSupplier(
  id: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  // W3-RBAC-08: edit_inventory gate + name required.
  try {
    await requirePermission("edit_inventory");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to update suppliers." : "Not authenticated" };
  }

  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  const str = (key: string) => (formData.get(key) as string) || null;
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!name) return { error: "Supplier name is required" };

  // Get old data for audit
  const { data: oldData } = await supabase
    .from("suppliers")
    .select("name, email, phone")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error } = await supabase
    .from("suppliers")
    .update({
      name,
      contact_name: str("contact_name"),
      email: str("email"),
      phone: str("phone"),
      website: str("website"),
      address: str("address"),
      notes: str("notes"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  // Log audit event
  await logAuditEvent({
    tenantId,
    userId,
    action: "supplier_update",
    entityType: "supplier",
    entityId: id,
    oldData: oldData || undefined,
    newData: { name, email: str("email"), phone: str("phone") },
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  redirect(`/suppliers/${id}`);
}

export async function deleteSupplier(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  // RBAC: deleting a supplier is destructive and cascades to historical
  // purchase data. Mirror archiveCustomer — owner/manager only.
  try {
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can delete suppliers." };
    }
  } catch {
    return { error: "Not authenticated" };
  }
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  // Get old data for audit
  const { data: oldData } = await supabase
    .from("suppliers")
    .select("name, email, phone")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  // Log audit event
  await logAuditEvent({
    tenantId,
    userId,
    action: "supplier_delete",
    entityType: "supplier",
    entityId: id,
    oldData: oldData || undefined,
  });

  revalidatePath("/suppliers");
  redirect("/suppliers");
}
