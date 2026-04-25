"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { generateBarcodeValue } from "@/lib/barcode";
import { logAuditEvent } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { resolveLocationForCreate, LOCATION_REQUIRED_MESSAGE } from "@/lib/active-location";
import { assertTenantActive } from "@/lib/assert-tenant-active";
import { requireAuth, requirePermission } from "@/lib/auth-context";
import { eqOrValue } from "@/lib/db/or-escape";

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!data?.tenant_id) throw new Error("No tenant");
  // Paywall choke point. See src/lib/assert-tenant-active.ts.
  await assertTenantActive(data.tenant_id);
  return data.tenant_id as string;
}

export async function createInventoryItem(formData: FormData) {
  // W3-RBAC-01: gate all inventory mutations on edit_inventory.
  await requirePermission("edit_inventory");
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  const { data: { user } } = await supabase.auth.getUser();

  const name = formData.get("name") as string;
  const itemType = (formData.get("item_type") as string) || "finished_piece";
  const jewelleryType = formData.get("jewellery_type") as string | null;
  const categoryId = formData.get("category_id") as string | null;
  const description = formData.get("description") as string | null;

  const metalType = formData.get("metal_type") as string | null;
  const metalColour = formData.get("metal_colour") as string | null;
  const metalPurity = formData.get("metal_purity") as string | null;
  const metalWeightRaw = formData.get("metal_weight_grams") as string | null;
  const metalWeight = metalWeightRaw ? parseFloat(metalWeightRaw) : null;

  const stoneType = formData.get("stone_type") as string | null;
  const stoneCaratRaw = formData.get("stone_carat") as string | null;
  const stoneCarat = stoneCaratRaw ? parseFloat(stoneCaratRaw) : null;
  const stoneColour = formData.get("stone_colour") as string | null;
  const stoneClarity = formData.get("stone_clarity") as string | null;

  const ringSize = formData.get("ring_size") as string | null;
  const dimensions = formData.get("dimensions") as string | null;

  const costPriceRaw = formData.get("cost_price") as string | null;
  const wholesalePriceRaw = formData.get("wholesale_price") as string | null;
  const retailPriceRaw = formData.get("retail_price") as string | null;
  const costPrice = costPriceRaw ? parseFloat(costPriceRaw) : null;
  const wholesalePrice = wholesalePriceRaw ? parseFloat(wholesalePriceRaw) : null;
  const retailPrice = retailPriceRaw ? parseFloat(retailPriceRaw) : 0;

  const quantityRaw = formData.get("quantity") as string | null;
  const quantity = quantityRaw ? parseInt(quantityRaw) : 0;
  const lowStockThresholdRaw = formData.get("low_stock_threshold") as string | null;
  const lowStockThreshold = lowStockThresholdRaw ? parseInt(lowStockThresholdRaw) : 1;
  const trackQuantity = formData.get("track_quantity") !== "false";

  let sku = (formData.get("sku") as string | null)?.trim() || null;
  const barcode = formData.get("barcode") as string | null;
  const supplierName = formData.get("supplier_name") as string | null;
  const supplierSku = formData.get("supplier_sku") as string | null;

  const isFeatured = formData.get("is_featured") === "true";
  const status = (formData.get("status") as string) || "active";

  // Auto-generate SKU if blank
  if (!sku) {
    const { data: skuData, error: skuError } = await supabase.rpc("next_sku", { p_tenant_id: tenantId });
    if (skuError) throw new Error(`SKU generation failed: ${skuError.message}`);
    sku = skuData as string;
  }

  // Build payload: core fields always included. Extended fields (certificate,
  // metal_form, consignment, supplier_invoice_ref) are skipped when the user
  // didn't provide a value — this prevents PostgREST PGRST204 errors when a
  // tenant's schema cache or migration state is missing one of these columns,
  // while still persisting the field when it's actually set.
  const optionalString = (key: string) => {
    const v = formData.get(key) as string | null;
    return v && v.trim() !== "" ? v : null;
  };
  // Resolve which location this item belongs to. Never silently NULL when
  // the tenant has multiple active locations — see src/lib/active-location.ts
  // for the policy (cookie → single-location auto → multi-location reject).
  if (!user?.id) throw new Error("Not authenticated");
  const locResolution = await resolveLocationForCreate(tenantId, user.id);
  if (locResolution.needsSelection) {
    throw new Error(LOCATION_REQUIRED_MESSAGE);
  }
  const activeLocationId = locResolution.locationId;
  const core: Record<string, unknown> = {
    tenant_id: tenantId,
    location_id: activeLocationId,
    name,
    item_type: itemType,
    jewellery_type: jewelleryType || null,
    category_id: categoryId || null,
    description: description || null,
    metal_type: metalType || null,
    metal_colour: metalColour || null,
    metal_purity: metalPurity || null,
    metal_weight_grams: metalWeight,
    stone_type: stoneType || null,
    stone_carat: stoneCarat,
    stone_colour: stoneColour || null,
    stone_clarity: stoneClarity || null,
    ring_size: ringSize || null,
    dimensions: dimensions || null,
    cost_price: costPrice,
    wholesale_price: wholesalePrice,
    retail_price: retailPrice,
    quantity,
    low_stock_threshold: lowStockThreshold,
    track_quantity: trackQuantity,
    sku,
    barcode: barcode || null,
    supplier_name: supplierName || null,
    supplier_sku: supplierSku || null,
    is_featured: isFeatured,
    status,
    created_by: user?.id,
  };
  const extended: Record<string, unknown> = {};
  const addIfSet = (key: string, value: unknown) => {
    if (value !== null && value !== undefined && value !== "") extended[key] = value;
  };
  addIfSet("certificate_number", optionalString("certificate_number"));
  addIfSet("grading_lab", optionalString("grading_lab"));
  addIfSet("grade", optionalString("grade"));
  addIfSet("report_url", optionalString("report_url"));
  addIfSet("stock_location", optionalString("stock_location"));
  addIfSet("metal_form", optionalString("metal_form"));
  addIfSet("consignor_name", optionalString("consignor_name"));
  addIfSet("consignor_contact", optionalString("consignor_contact"));
  addIfSet("consignment_start_date", optionalString("consignment_start_date"));
  addIfSet("consignment_end_date", optionalString("consignment_end_date"));
  const commRaw = formData.get("consignment_commission_pct") as string | null;
  if (commRaw && commRaw.trim() !== "") extended["consignment_commission_pct"] = parseFloat(commRaw);
  addIfSet("supplier_invoice_ref", optionalString("supplier_invoice_ref"));

  // Retry-on-PGRST204: if PostgREST's schema cache doesn't know about a column
  // we're inserting (e.g. a migration was run but the cache is stale, or the
  // column is missing on this tenant's DB), drop the offending column from the
  // payload and retry. Caps at 20 attempts so a genuinely broken payload still
  // surfaces.
  const payload: Record<string, unknown> = { ...core, ...extended };
  let item: { id: string } | null = null;
  let error: { message: string; code?: string; details?: string; hint?: string } | null = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await supabase.from("inventory").insert(payload).select("id").single();
    if (!result.error) { item = result.data as { id: string }; error = null; break; }
    const err = result.error as { message: string; code?: string };
    error = err;
    if (err.code === "PGRST204") {
      const match = err.message.match(/Could not find the '(\w+)' column/);
      if (match && match[1] in payload) {
        delete payload[match[1]];
        continue;
      }
    }
    break;
  }

  if (error || !item) throw new Error(`Failed to create inventory item: ${error?.message ?? 'no item returned'}`);

  // Generate and set barcode_value
  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("slug, name")
      .eq("id", tenantId)
      .single();
    const tenantSlug = tenant?.slug ?? tenant?.name ?? tenantId.slice(0, 6);
    const barcodeValue = generateBarcodeValue(tenantSlug, sku ?? item.id.slice(0, 8));
    await supabase.from("inventory").update({ barcode_value: barcodeValue }).eq("id", item.id);
  } catch {
    // barcode generation is non-critical
  }

  // Create initial stock movement if quantity > 0.
  //
  // The `sync_inventory_quantity` trigger (added 2026-03-31) fires on
  // every stock_movements INSERT and applies quantity_change to the
  // inventory row. We've already INSERTed inventory with quantity = 12;
  // if we now INSERT a stock_movement with quantity_change = 12 the
  // trigger pushes the row to 24. Repro: e2e/jeweller-flow-inventory.
  //
  // Reset inventory.quantity to 0 first so the trigger lands on the
  // correct final value (0 + 12 = 12). The audit row in stock_movements
  // is preserved.
  if (quantity > 0) {
    const { error: zeroError } = await supabase
      .from("inventory")
      .update({ quantity: 0 })
      .eq("id", item.id);
    if (zeroError) throw new Error(`Failed to zero inventory before stock movement: ${zeroError.message}`);

    const { error: smError } = await supabase.from("stock_movements").insert({
      tenant_id: tenantId,
      inventory_id: item.id,
      movement_type: "purchase",
      quantity_change: quantity,
      // quantity_after is set by the sync trigger; we set it here too
      // so a stock_movements consumer that reads only this row sees the
      // correct end state without joining inventory.
      quantity_after: quantity,
      notes: "Initial stock",
      created_by: user?.id,
    });
    if (smError) throw new Error(`Initial stock movement failed: ${smError.message}`);
  }

  after(() =>
    logAuditEvent({
      tenantId,
      userId: user?.id,
      action: "inventory_create",
      entityType: "inventory",
      entityId: item.id,
      newData: { name, sku, retailPrice, quantity, status },
    })
  );

  revalidatePath("/inventory");
  revalidateTag(CACHE_TAGS.inventory(tenantId), "default");
  redirect(`/inventory/${item.id}`);
}

