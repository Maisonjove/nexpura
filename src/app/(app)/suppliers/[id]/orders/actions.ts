"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import { requirePermission } from "@/lib/auth-context";

import { flushSentry } from "@/lib/sentry-flush";
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
    // W3-RBAC-08: edit_inventory gate.
    try {
      await requirePermission("edit_inventory");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "You don't have permission to create purchase orders." : "Not authenticated" };
    }

    const { supabase, userId, tenantId } = await getAuthContext();

  const supplierId = formData.get("supplier_id") as string;

  // W3-MED-04: verify supplierId belongs to this tenant before linking.
  if (supplierId) {
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("id", supplierId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!supplier) return { error: "Supplier not found" };
  }
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
    logger.error("[createPurchaseOrder] Error:", err);
    await flushSentry();
    return { error: err instanceof Error ? err.message : "Failed to create purchase order" };
  }
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    // W3-RBAC-08: edit_inventory gate.
    try {
      await requirePermission("edit_inventory");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "You don't have permission to update purchase orders." : "Not authenticated" };
    }

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

        // Destructive throw (caught by outer try/catch → return-error):
        // this is the inventory increment for receiving PO goods. If it
        // silently fails, the PO will flip to 'received' below but the
        // inventory.quantity is unchanged → over-sell vector + the
        // stock_movements row inserted next references a quantity_after
        // that doesn't match reality.
        const { error: invUpdErr } = await admin
          .from("inventory")
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq("id", item.inventory_item_id)
          .eq("tenant_id", tenantId);
        if (invUpdErr) throw new Error(`Failed to increment inventory for PO receive: ${invUpdErr.message}`);

        // Destructive throw: stock_movements is the immutable ledger of
        // every quantity change. The inventory row was just incremented;
        // if this insert silently fails the inventory shows the new total
        // but there's no movement row explaining where it came from →
        // reconciliation reports won't match, audit trail is broken.
        const { error: stockMovErr } = await admin.from("stock_movements").insert({
          tenant_id: tenantId,
          inventory_id: item.inventory_item_id,
          movement_type: "purchase_order_receive",
          quantity_change: item.quantity,
          quantity_after: newQty,
          notes: `Received via PO ${po.order_number || id.slice(0, 8)}`,
          created_by: userId,
        });
        if (stockMovErr) throw new Error(`Failed to record stock movement for PO receive: ${stockMovErr.message}`);
      }
    }
  }

  revalidatePath("/suppliers");
    return { success: true };
  } catch (err) {
    logger.error("[updatePurchaseOrderStatus] Error:", err);
    await flushSentry();
    return { error: err instanceof Error ? err.message : "Failed to update purchase order" };
  }
}

/**
 * Receive specific quantities against a PO line by line. Lets the
 * operator log a partial shipment without flipping the whole PO to
 * received. Each line accepts a "receive_qty" ≤ remaining (ordered −
 * already_received). When the running total covers the ordered qty,
 * the PO auto-flips to "received"; otherwise stays "partial".
 */
export async function receivePOLines(
  poId: string,
  receipts: Array<{ inventoryItemId: string; receiveQty: number }>,
): Promise<{ success?: boolean; status?: string; error?: string }> {
  try {
    await requirePermission("edit_inventory");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to receive purchase orders." : "Not authenticated" };
  }
  const { userId, tenantId } = await getAuthContext();
  const admin = createAdminClient();

  const { data: po } = await admin
    .from("purchase_orders")
    .select("id, order_number, status, items")
    .eq("id", poId)
    .eq("tenant_id", tenantId)
    .single();
  if (!po) return { error: "Purchase order not found" };
  if (po.status === "received" || po.status === "cancelled") {
    return { error: `PO is already ${po.status} — cannot receive further.` };
  }

  type POItem = {
    description: string;
    quantity: number;
    received_qty?: number | null;
    inventory_item_id?: string | null;
    unit_price?: number;
    line_total?: number;
  };
  const poItems = (po.items as POItem[]) ?? [];
  const updatedItems: POItem[] = [];
  let totalOrdered = 0;
  let totalReceived = 0;

  for (const it of poItems) {
    const ordered = Number(it.quantity ?? 0);
    let received = Number(it.received_qty ?? 0);
    const matching = receipts.find((r) => r.inventoryItemId && it.inventory_item_id === r.inventoryItemId);
    if (matching && matching.receiveQty > 0 && it.inventory_item_id) {
      const room = ordered - received;
      const adding = Math.min(matching.receiveQty, room);
      if (adding > 0) {
        // Inventory increment + stock_movement
        const { data: inv } = await admin
          .from("inventory")
          .select("id, quantity, name")
          .eq("id", it.inventory_item_id)
          .eq("tenant_id", tenantId)
          .single();
        if (inv) {
          const newQty = (inv.quantity || 0) + adding;
          // Destructive return-error: partial-receive inventory increment.
          // If silently fails the per-line received_qty below is updated
          // (the PO shows it's been received) but inventory.quantity is
          // stale → over-sell vector. Surface so the caller can retry.
          const { error: invUpdErr } = await admin.from("inventory")
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq("id", inv.id)
            .eq("tenant_id", tenantId);
          if (invUpdErr) return { error: `Failed to increment inventory for partial receive: ${invUpdErr.message}` };
          // Destructive return-error: stock_movements ledger row paired to
          // the inventory increment above. If silently fails the on-hand
          // matches reality but there's no movement record → reconcile
          // reports show an unexplained delta and audit trail is broken.
          const { error: stockMovErr } = await admin.from("stock_movements").insert({
            tenant_id: tenantId,
            inventory_id: inv.id,
            movement_type: "purchase_order_receive",
            quantity_change: adding,
            quantity_after: newQty,
            notes: `Partial receive against PO ${po.order_number || poId.slice(0, 8)}`,
            created_by: userId,
          });
          if (stockMovErr) return { error: `Failed to record stock movement for partial receive: ${stockMovErr.message}` };
        }
        received += adding;
      }
    }
    updatedItems.push({ ...it, received_qty: received });
    totalOrdered += ordered;
    totalReceived += received;
  }

  const newStatus = totalReceived >= totalOrdered ? "received" : "partial";
  const updates: Record<string, unknown> = {
    items: updatedItems,
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === "received") updates.received_date = new Date().toISOString().split("T")[0];

  const { error: upErr } = await admin
    .from("purchase_orders")
    .update(updates)
    .eq("id", poId)
    .eq("tenant_id", tenantId);
  if (upErr) return { error: upErr.message };

  revalidatePath(`/suppliers`);
  return { success: true, status: newStatus };
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
    logger.error("[getPurchaseOrders] Error:", err);
    await flushSentry();
    return { error: err instanceof Error ? err.message : "Failed to get purchase orders" };
  }
}
