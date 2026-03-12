"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────────

export async function getSales() {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { data: null, error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { data, error } = await supabase
    .from("sales")
    .select("id, sale_number, customer_name, customer_email, status, payment_method, total, sale_date, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return { data, error: error?.message ?? null };
}

export async function getSaleById(id: string) {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { data: null, error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { data: sale, error } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !sale) return { data: null, error: error?.message ?? "Not found" };

  const { data: items } = await supabase
    .from("sale_items")
    .select("*")
    .eq("sale_id", id)
    .order("created_at", { ascending: true });

  return { data: { ...sale, items: items ?? [] }, error: null };
}

export async function createSale(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  // Auto-generate sale number based on count
  const { count } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const saleNumber = `S-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const str = (key: string) => (formData.get(key) as string) || null;
  const num = (key: string) => {
    const v = formData.get(key) as string;
    return v && v !== "" ? parseFloat(v) : 0;
  };

  // Parse line items from JSON
  let lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }> = [];
  try {
    const itemsJson = formData.get("line_items") as string;
    if (itemsJson) lineItems = JSON.parse(itemsJson);
  } catch {
    // ignore
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
  const discountAmount = num("discount_amount");
  const taxAmount = Math.round((subtotal - discountAmount) * 0.1 * 100) / 100;
  const total = subtotal - discountAmount + taxAmount;

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      tenant_id: tenantId,
      sale_number: saleNumber,
      customer_name: str("customer_name"),
      customer_email: str("customer_email"),
      status: str("status") || "quote",
      payment_method: str("payment_method"),
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
      notes: str("notes"),
      sold_by: userId,
    })
    .select("id")
    .single();

  if (saleError || !sale) return { error: saleError?.message ?? "Failed to create sale" };

  // Insert line items
  if (lineItems.length > 0) {
    const saleItemsData = lineItems.map((item) => ({
      tenant_id: tenantId,
      sale_id: sale.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
    }));

    const { error: itemsError } = await supabase.from("sale_items").insert(saleItemsData);
    if (itemsError) return { error: itemsError.message };
  }

  redirect(`/sales/${sale.id}`);
}

export async function updateSaleStatus(
  id: string,
  status: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { error } = await supabase
    .from("sales")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteSale(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  // Delete line items first
  await supabase.from("sale_items").delete().eq("sale_id", id).eq("tenant_id", tenantId);

  const { error } = await supabase
    .from("sales")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  redirect("/sales");
}
