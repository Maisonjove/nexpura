"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function createPurchaseOrder(formData: FormData) {
  const { supabase, userId, tenantId } = await getAuthContext();

  const supplierId = formData.get("supplier_id") as string;
  const notes = formData.get("notes") as string || null;
  const expectedDate = formData.get("expected_date") as string || null;
  const itemsJson = formData.get("items") as string;

  let items: { description: string; quantity: number; unit_price: number; line_total: number }[] = [];
  try {
    items = JSON.parse(itemsJson || "[]");
  } catch { /* ignore */ }

  const total = items.reduce((sum, i) => sum + i.line_total, 0);

  // Generate order number
  const { count } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const orderNumber = `PO-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { error } = await supabase.from("purchase_orders").insert({
    tenant_id: tenantId,
    order_number: orderNumber,
    supplier_id: supplierId || null,
    items,
    total,
    status: "ordered",
    expected_date: expectedDate || null,
    notes,
    created_by: userId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/suppliers/${supplierId}/orders`);
  return { success: true };
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: string
): Promise<{ success?: boolean; error?: string }> {
  const { supabase, tenantId } = await getAuthContext();
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "received") updates.received_date = new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("purchase_orders")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/suppliers");
  return { success: true };
}

export async function getPurchaseOrders(supplierId: string) {
  const { supabase, tenantId } = await getAuthContext();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });
  return { data: data ?? [], error: error?.message };
}
