import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import ItemDetailClient from "./ItemDetailClient";
import InventoryPhotos from "./InventoryPhotos";
import { resolveReadLocationScope } from "@/lib/location-read-scope";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

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
  let canViewCost = false;
  // W7-HIGH-04: env-backed constant-time check.
  const isReviewMode = matchesReviewOrStaffToken(sp.rt);

  if (isReviewMode) {
    tenantId = DEMO_TENANT;
    canViewCost = true;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
    userId = auth.userId;
    canViewCost = auth.permissions.view_cost_price;
  }

  // Fetch item + movements in parallel
  const [itemResult, movementsResult] = await Promise.all([
    admin
      .from("inventory")
      .select(`
        id, sku, barcode, name, item_type, jewellery_type, category_id,
        description, metal_type, metal_colour, metal_purity, metal_weight_grams,
        stone_type, stone_carat, stone_colour, stone_clarity,
        ring_size, dimensions, cost_price, wholesale_price, retail_price,
        quantity, low_stock_threshold, track_quantity,
        supplier_name, supplier_sku, is_featured, status, primary_image, images,
        location_id,
        stock_categories(name)
      `)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single(),
    admin
      .from("stock_movements")
      .select("id, movement_type, quantity_change, quantity_after, notes, created_at, created_by, users(full_name)")
      .eq("inventory_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const { data: item, error } = itemResult;
  if (error || !item) notFound();

  // Location-scope read guard — see src/lib/location-read-scope.ts.
  if (!isReviewMode && userId && item.location_id) {
    const scope = await resolveReadLocationScope(userId, tenantId);
    if (!scope.all && !scope.allowedIds.includes(item.location_id)) notFound();
  }

  // Strip cost if no permission
  if (!canViewCost) {
    item.cost_price = null;
    item.wholesale_price = null;
  }

  const typedItem = item as typeof item & { stock_categories?: { name: string } | null };
  const typedMovements = (movementsResult.data ?? []).map(m => ({
    ...m,
    users: Array.isArray(m.users) ? m.users[0] ?? null : m.users
  })) as Array<{
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
