import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import ItemDetailClient from "./ItemDetailClient";
import InventoryPhotos from "./InventoryPhotos";
import { resolveReadLocationScope } from "@/lib/location-read-scope";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";
import { signStoragePath, signStoragePaths } from "@/lib/supabase/signed-urls";

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

  // Fetch item + movements in parallel.
  //
  // Cluster-PR item 6 (R5 Finding 7):
  // Pre-fix the movements select embedded `users(full_name)`, but
  // stock_movements.created_by FKs auth.users — NOT public.users — so
  // PostgREST couldn't resolve the embed and returned [] for the whole
  // query. Tenant 316a3313 had 3 movements on inventory item
  // "QA A1 Test Pendant" yet the panel rendered "No movements recorded
  // yet". Fix: drop the embed, fetch movements by inventory_id +
  // tenant_id (defence-in-depth), then resolve created_by → full_name
  // via a follow-up batch lookup on public.users (the IDs match — both
  // tables share the auth user UUID).
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
      .select("id, movement_type, quantity_change, quantity_after, notes, created_at, created_by")
      .eq("inventory_id", id)
      .eq("tenant_id", tenantId)
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

  // Resolve created_by → full_name via a follow-up lookup on
  // public.users (the embed cannot be used — see comment above the
  // movements query). Batch-by-IDs to avoid N+1.
  const rawMovements = (movementsResult.data ?? []) as Array<{
    id: string;
    movement_type: string;
    quantity_change: number;
    quantity_after: number;
    notes: string | null;
    created_at: string;
    created_by: string | null;
  }>;
  const userIds = Array.from(
    new Set(
      rawMovements.map((m) => m.created_by).filter((u): u is string => !!u),
    ),
  );
  let userNameById = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: usersData } = await admin
      .from("users")
      .select("id, full_name")
      .in("id", userIds);
    userNameById = new Map(
      (usersData ?? []).map((u) => [u.id as string, (u.full_name as string | null) ?? null]),
    );
  }
  const typedMovements = rawMovements.map((m) => ({
    ...m,
    users: m.created_by
      ? { full_name: userNameById.get(m.created_by) ?? null }
      : null,
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

  // cleanup #18 — `inventory-photos` bucket is private; the DB now stores
  // bare paths. Resolve to 7-day signed URLs server-side so the client
  // can render <Image src=…/> directly without re-signing on mount.
  const additionalPaths = (rawItem.images ?? []) as string[];
  const [primaryImageDisplayUrl, additionalImageDisplayUrlsRaw] = await Promise.all([
    signStoragePath(admin, "inventory-photos", rawItem.primary_image ?? null),
    signStoragePaths(admin, "inventory-photos", additionalPaths),
  ]);
  const additionalImageDisplayUrls = additionalImageDisplayUrlsRaw.filter((u): u is string => !!u);

  return (
    <>
      <ItemDetailClient item={typedItem} movements={typedMovements} readOnly={isReviewMode} />
      <div className="mt-6">
        <InventoryPhotos
          itemId={id}
          tenantId={tenantId}
          primaryImagePath={rawItem.primary_image ?? null}
          primaryImageDisplayUrl={primaryImageDisplayUrl}
          additionalImagePaths={additionalPaths}
          additionalImageDisplayUrls={additionalImageDisplayUrls}
          readOnly={isReviewMode}
        />
      </div>
    </>
  );
}