export async function updateInventoryItem(id: string, formData: FormData) {
  // W3-RBAC-01: edit_inventory gate.
  await requirePermission("edit_inventory");
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);

  const name = formData.get("name") as string;
  const itemType = (formData.get("item_type") as string) || "finished_piece";
  const jewelleryType = formData.get("jewellery_type") as string | null;
  const categoryId = formData.get("category_id") as string | null;
  const description = formData.get("description") as string | null;

  const metalType = formData.get("metal_type") as string | null;
  const metalColour = formData.get("metal_colour") as string | null;
  const metalPurity = formData.get("metal_purity") as string | null;
  const metalWeightRaw = formData.get("metal_weight_grams") as string | null;
  const metalWeight = metalWeightRaw ? parseFloat(metalWeightRaw) : null;

  const stoneType = formData.get("stone_type") as string | null;
  const stoneCaratRaw = formData.get("stone_carat") as string | null;
  const stoneCarat = stoneCaratRaw ? parseFloat(stoneCaratRaw) : null;
  const stoneColour = formData.get("stone_colour") as string | null;
  const stoneClarity = formData.get("stone_clarity") as string | null;

  const ringSize = formData.get("ring_size") as string | null;
  const dimensions = formData.get("dimensions") as string | null;

  const costPriceRaw = formData.get("cost_price") as string | null;
  const wholesalePriceRaw = formData.get("wholesale_price") as string | null;
  const retailPriceRaw = formData.get("retail_price") as string | null;
  const costPrice = costPriceRaw ? parseFloat(costPriceRaw) : null;
  const wholesalePrice = wholesalePriceRaw ? parseFloat(wholesalePriceRaw) : null;
  const retailPrice = retailPriceRaw ? parseFloat(retailPriceRaw) : 0;

  const lowStockThresholdRaw = formData.get("low_stock_threshold") as string | null;
  const lowStockThreshold = lowStockThresholdRaw ? parseInt(lowStockThresholdRaw) : 1;
  const trackQuantity = formData.get("track_quantity") !== "false";

  const barcode = formData.get("barcode") as string | null;
  const supplierName = formData.get("supplier_name") as string | null;
  const supplierSku = formData.get("supplier_sku") as string | null;

  const isFeatured = formData.get("is_featured") === "true";
  const status = (formData.get("status") as string) || "active";

  // Advanced fields
  const secondaryStonesRaw = formData.get("secondary_stones") as string | null;
  let secondaryStones = null;
  try {
    if (secondaryStonesRaw) secondaryStones = JSON.parse(secondaryStonesRaw);
  } catch { /* ignore */ }

  const { data: { user } } = await supabase.auth.getUser();
  const { hasPermission } = await import("@/lib/permissions");
  const canViewCost = await hasPermission(user?.id ?? "", tenantId, "view_cost_price");

  const updates: Record<string, unknown> = {
      name,
      item_type: itemType,
      jewellery_type: jewelleryType || null,
      category_id: categoryId || null,
      description: description || null,
      metal_type: metalType || null,
      metal_colour: metalColour || null,
      metal_purity: metalPurity || null,
      metal_weight_grams: metalWeight,
      stone_type: stoneType || null,
      stone_carat: stoneCarat,
      stone_colour: stoneColour || null,
      stone_clarity: stoneClarity || null,
      ring_size: ringSize || null,
      dimensions: dimensions || null,
      retail_price: retailPrice,
      low_stock_threshold: lowStockThreshold,
      track_quantity: trackQuantity,
      barcode: barcode || null,
      supplier_name: supplierName || null,
      supplier_sku: supplierSku || null,
      is_featured: isFeatured,
      status,
      // Advanced fields. Most of the original "advanced" payload pre-fix
      // wrote columns that don't exist on the live schema (verified
      // 2026-04-25 — only `certificate_number` exists from this group).
      // The PGRST204-retry loop below silently dropped the rest, costing
      // 12+ extra round-trips per save. Upfront-only-include `certificate_number`
      // until those columns are migrated.
      certificate_number: (formData.get("certificate_number") as string) || null,
      // (Retained for forward-compat) consume secondaryStones to keep TS happy.
  };
  void secondaryStones;

  if (canViewCost) {
    updates.cost_price = costPrice;
    updates.wholesale_price = wholesalePrice;
  }

  // Get old data for audit
  const { data: oldItem } = await supabase
    .from("inventory")
    .select("name, sku, retail_price, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  // Retry-on-PGRST204: the `inventory` schema may be missing optional columns
  // (certificate, consignment, stock_location, metal_form, supplier_invoice_ref,
  // secondary_stones, etc.) depending on migration state. Drop the offending
  // column from the payload and retry, same pattern createInventoryItem uses.
  // Caps at 20 attempts so a genuinely broken payload still surfaces.
  const payload: Record<string, unknown> = { ...updates };
  let updateError: { message: string; code?: string } | null = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await supabase
      .from("inventory")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (!result.error) { updateError = null; break; }
    const err = result.error as { message: string; code?: string };
    updateError = err;
    if (err.code === "PGRST204") {
      const match = err.message.match(/Could not find the '(\w+)' column/);
      if (match && match[1] in payload) {
        delete payload[match[1]];
        continue;
      }
    }
    break;
  }

  if (updateError) throw new Error(updateError.message);

  after(() =>
    logAuditEvent({
      tenantId,
      userId: user?.id,
      action: "inventory_update",
      entityType: "inventory",
      entityId: id,
      oldData: oldItem || undefined,
      newData: { name, sku: updates.sku, retailPrice, status },
    })
  );

  revalidatePath(`/inventory/${id}`);
  revalidatePath(`/inventory/${id}/edit`);
  revalidatePath("/inventory");
  revalidateTag(CACHE_TAGS.inventory(tenantId), "default");
  redirect(`/inventory/${id}`);
}

