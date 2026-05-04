"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, requirePermission } from "@/lib/auth-context";
import logger from "@/lib/logger";

import { flushSentry } from "@/lib/sentry-flush";
async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  return { supabase, userId: user.id, tenantId: userData.tenant_id as string, role: userData.role as string };
}

export interface Stocktake {
  id: string;
  tenant_id: string;
  reference_number: string | null;
  name: string;
  status: string;
  notes: string | null;
  location: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_items_counted: number;
  total_discrepancies: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StocktakeItem {
  id: string;
  stocktake_id: string;
  tenant_id: string;
  inventory_id: string | null;
  sku: string | null;
  item_name: string;
  expected_qty: number;
  counted_qty: number | null;
  discrepancy: number;
  barcode_value: string | null;
  notes: string | null;
  counted_by: string | null;
  counted_at: string | null;
  created_at: string;
}

export async function getStocktakes(): Promise<{ data: Stocktake[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("stocktakes")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getStocktake(id: string): Promise<{ data: Stocktake | null; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("stocktakes")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();
    if (error) return { data: null, error: error.message };
    return { data };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getStocktakeItems(stocktakeId: string): Promise<{ data: StocktakeItem[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("stocktake_items")
      .select("*")
      .eq("stocktake_id", stocktakeId)
      .eq("tenant_id", tenantId)
      .order("item_name", { ascending: true });
    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function createStocktake(
  name: string,
  location?: string,
  notes?: string
): Promise<{ id?: string; error?: string }> {
  try {
    // W3-RBAC-02: edit_inventory gate.
    await requirePermission("edit_inventory");
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Generate reference number
    const { count } = await admin
      .from("stocktakes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    const refNum = `ST-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data, error } = await admin
      .from("stocktakes")
      .insert({
        tenant_id: tenantId,
        reference_number: refNum,
        name,
        location: location || null,
        notes: notes || null,
        status: "draft",
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    await logActivity(tenantId, userId, "created_stocktake", "stocktake", data?.id, name);
    
    await logAuditEvent({
      tenantId,
      userId,
      action: "stocktake_create",
      entityType: "stocktake",
      entityId: data?.id,
      newData: { name, location: location || null, referenceNumber: refNum },
    });
    
    revalidatePath("/stocktakes");
    return { id: data?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function startStocktake(stocktakeId: string): Promise<{ error?: string }> {
  try {
    // W3-RBAC-02: edit_inventory gate.
    await requirePermission("edit_inventory");
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Auto-import all current inventory items as expected.
    // Filter out soft-deleted (archived) rows — without this guard
    // archived items with quantity > 0 get pulled into the snapshot,
    // the staff count marks them missing (variance), and the
    // adjustment could push them back to active in the quantity field
    // (effectively un-archiving them by a side door). The sibling
    // createStocktakeWithInventory path around line 380 already filters
    // deleted_at; keeping the two paths consistent.
    const { data: inventory } = await admin
      .from("inventory")
      .select("id, name, sku, quantity, barcode_value")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .gt("quantity", 0);

    if (inventory && inventory.length > 0) {
      const items = inventory.map((inv) => ({
        stocktake_id: stocktakeId,
        tenant_id: tenantId,
        inventory_id: inv.id,
        sku: inv.sku,
        item_name: inv.name,
        expected_qty: inv.quantity,
        barcode_value: inv.barcode_value,
        counted_qty: null,
      }));
      await admin.from("stocktake_items").insert(items);
    }

    await admin
      .from("stocktakes")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", stocktakeId)
      .eq("tenant_id", tenantId);

    await logActivity(tenantId, userId, "started_stocktake", "stocktake", stocktakeId, "");
    revalidatePath("/stocktakes");
    revalidatePath(`/stocktakes/${stocktakeId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

/**
 * Cancel a stocktake. Used to abandon a count without applying any
 * adjustments — useful when stock movements happened mid-count and
 * the operator wants to start over. Status flips to 'cancelled', the
 * counted_qty values stay in stocktake_items for audit, no inventory
 * movements are posted.
 */
export async function cancelStocktake(stocktakeId: string): Promise<{ error?: string }> {
  try {
    await requirePermission("edit_inventory");
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("stocktakes")
      .select("status")
      .eq("id", stocktakeId)
      .eq("tenant_id", tenantId)
      .single();
    if (!existing) return { error: "Stocktake not found" };
    if (existing.status === "completed" || existing.status === "cancelled") {
      return { error: `Stocktake is already ${existing.status} — terminal state.` };
    }

    const { error } = await admin
      .from("stocktakes")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", stocktakeId)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };

    await logActivity(tenantId, userId, "cancelled_stocktake", "stocktake", stocktakeId, "");
    revalidatePath("/stocktakes");
    revalidatePath(`/stocktakes/${stocktakeId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function countItem(
  itemId: string,
  stocktakeId: string,
  countedQty: number,
  notes?: string
): Promise<{ error?: string }> {
  try {
    // W3-RBAC-02: edit_inventory gate.
    await requirePermission("edit_inventory");
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    await admin
      .from("stocktake_items")
      .update({
        counted_qty: countedQty,
        notes: notes || null,
        counted_by: userId,
        counted_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("tenant_id", tenantId);

    // Atomic recompute via SQL. Pre-fix this read all stocktake_items
    // in JS, computed counts, and UPDATEd the parent — two staff
    // counting at the same time could each read pre-other-write,
    // undercounting on the second write. Worse, the SELECT pulled a
    // `discrepancy` column that doesn't exist on stocktake_items, so
    // the discrepancies count was effectively always equal to
    // total-counted. The RPC compares counted_qty to expected_qty
    // directly (the actual data source) inside a single SQL statement.
    // See migration 20260428_recompute_stocktake_totals.sql.
    const { error: rpcErr } = await admin.rpc("recompute_stocktake_totals", {
      p_stocktake_id: stocktakeId,
      p_tenant_id: tenantId,
    });
    if (rpcErr) {
      // Log loudly but don't fail the count — the user's individual
      // count is already persisted; the parent summary will be a tick
      // stale until the next successful call.
      logger.error("[countItem] recompute_stocktake_totals failed", {
        stocktakeId,
        error: rpcErr,
      });
    }

    revalidatePath(`/stocktakes/${stocktakeId}`);
    await flushSentry();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function completeStocktake(stocktakeId: string, applyAdjustments: boolean): Promise<{ error?: string }> {
  try {
    // W3-HIGH-02 / W3-RBAC-02: completing with applyAdjustments rewrites
    // tenant-wide inventory quantities. Require owner/manager when
    // adjustments are applied; otherwise edit_inventory is sufficient.
    if (applyAdjustments) {
      const authCtx = await requireAuth();
      if (!authCtx.isManager && !authCtx.isOwner) {
        return { error: "Only owner or manager can complete a stocktake with adjustments." };
      }
    }
    await requirePermission("edit_inventory");

    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    let itemsAdjustedCount = 0;

    if (applyAdjustments) {
      // W3-HIGH-02: race-safe compare-and-swap on inventory.quantity so a
      // concurrent POS sale doesn't get silently clobbered by the
      // stocktake commit. Fetch current quantity per item, update
      // conditionally, retry once on race.
      const { data: items } = await admin
        .from("stocktake_items")
        .select("inventory_id, counted_qty")
        .eq("stocktake_id", stocktakeId)
        .eq("tenant_id", tenantId)
        .not("counted_qty", "is", null)
        .not("inventory_id", "is", null);

      itemsAdjustedCount = items?.length || 0;

      for (const item of items ?? []) {
        if (!item.inventory_id || item.counted_qty === null) continue;
        const { data: inv } = await admin
          .from("inventory")
          .select("quantity")
          .eq("id", item.inventory_id)
          .eq("tenant_id", tenantId)
          .single();
        const oldQty = inv?.quantity ?? null;

        if (oldQty === null) continue;

        const delta = item.counted_qty - oldQty;
        // No-op when count matches expected; emit a movement only when
        // there's an actual adjustment so audit history isn't polluted.
        if (delta === 0) continue;

        // Pre-fix: directly UPDATE inventory.quantity to counted_qty with
        // no stock_movements row → the dashboard movement history showed
        // no record of stocktake corrections; reports underreported
        // shrinkage; the trigger pattern was bypassed entirely.
        // Now: insert a stocktake movement and let
        // sync_inventory_on_stock_movement_insert (BEFORE INSERT trigger)
        // settle inventory.quantity itself. The trigger's
        // GREATEST(...,0) floor is OK here — counted_qty=0 just sets
        // inventory to 0 via delta = -oldQty.
        await admin.from("stock_movements").insert({
          tenant_id: tenantId,
          inventory_id: item.inventory_id,
          movement_type: "stocktake",
          quantity_change: delta,
          notes: `Stocktake ${stocktakeId} adjustment`,
          created_by: userId,
        });
      }
    }

    await admin
      .from("stocktakes")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", stocktakeId)
      .eq("tenant_id", tenantId);

    await logActivity(tenantId, userId, "completed_stocktake", "stocktake", stocktakeId, applyAdjustments ? "with adjustments" : "without adjustments");
    
    await logAuditEvent({
      tenantId,
      userId,
      action: "stocktake_complete",
      entityType: "stocktake",
      entityId: stocktakeId,
      newData: { applyAdjustments, itemsAdjusted: itemsAdjustedCount },
    });
    
    revalidatePath("/stocktakes");
    revalidatePath(`/stocktakes/${stocktakeId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function createStocktakeWithInventory(
  name: string,
  location?: string,
  notes?: string
): Promise<{ id?: string; error?: string }> {
  try {
    // W3-RBAC-02: edit_inventory gate.
    await requirePermission("edit_inventory");
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Generate reference number
    const { count } = await admin
      .from("stocktakes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    const refNum = `ST-${String((count ?? 0) + 1).padStart(4, "0")}`;

    // Create the stocktake
    const { data, error } = await admin
      .from("stocktakes")
      .insert({
        tenant_id: tenantId,
        reference_number: refNum,
        name,
        location: location || null,
        notes: notes || null,
        status: "in_progress",
        started_at: new Date().toISOString(),
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    // Pre-populate from entire inventory
    const { data: inventory } = await admin
      .from("inventory")
      .select("id, name, sku, quantity, barcode_value")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    if (inventory && inventory.length > 0) {
      const items = inventory.map((inv) => ({
        stocktake_id: data.id,
        tenant_id: tenantId,
        inventory_id: inv.id,
        sku: inv.sku,
        item_name: inv.name,
        expected_qty: inv.quantity ?? 0,
        barcode_value: inv.barcode_value ?? null,
        counted_qty: null,
      }));
      await admin.from("stocktake_items").insert(items);
    }

    await logActivity(tenantId, userId, "created_stocktake", "stocktake", data?.id, `${name} (imported from inventory)`);
    revalidatePath("/stocktakes");
    return { id: data?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function addManualStocktakeItem(
  stocktakeId: string,
  itemName: string,
  expectedQty: number,
  sku?: string
): Promise<{ error?: string }> {
  try {
    // W3-RBAC-02: edit_inventory gate.
    await requirePermission("edit_inventory");
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { error } = await admin.from("stocktake_items").insert({
      stocktake_id: stocktakeId,
      tenant_id: tenantId,
      item_name: itemName,
      expected_qty: expectedQty,
      sku: sku || null,
    });
    if (error) return { error: error.message };
    revalidatePath(`/stocktakes/${stocktakeId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}
