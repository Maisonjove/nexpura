import { createAdminClient } from "@/lib/supabase/admin";
import { Suspense } from "react";
import InventoryClient from "@/app/(app)/inventory/InventoryClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewInventoryPage() {
  const admin = createAdminClient();

  const [{ data: items }, { data: categories }] = await Promise.all([
    admin
      .from("inventory")
      .select("id, sku, name, item_type, jewellery_type, category_id, quantity, low_stock_threshold, retail_price, cost_price, status, is_featured, primary_image, metal_type, metal_colour, metal_purity, stone_type, stone_carat, metal_weight_grams, stock_categories(name)")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("stock_categories")
      .select("id, name")
      .eq("tenant_id", TENANT_ID)
      .order("name"),
  ]);

  const safeItems = (items ?? []) as unknown as Array<{
    id: string;
    sku: string | null;
    name: string;
    item_type: string;
    jewellery_type: string | null;
    category_id: string | null;
    quantity: number;
    low_stock_threshold: number | null;
    retail_price: number;
    cost_price: number | null;
    status: string;
    is_featured: boolean;
    primary_image: string | null;
    metal_type: string | null;
    metal_colour: string | null;
    metal_purity: string | null;
    stone_type: string | null;
    stone_carat: number | null;
    metal_weight_grams: number | null;
    stock_categories: { name: string } | null;
  }>;

  const totalItems = safeItems.length;
  const lowStockCount = safeItems.filter(
    (i) => i.quantity <= (i.low_stock_threshold ?? 1)
  ).length;
  const totalValue = safeItems.reduce(
    (sum, i) => sum + i.retail_price * i.quantity,
    0
  );

  return (
    <Suspense fallback={<div className="p-8 text-stone-400 text-sm">Loading inventory...</div>}>
      <InventoryClient
        items={safeItems}
        categories={categories ?? []}
        totalItems={totalItems}
        lowStockCount={lowStockCount}
        totalValue={totalValue}
        canViewCost={false}
      />
    </Suspense>
  );
}