export async function adjustStock(
  inventoryId: string,
  movementType: string,
  quantityChange: number,
  notes: string
) {
  // W3-RBAC-01: edit_inventory gate (adjusting stock = inventory mutation).
  await requirePermission("edit_inventory");
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  const { data: { user } } = await supabase.auth.getUser();

  // The DB has a BEFORE INSERT trigger `sync_inventory_on_stock_movement_insert`
  // (function `sync_inventory_quantity()` — verified 2026-04-25) that:
  //   1. Reads inventory.quantity at insert time
  //   2. Computes new = GREATEST(current + quantity_change, 0)
  //   3. UPDATEs inventory.quantity = new
  //   4. Sets NEW.quantity_after = new (so the row's column is correct)
  //
  // The pre-trigger code did its own SELECT-then-UPDATE-then-INSERT,
  // which means every adjust applied 2x: explicit UPDATE deducted X,
  // then the trigger deducted X again from the post-update read.
  // Verified by tracing oldQty=10, change=-3 → explicit set to 7 → trigger
  // reads 7, adds -3 → 4 → inventory ends at 4 instead of 7.
  //
  // The pre-flight check below preserves the "no negative stock" UX
  // (so the user sees a friendly error instead of a 0 quantity)
  // without doing an actual write — the trigger's GREATEST(...,0)
  // is the source of truth.
  const { data: item } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("id", inventoryId)
    .eq("tenant_id", tenantId)
    .single();

  if (!item) throw new Error("Item not found");
  if (item.quantity + quantityChange < 0) {
    throw new Error("Stock cannot go below 0");
  }

  // Insert movement — the trigger handles the inventory.quantity update
  // and computes quantity_after itself (so we don't need to send it).
  const { error: movError } = await supabase.from("stock_movements").insert({
    tenant_id: tenantId,
    inventory_id: inventoryId,
    movement_type: movementType,
    quantity_change: quantityChange,
    notes: notes || null,
    created_by: user?.id,
  });

  if (movError) throw new Error(movError.message);

  // Re-read for the audit log so we record the post-trigger value.
  const { data: itemAfter } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("id", inventoryId)
    .eq("tenant_id", tenantId)
    .single();
  const oldQuantity = item.quantity;
  const finalQuantity = itemAfter?.quantity ?? oldQuantity + quantityChange;

  // Log audit event
  await logAuditEvent({
    tenantId,
    userId: user?.id,
    action: "inventory_stock_adjust",
    entityType: "inventory",
    entityId: inventoryId,
    oldData: { quantity: oldQuantity },
    newData: { quantity: finalQuantity, movementType, quantityChange },
    metadata: { notes },
  });

  revalidatePath(`/inventory/${inventoryId}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidateTag(CACHE_TAGS.inventory(tenantId), "default");
}

export async function archiveInventoryItem(id: string) {
  // RBAC: archive is a destructive soft-delete. Owners/managers only.
  // edit_inventory is enough to mutate stock, but deletion is reserved
  // for management regardless of inventory edit rights.
  const authCtx = await requireAuth();
  if (!authCtx.isManager && !authCtx.isOwner) {
    throw new Error("Only owner or manager can archive inventory items.");
  }
  await requirePermission("edit_inventory");
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  const { data: { user } } = await supabase.auth.getUser();

  // Get item data for audit
  const { data: item } = await supabase
    .from("inventory")
    .select("name, sku")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error } = await supabase
    .from("inventory")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);

  // Log audit event
  await logAuditEvent({
    tenantId,
    userId: user?.id,
    action: "inventory_delete",
    entityType: "inventory",
    entityId: id,
    oldData: item || undefined,
  });

  revalidatePath("/inventory");
  revalidateTag(CACHE_TAGS.inventory(tenantId), "default");
  redirect("/inventory");
}

export async function createCategory(name: string, description?: string) {
  // W3-MED-01 / W3-RBAC-01: gate + validate.
  await requirePermission("edit_inventory");
  const trimmed = (name ?? "").trim();
  if (!trimmed) throw new Error("Category name is required");
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);

  const { data, error } = await supabase
    .from("stock_categories")
    .insert({ tenant_id: tenantId, name: trimmed, description: description || null })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function saveInventoryItemImages(
  itemId: string,
  primaryImage: string | null,
  images: string[]
): Promise<{ success?: boolean; error?: string }> {
  // W3-RBAC-01: edit_inventory gate.
  try {
    await requirePermission("edit_inventory");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to edit inventory." : "Not authenticated" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: userData } = await supabase
    .from("users").select("tenant_id").eq("id", user.id).single();
  if (!userData?.tenant_id) return { error: "No tenant" };

  const { error } = await supabase
    .from("inventory")
    .update({ primary_image: primaryImage, images })
    .eq("id", itemId)
    .eq("tenant_id", userData.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(`/inventory/${itemId}`);
  return { success: true };
}

export async function getStockTagTemplates() {
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  const { data } = await supabase
    .from("stock_tag_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getInventoryItemByBarcode(
  barcode: string
): Promise<{ id?: string; name?: string; error?: string }> {
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);

  // W3-HIGH-01 + W2-004: accept any barcode, but route through
  // eqOrValue so `.`, `,`, `(`, `)`, `*`, `"` are quoted literals and
  // can't break out of the .or() clause. Format gate stays as a
  // defence-in-depth sanity check.
  const trimmed = barcode.trim();
  if (!trimmed) return { error: "Barcode is required" };
  if (!/^[\w\-.]+$/.test(trimmed)) {
    return { error: "Invalid barcode format" };
  }

  const { data, error } = await supabase
    .from("inventory")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .or(`barcode_value.${eqOrValue(trimmed)},sku.${eqOrValue(trimmed)}`)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Item not found" };
  return { id: data.id, name: data.name };
}

export async function generateBarcodeForItem(itemId: string): Promise<{ success?: boolean; error?: string; barcodeValue?: string }> {
  // W3-RBAC-01: edit_inventory gate.
  await requirePermission("edit_inventory");
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);

  const { data: item } = await supabase
    .from("inventory")
    .select("sku")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .single();

  if (!item) return { error: "Item not found" };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug, name")
    .eq("id", tenantId)
    .single();

  const tenantSlug = tenant?.slug ?? tenant?.name ?? tenantId.slice(0, 6);
  const barcodeValue = generateBarcodeValue(tenantSlug, item.sku ?? itemId.slice(0, 8));

  const { error } = await supabase
    .from("inventory")
    .update({ barcode_value: barcodeValue })
    .eq("id", itemId)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath(`/inventory/${itemId}`);
  return { success: true, barcodeValue };
}

