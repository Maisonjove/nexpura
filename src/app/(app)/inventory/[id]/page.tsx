import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ItemDetailClient from "./ItemDetailClient";
import InventoryPhotos from "./InventoryPhotos";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InventoryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Get current user's tenant_id
  const { data: { user } } = await supabase.auth.getUser();
  const { data: userData } = user
    ? await supabase.from("users").select("tenant_id").eq("id", user.id).single()
    : { data: null };
  const tenantId = userData?.tenant_id ?? "";

  const { data: item, error } = await supabase
    .from("inventory")
    .select(`
      id, sku, barcode, name, item_type, jewellery_type, category_id,
      description, metal_type, metal_colour, metal_purity, metal_weight_grams,
      stone_type, stone_carat, stone_colour, stone_clarity,
      ring_size, dimensions, cost_price, wholesale_price, retail_price,
      quantity, low_stock_threshold, track_quantity,
      supplier_name, supplier_sku, is_featured, status,
      stock_categories(name)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !item) notFound();

  const { data: movements } = await supabase
    .from("stock_movements")
    .select("id, movement_type, quantity_change, quantity_after, notes, created_at, created_by, users(full_name)")
    .eq("inventory_id", id)
    .order("created_at", { ascending: false });

  const typedItem = item as unknown as {
    id: string;
    sku: string | null;
    barcode: string | null;
    name: string;
    item_type: string;
    jewellery_type: string | null;
    category_id: string | null;
    description: string | null;
    metal_type: string | null;
    metal_colour: string | null;
    metal_purity: string | null;
    metal_weight_grams: number | null;
    stone_type: string | null;
    stone_carat: number | null;
    stone_colour: string | null;
    stone_clarity: string | null;
    ring_size: string | null;
    dimensions: string | null;
    cost_price: number | null;
    wholesale_price: number | null;
    retail_price: number;
    quantity: number;
    low_stock_threshold: number | null;
    track_quantity: boolean;
    supplier_name: string | null;
    supplier_sku: string | null;
    is_featured: boolean;
    status: string;
    stock_categories: { name: string } | null;
  };

  const typedMovements = (movements ?? []) as unknown as Array<{
    id: string;
    movement_type: string;
    quantity_change: number;
    quantity_after: number;
    notes: string | null;
    created_at: string;
    created_by: string | null;
    users: { full_name: string | null } | null;
  }>;

  const rawItem = item as unknown as { primary_image?: string | null; images?: string[] | null };

  return (
    <>
      <ItemDetailClient item={typedItem} movements={typedMovements} />
      <div className="mt-6">
        <InventoryPhotos
          itemId={id}
          tenantId={tenantId}
          primaryImage={rawItem.primary_image ?? null}
          additionalImages={(rawItem.images ?? []) as string[]}
        />
      </div>
    </>
  );
}
