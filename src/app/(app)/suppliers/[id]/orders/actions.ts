"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

export async function createPurchaseOrder(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const { supabase, userId, tenantId } = await getAuthContext();

  const supplierId = formData.get("supplier_id") as string;
  const notes = formData.get("notes") as string || null;
  const expectedDate = formData.get("expected_date") as string || null;
  const itemsJson = formData.get("items") as string;

  let items: { description: string; quantity: number; unit_price: number; line_total: number; inventory_item_id?: string | null }[] = [];
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
  } catch (err) {
    console.error("[createPurchaseOrder] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create purchase order" };
  }
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { supabase, userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "received") updates.received_date = new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("purchase_orders")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  // When PO is received, update inventory quantities for linked items
  if (status === "received") {
    // Fetch the PO to get items and order_number
    const { data: po } = await admin
      .from("purchase_orders")
      .select("order_number, items")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (po?.items && Array.isArray(po.items)) {
      const poItems = po.items as Array<{
        description: string;
        quantity: number;
        inventory_item_id?: string | null;
      }>;

      for (const item of poItems) {
        if (!item.inventory_item_id || item.quantity <= 0) continue;

        // Get current inventory quantity
        const { data: inv } = await admin
          .from("inventory")
          .select("id, quantity, name")
          .eq("id", item.inventory_item_id)
          .eq("tenant_id", tenantId)
          .single();

        if (!inv) continue;

        const newQty = (inv.quantity || 0) + item.quantity;

        // Update inventory quantity
        await admin
          .from("inventory")
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq("id", item.inventory_item_id)
          .eq("tenant_id", tenantId);

        // Log stock movement
        await admin.from("stock_movements").insert({
          tenant_id: tenantId,
          inventory_id: item.inventory_item_id,
          movement_type: "purchase_order_receive",
          quantity_change: item.quantity,
          quantity_after: newQty,
          notes: `Received via PO ${po.order_number || id.slice(0, 8)}`,
          created_by: userId,
        });
      }
    }
  }

  revalidatePath("/suppliers");
    return { success: true };
  } catch (err) {
    console.error("[updatePurchaseOrderStatus] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to update purchase order" };
  }
}

export async function getPurchaseOrders(supplierId: string): Promise<{ data?: any[]; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });
    return { data: data ?? [], error: error?.message };
  } catch (err) {
    console.error("[getPurchaseOrders] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to get purchase orders" };
  }
}
