import { createClient } from "@/lib/supabase/server";
import InventoryClient from "./InventoryClient";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;

  const [{ data: items }, { data: categories }] = await Promise.all([
    supabase
      .from("inventory")
      .select("id, sku, name, item_type, jewellery_type, category_id, quantity, low_stock_threshold, retail_price, cost_price, status, is_featured, stock_categories(name)")
      .eq("tenant_id", tenantId ?? "")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("stock_categories")
      .select("id, name")
      .eq("tenant_id", tenantId ?? "")
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
    <InventoryClient
      items={safeItems}
      categories={categories ?? []}
      totalItems={totalItems}
      lowStockCount={lowStockCount}
      totalValue={totalValue}
    />
  );
}