// ============================================================================
// NEW INVENTORY SYSTEM ACTIONS
// ============================================================================

export async function getSuppliersList(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  
  const { data } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");
  
  return data ?? [];
}

export async function createQuickSupplier(name: string): Promise<{ id?: string; error?: string }> {
  // W3-MED-02 / W3-RBAC-08: gate + validate.
  try {
    await requirePermission("edit_inventory");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to add suppliers." : "Not authenticated" };
  }
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { error: "Supplier name is required" };

  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ tenant_id: tenantId, name: trimmed })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function quickAddStock(formData: FormData): Promise<{ id?: string; stockNumber?: string; error?: string }> {
  // W3-RBAC-01: edit_inventory gate.
  try {
    await requirePermission("edit_inventory");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to add inventory." : "Not authenticated" };
  }

  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  const { data: { user } } = await supabase.auth.getUser();
  
  const isConsignment = formData.get("is_consignment") === "true";
  const description = formData.get("description") as string;
  const itemType = formData.get("item_type") as string;
  const supplierId = formData.get("supplier_id") as string || null;
  const costPriceRaw = formData.get("cost_price") as string;
  const retailPriceRaw = formData.get("retail_price") as string;

  const costPrice = costPriceRaw ? parseFloat(costPriceRaw) : null;
  const retailPrice = retailPriceRaw ? parseFloat(retailPriceRaw) : 0;
  // tags input dropped — `inventory.tags` column doesn't exist on the
  // live schema and the form value silently never persisted. Bring back
  // when the column is migrated.
  
  // Get next stock number using the database function
  const { data: stockNumberData, error: stockNumError } = await supabase
    .rpc("get_next_stock_number", { p_tenant_id: tenantId, p_is_consignment: isConsignment });
  
  let stockNumber: string;
  
  if (stockNumError) {
    // Fallback: manually generate stock number
    const prefix = isConsignment ? "C" : "S";
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("next_stock_number, next_consignment_number")
      .eq("id", tenantId)
      .single();
    
    const nextNum = isConsignment 
      ? ((tenantData as { next_consignment_number?: number })?.next_consignment_number ?? 1)
      : ((tenantData as { next_stock_number?: number })?.next_stock_number ?? 1);
    
    // Update tenant counter
    await supabase
      .from("tenants")
      .update(isConsignment 
        ? { next_consignment_number: nextNum + 1 }
        : { next_stock_number: nextNum + 1 }
      )
      .eq("id", tenantId);
    
    stockNumber = prefix + nextNum;
  } else {
    stockNumber = stockNumberData as string;
  }
  
  // Generate name from description and item type
  const name = description.slice(0, 100) || `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} ${stockNumber}`;
  
  // Generate SKU
  const { data: skuData } = await supabase.rpc("next_sku", { p_tenant_id: tenantId });
  const sku = skuData as string ?? stockNumber;
  
  // Same location policy as createInventoryItem — don't silently orphan
  // quick-add rows either. See src/lib/active-location.ts.
  if (!user?.id) return { error: "Not authenticated" };
  const locResolutionQA = await resolveLocationForCreate(tenantId, user.id);
  if (locResolutionQA.needsSelection) {
    return { error: LOCATION_REQUIRED_MESSAGE };
  }
  const activeLocationIdQA = locResolutionQA.locationId;
  const { data: item, error } = await supabase
    .from("inventory")
    .insert({
      tenant_id: tenantId,
      location_id: activeLocationIdQA,
      name,
      description,
      item_type: "finished_piece",
      jewellery_type: itemType,
      supplier_id: supplierId,
      cost_price: costPrice,
      retail_price: retailPrice,
      quantity: 1,
      // Schema canon is status='active' (matches createInventoryItem
      // and the inventory list / transfers page filter). 'available'
      // was a divergence — items added via Quick Add were invisible
      // to the transfers selector and the inventory list filter.
      status: "active",
      is_consignment: isConsignment,
      stock_number: stockNumber,
      sku,
      // `inventory.tags` does NOT exist on the live schema — earlier
      // INSERT silently failed when tags was non-empty (route returned
      // PGRST204) and otherwise succeeded but the tags array was lost.
      // Drop the field; reintroduce when a column is migrated.
      created_by: user?.id,
    })
    .select("id")
    .single();
  
  if (error) return { error: error.message };
  
  // Generate barcode
  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("slug, name")
      .eq("id", tenantId)
      .single();
    const tenantSlug = tenant?.slug ?? tenant?.name ?? tenantId.slice(0, 6);
    const barcodeValue = generateBarcodeValue(tenantSlug, stockNumber);
    await supabase.from("inventory").update({ barcode_value: barcodeValue }).eq("id", item.id);
  } catch {
    // barcode generation is non-critical
  }

  // Log audit event
  await logAuditEvent({
    tenantId,
    userId: user?.id,
    action: "inventory_create",
    entityType: "inventory",
    entityId: item.id,
    newData: { name, stockNumber, itemType, retailPrice, isConsignment },
  });
  
  revalidatePath("/inventory");
  return { id: item.id, stockNumber };
}

