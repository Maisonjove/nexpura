"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
    const { data: skuData } = await supabase.rpc("next_sku", { p_tenant_id: tenantId });
    sku = skuData as string;
  }

  const { data: item, error } = await supabase
    .from("inventory")
    .insert({
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
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Create initial stock movement if quantity > 0
  if (quantity > 0) {
    await supabase.from("stock_movements").insert({
      tenant_id: tenantId,
      inventory_id: item.id,
      movement_type: "purchase",
      quantity_change: quantity,
      quantity_after: quantity,
      notes: "Initial stock",
      created_by: user?.id,
    });
  }

  revalidatePath("/inventory");
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

  const { error } = await supabase
    .from("inventory")
    .update({
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
      low_stock_threshold: lowStockThreshold,
      track_quantity: trackQuantity,
      barcode: barcode || null,
      supplier_name: supplierName || null,
      supplier_sku: supplierSku || null,
      is_featured: isFeatured,
      status,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);

  revalidatePath(`/inventory/${id}`);
  revalidatePath(`/inventory/${id}/edit`);
  revalidatePath("/inventory");
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

  const newQuantity = item.quantity + quantityChange;
  if (newQuantity < 0) throw new Error("Stock cannot go below 0");

  // Insert movement (immutable)
  const { error: movError } = await supabase.from("stock_movements").insert({
    tenant_id: tenantId,
    inventory_id: inventoryId,
    movement_type: movementType,
    quantity_change: quantityChange,
    quantity_after: newQuantity,
    notes: notes || null,
    created_by: user?.id,
  });

  if (movError) throw new Error(movError.message);

  // Update inventory quantity
  const { error: updateError } = await supabase
    .from("inventory")
    .update({ quantity: newQuantity })
    .eq("id", inventoryId)
    .eq("tenant_id", tenantId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/inventory/${inventoryId}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function archiveInventoryItem(id: string) {
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);

  const { error } = await supabase
    .from("inventory")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);

  revalidatePath("/inventory");
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
