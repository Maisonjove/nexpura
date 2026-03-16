import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import ItemDetailClient from "./ItemDetailClient";
import InventoryPhotos from "./InventoryPhotos";
import { hasPermission } from "@/lib/permissions";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function InventoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ rt?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const admin = createAdminClient();

  let tenantId: string | null = null;
  let userId: string | null = null;
  const isReviewMode = !!(sp.rt && REVIEW_TOKENS.includes(sp.rt));
  if (isReviewMode) {
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
    } catch { }
    if (!tenantId) redirect("/login");
  }

  const canViewCost = (tenantId === DEMO_TENANT) || (userId && tenantId ? await hasPermission(userId, tenantId, "view_cost_price") : false);

  const { data: item, error } = await admin
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
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (error || !item) notFound();

  if (!canViewCost) {
    item.cost_price = null;
    item.wholesale_price = null;
  }

  const { data: movements } = await admin
    .from("stock_movements")
    .select("id, movement_type, quantity_change, quantity_after, notes, created_at, created_by, users(full_name)")
    .eq("inventory_id", id)
    .order("created_at", { ascending: false });

  const typedItem = item as any;
  const typedMovements = movements as any[];

  const rawItem = item as unknown as { primary_image?: string | null; images?: string[] | null };

  return (
    <>
      <ItemDetailClient item={typedItem} movements={typedMovements} readOnly={isReviewMode} />
      <div className="mt-6">
        <InventoryPhotos
          itemId={id}
          tenantId={tenantId}
          primaryImage={rawItem.primary_image ?? null}
          additionalImages={(rawItem.images ?? []) as string[]}
          readOnly={isReviewMode}
        />
      </div>
    </>
  );
}
