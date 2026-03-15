import { createAdminClient } from "@/lib/supabase/admin";
import ItemDetailClient from "@/app/(app)/inventory/[id]/ItemDetailClient";
import InventoryPhotos from "@/app/(app)/inventory/[id]/InventoryPhotos";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const DEFAULT_ID = "67940b89-90ed-43b7-96a5-7bfc14d1ed79";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewInventoryDetailPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = rawId || DEFAULT_ID;
  const admin = createAdminClient();

  const { data: item } = await admin
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
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .single();

  if (!item) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Item Not Found</h1>
        <p className="text-stone-500">This inventory item doesn&apos;t exist in the demo data.</p>
      </div>
    );
  }

  // Hide cost for review
  const safeItem = { ...item, cost_price: null, wholesale_price: null };

  const { data: movements } = await admin
    .from("stock_movements")
    .select("id, movement_type, quantity_change, quantity_after, notes, created_at, created_by, users(full_name)")
    .eq("inventory_id", id)
    .order("created_at", { ascending: false });

  const typedItem = safeItem as unknown as {
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
      <ItemDetailClient item={typedItem} movements={typedMovements} readOnly={true} />
      <div className="mt-6">
        <InventoryPhotos
          itemId={id}
          tenantId={TENANT_ID}
          primaryImage={rawItem.primary_image ?? null}
          additionalImages={(rawItem.images ?? []) as string[]}
        />
      </div>
    </>
  );
}
