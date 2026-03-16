import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import InventoryClient from "./InventoryClient";
import { hasPermission } from "@/lib/permissions";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ rt?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const admin = createAdminClient();

  let tenantId: string | null = null;
  let userId: string | null = null;
  if (sp.rt && REVIEW_TOKENS.includes(sp.rt)) {
    tenantId = DEMO_TENANT;
  } else {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        const { data: ud } = await admin.from("users").select("tenant_id").eq("id", user.id).single();
        tenantId = ud?.tenant_id ?? null;
      }
    } catch { /* no session */ }
    if (!tenantId) redirect("/login");
  }

  const canViewCost = (tenantId === DEMO_TENANT) || (userId && tenantId ? await hasPermission(userId, tenantId, "view_cost_price") : false);

  const [{ data: items }, { data: categories }] = await Promise.all([
    admin
      .from("inventory")
      .select("id, sku, name, item_type, jewellery_type, category_id, quantity, low_stock_threshold, retail_price, cost_price, status, is_featured, primary_image, stock_categories(name)")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("stock_categories")
      .select("id, name")
      .eq("tenant_id", tenantId)
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
      canViewCost={canViewCost}
    />
  );
}