export async function updateStockPrices(
  itemId: string,
  costPrice: number | null,
  retailPrice: number
): Promise<{ success?: boolean; error?: string }> {
  // W3-RBAC-01: edit_inventory gate.
  try {
    await requirePermission("edit_inventory");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to update prices." : "Not authenticated" };
  }

  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);

  const { data: { user } } = await supabase.auth.getUser();
  const { hasPermission } = await import("@/lib/permissions");
  const canViewCost = await hasPermission(user?.id ?? "", tenantId, "view_cost_price");
  
  const updates: Record<string, number | null> = { retail_price: retailPrice };
  if (canViewCost && costPrice !== null) {
    updates.cost_price = costPrice;
  }
  
  const { error } = await supabase
    .from("inventory")
    .update(updates)
    .eq("id", itemId)
    .eq("tenant_id", tenantId);
  
  if (error) return { error: error.message };
  
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  return { success: true };
}

export async function updateStockStatus(
  itemId: string,
  status: string
): Promise<{ success?: boolean; error?: string }> {
  // W3-RBAC-01: edit_inventory gate.
  try {
    await requirePermission("edit_inventory");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to update stock status." : "Not authenticated" };
  }

  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);

  // `inventory.sold_via` does NOT exist on the live schema (verified
  // 2026-04-25). Earlier code wrote it on every status change → PGRST204
  // → status update returned an error to the UI. Drop sold_via writes;
  // sold_at is the only remaining column we update.
  const updates: Record<string, string | Date | null> = { status };
  if (status === "sold") {
    updates.sold_at = new Date().toISOString();
  } else {
    updates.sold_at = null;
  }
  
  const { error } = await supabase
    .from("inventory")
    .update(updates)
    .eq("id", itemId)
    .eq("tenant_id", tenantId);
  
  if (error) return { error: error.message };
  
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  return { success: true };
}

