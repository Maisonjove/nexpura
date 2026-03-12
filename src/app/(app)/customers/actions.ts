"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function getTenantId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");
  return userData.tenant_id;
}

function buildCustomerData(formData: FormData, tenantId?: string, userId?: string) {
  const firstName = (formData.get("first_name") as string || "").trim();
  const lastName = (formData.get("last_name") as string || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  const rawTags = formData.getAll("tags") as string[];
  const customTagsRaw = formData.get("custom_tags") as string;
  const customTags = customTagsRaw
    ? customTagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const tags = [...rawTags, ...customTags];

  return {
    ...(tenantId && { tenant_id: tenantId }),
    ...(userId && { created_by: userId }),
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    email: (formData.get("email") as string) || null,
    mobile: (formData.get("mobile") as string) || null,
    phone: (formData.get("phone") as string) || null,
    address_line1: (formData.get("address_line1") as string) || null,
    suburb: (formData.get("suburb") as string) || null,
    state: (formData.get("state") as string) || null,
    postcode: (formData.get("postcode") as string) || null,
    country: (formData.get("country") as string) || "Australia",
    ring_size: (formData.get("ring_size") as string) || null,
    preferred_metal: (formData.get("preferred_metal") as string) || null,
    birthday: (formData.get("birthday") as string) || null,
    anniversary: (formData.get("anniversary") as string) || null,
    tags: tags.length > 0 ? tags : null,
    is_vip: tags.includes("VIP"),
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createCustomer(formData: FormData): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return { error: "No tenant found" };

  const customerData = buildCustomerData(formData, userData.tenant_id, user.id);

  const { data, error } = await supabase
    .from("customers")
    .insert(customerData)
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function updateCustomer(
  id: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // Verify ownership
  const tenantId = await getTenantId().catch(() => null);
  if (!tenantId) return { error: "Not authenticated" };

  const customerData = {
    ...buildCustomerData(formData),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("customers")
    .update(customerData)
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function archiveCustomer(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const tenantId = await getTenantId().catch(() => null);
  if (!tenantId) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  redirect("/customers");
}

export async function addCustomerNote(
  customerId: string,
  note: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const tenantId = await getTenantId().catch(() => null);
  if (!tenantId) return { error: "Not authenticated" };

  // Fetch existing notes
  const { data: existing } = await supabase
    .from("customers")
    .select("notes")
    .eq("id", customerId)
    .eq("tenant_id", tenantId)
    .single();

  const timestamp = new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
  const newNote = `[${timestamp}] ${note}`;
  const updatedNotes = existing?.notes
    ? `${existing.notes}\n\n${newNote}`
    : newNote;

  const { error } = await supabase
    .from("customers")
    .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  return { success: true };
}
