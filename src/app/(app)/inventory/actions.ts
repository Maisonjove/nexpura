"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { generateBarcodeValue } from "@/lib/barcode";
import { logAuditEvent } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!data?.tenant_id) throw new Error("No tenant");
  return data.tenant_id as string;
}

export async function createInventoryItem(formData: FormData) {
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
  const core: Record<string, unknown> = {
    tenant_id: tenantId,
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

  // Create initial stock movement if quantity > 0
  if (quantity > 0) {
    const { error: smError } = await supabase.from("stock_movements").insert({
      tenant_id: tenantId,
      inventory_id: item.id,
      movement_type: "purchase",
      quantity_change: quantity,
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
      // Advanced fields
      certificate_number: (formData.get("certificate_number") as string) || null,
      grading_lab: (formData.get("grading_lab") as string) || null,
      grade: (formData.get("grade") as string) || null,
      report_url: (formData.get("report_url") as string) || null,
      stock_location: (formData.get("stock_location") as string) || "display",
      metal_form: (formData.get("metal_form") as string) || null,
      consignor_name: (formData.get("consignor_name") as string) || null,
      consignor_contact: (formData.get("consignor_contact") as string) || null,
      consignment_start_date: (formData.get("consignment_start_date") as string) || null,
      consignment_end_date: (formData.get("consignment_end_date") as string) || null,
      consignment_commission_pct: formData.get("consignment_commission_pct") ? parseFloat(formData.get("consignment_commission_pct") as string) : null,
      supplier_invoice_ref: (formData.get("supplier_invoice_ref") as string) || null,
      secondary_stones: secondaryStones,
  };

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
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  const { data: { user } } = await supabase.auth.getUser();

  // Get current quantity
  const { data: item, error: fetchError } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("id", inventoryId)
    .eq("tenant_id", tenantId)
    .single();

  if (fetchError || !item) throw new Error("Item not found");

  const oldQuantity = item.quantity;
  const newQuantity = oldQuantity + quantityChange;
  if (newQuantity < 0) throw new Error("Stock cannot go below 0");

  // Atomic update with conditional check (race-safe)
  const { error: updateError, count } = await supabase
    .from("inventory")
    .update({ quantity: newQuantity })
    .eq("id", inventoryId)
    .eq("tenant_id", tenantId)
    .eq("quantity", oldQuantity); // Only update if quantity unchanged

  // If race occurred, retry with current quantity
  let finalQuantity = newQuantity;
  if (updateError || count === 0) {
    const { data: itemRetry } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("id", inventoryId)
      .eq("tenant_id", tenantId)
      .single();
    
    if (!itemRetry) throw new Error("Item not found on retry");
    
    finalQuantity = itemRetry.quantity + quantityChange;
    if (finalQuantity < 0) throw new Error("Stock cannot go below 0");
    
    const { error: retryError } = await supabase
      .from("inventory")
      .update({ quantity: finalQuantity })
      .eq("id", inventoryId)
      .eq("tenant_id", tenantId);
    
    if (retryError) throw new Error(retryError.message);
  }

  // Insert movement with accurate final quantity (immutable)
  const { error: movError } = await supabase.from("stock_movements").insert({
    tenant_id: tenantId,
    inventory_id: inventoryId,
    movement_type: movementType,
    quantity_change: quantityChange,
    quantity_after: finalQuantity,
    notes: notes || null,
    created_by: user?.id,
  });

  if (movError) throw new Error(movError.message);

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
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);

  const { data, error } = await supabase
    .from("stock_categories")
    .insert({ tenant_id: tenantId, name, description: description || null })
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

  const { data, error } = await supabase
    .from("inventory")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .or(`barcode_value.eq.${barcode},sku.eq.${barcode}`)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Item not found" };
  return { id: data.id, name: data.name };
}

export async function generateBarcodeForItem(itemId: string): Promise<{ success?: boolean; error?: string; barcodeValue?: string }> {
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
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ tenant_id: tenantId, name })
    .select("id")
    .single();
  
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function quickAddStock(formData: FormData): Promise<{ id?: string; stockNumber?: string; error?: string }> {
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  const { data: { user } } = await supabase.auth.getUser();
  
  const isConsignment = formData.get("is_consignment") === "true";
  const description = formData.get("description") as string;
  const itemType = formData.get("item_type") as string;
  const supplierId = formData.get("supplier_id") as string || null;
  const costPriceRaw = formData.get("cost_price") as string;
  const retailPriceRaw = formData.get("retail_price") as string;
  const tagsRaw = formData.get("tags") as string;
  
  const costPrice = costPriceRaw ? parseFloat(costPriceRaw) : null;
  const retailPrice = retailPriceRaw ? parseFloat(retailPriceRaw) : 0;
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
  
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
  
  const { data: item, error } = await supabase
    .from("inventory")
    .insert({
      tenant_id: tenantId,
      name,
      description,
      item_type: "finished_piece",
      jewellery_type: itemType,
      supplier_id: supplierId,
      cost_price: costPrice,
      retail_price: retailPrice,
      quantity: 1,
      status: "available",
      is_consignment: isConsignment,
      stock_number: stockNumber,
      sku,
      tags,
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
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  
  const updates: Record<string, string | Date | null> = { status };
  
  // If marking as sold, set sold_at and sold_via
  if (status === "sold") {
    updates.sold_at = new Date().toISOString();
    updates.sold_via = "manual";
  } else {
    // Clear sold fields if changing from sold
    updates.sold_at = null;
    updates.sold_via = null;
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
