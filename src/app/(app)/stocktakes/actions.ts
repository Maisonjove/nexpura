"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";

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
    revalidatePath("/stocktakes");
    return { id: data?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function startStocktake(stocktakeId: string): Promise<{ error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Auto-import all current inventory items as expected
    const { data: inventory } = await admin
      .from("inventory")
      .select("id, name, sku, quantity, barcode_value")
      .eq("tenant_id", tenantId)
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

export async function countItem(
  itemId: string,
  stocktakeId: string,
  countedQty: number,
  notes?: string
): Promise<{ error?: string }> {
  try {
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

    // Update totals
    const { data: allItems } = await admin
      .from("stocktake_items")
      .select("counted_qty, discrepancy")
      .eq("stocktake_id", stocktakeId);

    const counted = (allItems ?? []).filter((i) => i.counted_qty !== null).length;
    const discrepancies = (allItems ?? []).filter((i) => i.discrepancy !== 0 && i.counted_qty !== null).length;

    await admin
      .from("stocktakes")
      .update({ total_items_counted: counted, total_discrepancies: discrepancies })
      .eq("id", stocktakeId);

    revalidatePath(`/stocktakes/${stocktakeId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function completeStocktake(stocktakeId: string, applyAdjustments: boolean): Promise<{ error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    if (applyAdjustments) {
      // Apply counted quantities to inventory
      const { data: items } = await admin
        .from("stocktake_items")
        .select("inventory_id, counted_qty")
        .eq("stocktake_id", stocktakeId)
        .not("counted_qty", "is", null)
        .not("inventory_id", "is", null);

      for (const item of items ?? []) {
        if (item.inventory_id && item.counted_qty !== null) {
          await admin
            .from("inventory")
            .update({ quantity: item.counted_qty })
            .eq("id", item.inventory_id)
            .eq("tenant_id", tenantId);
        }
      }
    }

    await admin
      .from("stocktakes")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", stocktakeId)
      .eq("tenant_id", tenantId);

    await logActivity(tenantId, userId, "completed_stocktake", "stocktake", stocktakeId, applyAdjustments ? "with adjustments" : "without adjustments");
    revalidatePath("/stocktakes");
    revalidatePath(`/stocktakes/${stocktakeId}`);
    return {};
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
