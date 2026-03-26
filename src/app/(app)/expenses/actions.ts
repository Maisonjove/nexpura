"use server";

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { logAuditEvent } from "@/lib/audit";

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  return { supabase, userId: user.id, tenantId: userData.tenant_id };
}

export async function getExpenses() {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { data: null, error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { data, error } = await supabase
    .from("expenses")
    .select("id, description, category, amount, invoice_ref, expense_date, created_at")
    .eq("tenant_id", tenantId)
    .order("expense_date", { ascending: false });

  return { data, error: error?.message ?? null };
}

export async function getExpenseById(id: string) {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { data: null, error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  return { data, error: error?.message ?? null };
}

export async function createExpense(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  const str = (key: string) => (formData.get(key) as string) || null;
  const description = (formData.get("description") as string)?.trim();
  const amount = parseFloat(formData.get("amount") as string);

  if (!description) return { error: "Description is required" };
  if (isNaN(amount) || amount <= 0) return { error: "Valid amount is required" };

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      tenant_id: tenantId,
      description,
      category: str("category") || "other",
      amount,
      invoice_ref: str("invoice_ref"),
      expense_date: str("expense_date") || today,
      notes: str("notes"),
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create expense" };

  await logAuditEvent({
    tenantId,
    userId,
    action: "expense_create",
    entityType: "expense",
    entityId: data.id,
    newData: { description, amount, category: str("category") || "other" },
  });

  redirect(`/expenses/${data.id}`);
}

export async function updateExpense(
  id: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  const str = (key: string) => (formData.get(key) as string) || null;
  const description = (formData.get("description") as string)?.trim();
  const amount = parseFloat(formData.get("amount") as string);

  const today = new Date().toISOString().split("T")[0];

  // Get old data for audit
  const { data: oldData } = await supabase
    .from("expenses")
    .select("description, amount, category")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error } = await supabase
    .from("expenses")
    .update({
      description,
      category: str("category") || "other",
      amount,
      invoice_ref: str("invoice_ref"),
      expense_date: str("expense_date") || today,
      notes: str("notes"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId,
    userId,
    action: "expense_update",
    entityType: "expense",
    entityId: id,
    oldData: oldData || undefined,
    newData: { description, amount, category: str("category") || "other" },
  });

  redirect(`/expenses/${id}`);
}

export async function deleteExpense(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  // Get old data for audit
  const { data: oldData } = await supabase
    .from("expenses")
    .select("description, amount, category")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId,
    userId,
    action: "expense_delete",
    entityType: "expense",
    entityId: id,
    oldData: oldData || undefined,
  });

  redirect("/expenses");
}
