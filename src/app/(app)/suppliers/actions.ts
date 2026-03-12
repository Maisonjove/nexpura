"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const str = (key: string) => (formData.get(key) as string) || null;

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      tenant_id: tenantId,
      name: (formData.get("name") as string).trim(),
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

  redirect(`/suppliers/${data.id}`);
}

export async function updateSupplier(
  id: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const str = (key: string) => (formData.get(key) as string) || null;

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: (formData.get("name") as string).trim(),
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
  redirect(`/suppliers/${id}`);
}

export async function deleteSupplier(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  redirect("/suppliers");
}
