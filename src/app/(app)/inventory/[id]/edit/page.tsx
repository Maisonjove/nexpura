import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import InventoryForm from "../../InventoryForm";

import { hasPermission } from "@/lib/permissions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInventoryPage({ params }: PageProps) {
  const [{ id }, headersList, supabase] = await Promise.all([
    params,
    headers(),
    createClient(),
  ]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  const userId = headersList.get(AUTH_HEADERS.USER_ID);
  if (!tenantId || !userId) redirect("/login");

  const [{ data: item }, { data: categories }, canViewCost] = await Promise.all([
    supabase
      .from("inventory")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("stock_categories")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name"),
    hasPermission(userId, tenantId, "view_cost_price"),
  ]);

  if (!item) notFound();

  if (!canViewCost) {
    item.cost_price = null;
    item.wholesale_price = null;
  }

  const typedItem = item as {
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
  };

  return (
    <InventoryForm
      categories={categories ?? []}
      item={typedItem}
      mode="edit"
    />
  );
}