export async function listOnWebsite(itemId: string): Promise<{ success?: boolean; error?: string }> {
  // W3-RBAC-01: edit_inventory gate.
  try {
    await requirePermission("edit_inventory");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to list items on website." : "Not authenticated" };
  }

  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  
  // Check if tenant has website configured
  const { data: websiteConfig } = await supabase
    .from("website_config")
    .select("website_type")
    .eq("tenant_id", tenantId)
    .single();
  
  if (!websiteConfig?.website_type) {
    return { error: "No website configured" };
  }
  
  const { error } = await supabase
    .from("inventory")
    .update({ listed_on_website: true })
    .eq("id", itemId)
    .eq("tenant_id", tenantId);
  
  if (error) return { error: error.message };
  
  
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  return { success: true };
}

export async function archiveStockItem(itemId: string): Promise<{ success?: boolean; error?: string }> {
  // RBAC: archive is a destructive soft-delete. Owners/managers only.
  // Matches archiveInventoryItem policy — mutating stock needs edit_inventory,
  // but wiping it requires management.
  try {
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can archive stock items." };
    }
    await requirePermission("edit_inventory");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("permission_denied:")) return { error: "You don't have permission to edit inventory." };
    if (msg === "subscription_required") return { error: "Your subscription is inactive. Please update billing to continue." };
    return { error: "Not authenticated" };
  }
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  const { data: { user } } = await supabase.auth.getUser();

  // Get item data for audit
  const { data: item } = await supabase
    .from("inventory")
    .select("name, sku, stock_number")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .single();
  
  const { error } = await supabase
    .from("inventory")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("tenant_id", tenantId);
  
  if (error) return { error: error.message };

  // Log audit event
  await logAuditEvent({
    tenantId,
    userId: user?.id,
    action: "inventory_delete",
    entityType: "inventory",
    entityId: itemId,
    oldData: item || undefined,
  });
  
  revalidatePath("/inventory");
  return { success: true };
}

export async function initializeStockNumbers(): Promise<{ success?: boolean; error?: string }> {
  // W3-RBAC-01: this rewrites tenant-wide stock numbering. Restrict to
  // owner/manager (matches deleteLocation / saveBanking bucket) + still
  // requires edit_inventory.
  try {
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can initialize stock numbers." };
    }
    await requirePermission("edit_inventory");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    if (msg === "subscription_required") return { error: "Your subscription is inactive." };
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to do that." : "Not authenticated" };
  }

  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);

  const { error } = await supabase.rpc("initialize_stock_numbers", { p_tenant_id: tenantId });

  if (error) return { error: error.message };
  return { success: true };
}

// AI-powered categorization for inventory items
export interface AICategorization {
  itemType: string;
  jewelleryType: string | null;
  metalType: string | null;
  metalColour: string | null;
  metalPurity: string | null;
  stoneType: string | null;
  stoneColour: string | null;
  stoneClarity: string | null;
  suggestedCategory: string | null;
  confidence: number;
}

export async function categorizeWithAI(
  itemName: string,
  description?: string
): Promise<{ data?: AICategorization; error?: string }> {
  // W3-LOW-05 + W3-RBAC-01: must be authed + hold edit_inventory. Prevents
  // OpenAI cost-burning via a leaked session.
  try {
    await requirePermission("edit_inventory");
  } catch {
    return { error: "Not authenticated" };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return { error: "AI categorization not configured" };
  }

  const prompt = `You are a jewellery expert. Analyze this item and categorize it.

Item Name: ${itemName}
${description ? `Description: ${description}` : ""}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "itemType": "finished_piece" | "loose_stone" | "finding" | "raw_material" | "packaging",
  "jewelleryType": "ring" | "necklace" | "bracelet" | "earring" | "pendant" | "bangle" | "brooch" | "other" | null,
  "metalType": "Gold" | "Silver" | "Platinum" | "Palladium" | "Titanium" | "Steel" | "Other" | null,
  "metalColour": "Yellow" | "White" | "Rose" | "Two-tone" | null,
  "metalPurity": "9ct" | "14ct" | "18ct" | "22ct" | "24ct" | "925" | "950" | "999" | null,
  "stoneType": "Diamond" | "Sapphire" | "Ruby" | "Emerald" | "Amethyst" | "Aquamarine" | "Opal" | "Pearl" | "Other" | null,
  "stoneColour": "White" | "Blue" | "Red" | "Green" | "Yellow" | "Pink" | "Purple" | "Black" | "Other" | null,
  "stoneClarity": "FL" | "IF" | "VVS1" | "VVS2" | "VS1" | "VS2" | "SI1" | "SI2" | "I1" | "I2" | "I3" | null,
  "suggestedCategory": string describing the category (e.g., "Engagement Rings", "Diamond Pendants", "Gold Chains") | null,
  "confidence": number between 0 and 1 indicating how confident you are
}

Rules:
- itemType is required, others can be null if not determinable
- Only use jewelleryType if itemType is "finished_piece"
- Be precise with metal purity (18ct gold, 925 silver, etc.)
- For loose stones, focus on stone attributes
- confidence should be lower if the name is vague`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      return { error: "Failed to connect to AI service" };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    if (!content) {
      return { error: "No response from AI" };
    }

    // Parse the JSON response
    const parsed = JSON.parse(content.trim()) as AICategorization;
    return { data: parsed };
  } catch (err) {
    console.error("AI categorization error:", err);
    return { error: "Failed to parse AI response" };
  }
}
