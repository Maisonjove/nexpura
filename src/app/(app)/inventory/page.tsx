import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { getAuthContext } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import InventoryClient from "./InventoryClient";
import { locationScopeFilter } from "@/lib/location-read-scope";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";

export const metadata = { title: "Inventory — Nexpura" };

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const ITEMS_PER_PAGE = 100; // Initial load limit for performance

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ rt?: string; page?: string; status?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const admin = createAdminClient();
  const page = parseInt(sp.page || "1", 10);
  const offset = (page - 1) * ITEMS_PER_PAGE;
  // Section 6.2 (Kaitlyn 2026-05-02 brief): the dashboard "Low Stock" KPI
  // chip routes here with ?status=low-stock. When that filter is active
  // we render the focused page header + KPI strip and only fetch items
  // where quantity <= low_stock_threshold (the schema's actual field).
  const lowStockOnly = sp.status === "low-stock";

  // W7-HIGH-04: env-backed constant-time check.
  const isReviewMode = matchesReviewOrStaffToken(sp.rt);

  // Resolve tenantId as fast as possible.
  // For auth users: read from middleware-set header (instant, no DB round-trip).
  // For review mode: use the demo tenant constant.
  let tenantId: string;

  let userId: string | null = null;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const headersList = await headers();
    const headerTenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
    if (!headerTenantId) redirect("/login");
    tenantId = headerTenantId;
    userId = headersList.get(AUTH_HEADERS.USER_ID);
  }

  // Location-scope for restricted users. Computed OUTSIDE the cache
  // callback so the cache key can include the user's location scope
  // — otherwise two users with different allowed_location_ids would
  // share a cached snapshot.
  const locationFilter = !isReviewMode && userId
    ? await locationScopeFilter(userId, tenantId)
    : null;
  const locationCacheKey = locationFilter ?? "all";

  // Items + count are now tag-cached per-tenant via the `inventory:{tenantId}`
  // tag. Mutations in inventory/actions.ts (create/update/adjust-stock/delete)
  // and sales/actions.ts (stock-decrement on sale) call revalidateTag so
  // new/updated items appear on next nav.
  const fetchInventoryPage = unstable_cache(
    async () => {
      let itemsQuery = admin
        .from("inventory")
        .select(`
            id,
            sku,
            name,
            description,
            item_type,
            jewellery_type,
            category_id,
            quantity,
            low_stock_threshold,
            retail_price,
            cost_price,
            status,
            is_featured,
            primary_image,
            stock_number,
            is_consignment,
            listed_on_website,
            supplier_id,
            metal_type,
            stone_type,
            metal_weight_grams,
            barcode_value,
            tags,
            created_at,
            stock_categories(name),
            suppliers(name)
          `)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      let countQuery = admin
        .from("inventory")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      if (locationFilter) {
        itemsQuery = itemsQuery.or(locationFilter);
        countQuery = countQuery.or(locationFilter);
      }
      // Low-stock filter — Postgres can't compare two columns inside a
      // PostgREST `.lte("quantity", "low_stock_threshold")` expression
      // (the second arg is treated as a literal), so we filter the items
      // in-memory after the query returns. With ITEMS_PER_PAGE=100 this
      // is trivially cheap and avoids needing an RPC.
      const [itemsResult, countResult] = await Promise.all([
        itemsQuery.order("created_at", { ascending: false }).range(offset, offset + ITEMS_PER_PAGE - 1),
        countQuery,
      ]);
      const allItems = itemsResult.data ?? [];
      const filteredItems = lowStockOnly
        ? allItems.filter(
            (i: { quantity: number; low_stock_threshold: number | null }) =>
              i.quantity <= (i.low_stock_threshold ?? 1)
          )
        : allItems;
      return {
        items: filteredItems,
        count: lowStockOnly ? filteredItems.length : (countResult.count ?? 0),
      };
    },
    ["inventory-list", tenantId, String(page), locationCacheKey, lowStockOnly ? "low" : "all"],
    { tags: [CACHE_TAGS.inventory(tenantId)], revalidate: 3600 }
  );

  // Run auth + all support data in parallel with the cached list payload.
  const [auth, listPayload, categories, suppliers, websiteConfig] =
    await Promise.all([
      // Auth: validates session and loads permissions from Redis cache
      isReviewMode ? Promise.resolve(null) : getAuthContext(),

      fetchInventoryPage(),

      // Categories - cache for 5 minutes
      getCached(
        tenantCacheKey(tenantId, "stock-categories"),
        async () => {
          const { data } = await admin
            .from("stock_categories")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .order("name");
          return data ?? [];
        },
        300
      ),

      // Suppliers - cache for 5 minutes
      getCached(
        tenantCacheKey(tenantId, "suppliers"),
        async () => {
          const { data } = await admin
            .from("suppliers")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .order("name");
          return data ?? [];
        },
        300
      ),

      // Website config - cache for 5 minutes
      getCached(
        tenantCacheKey(tenantId, "website-config"),
        async () => {
          const { data } = await admin
            .from("website_config")
            .select("website_type")
            .eq("tenant_id", tenantId)
            .maybeSingle();
          return data;
        },
        300
      ),
    ]);

  // Auth check (only for non-review-mode)
  if (!isReviewMode && !auth) redirect("/login");

  const canViewCost = isReviewMode ? true : (auth?.permissions.view_cost_price ?? false);
  const tenantName = auth?.tenantName ?? "Nexpura";

  const safeItems = (listPayload.items ?? []) as unknown as Array<{
    id: string;
    sku: string | null;
    name: string;
    description: string | null;
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
    stock_number: string | null;
    is_consignment: boolean;
    listed_on_website: boolean;
    supplier_id: string | null;
    metal_type: string | null;
    stone_type: string | null;
    metal_weight_grams: number | null;
    barcode_value: string | null;
    tags: string[] | null;
    created_at: string;
    stock_categories: { name: string } | null;
    suppliers: { name: string } | null;
  }>;

  const totalItems = listPayload.count ?? safeItems.length;
  const lowStockCount = safeItems.filter(
    (i) => i.quantity <= (i.low_stock_threshold ?? 1)
  ).length;
  const totalValue = safeItems.reduce(
    (sum, i) => sum + i.retail_price * i.quantity,
    0
  );
  const hasWebsite = !!websiteConfig?.website_type;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // When the low-stock filter is active, count "critical stock" as items
  // already at zero (or below threshold by ≥50%) so the KPI strip has a
  // distinct oxblood metric vs. the warning-amber low-stock total.
  const criticalCount = lowStockOnly
    ? safeItems.filter((i) => i.quantity === 0).length
    : 0;
  const materialsCount = lowStockOnly
    ? safeItems.filter((i) => i.item_type === "material").length
    : 0;
  // Estimated reorder value — sum of (threshold - quantity) * cost_price
  // for items below threshold. Falls back to retail_price when cost is null.
  const estimatedReorderValue = lowStockOnly
    ? safeItems.reduce((sum, i) => {
        const gap = Math.max((i.low_stock_threshold ?? 1) - i.quantity, 0);
        const unitCost = i.cost_price ?? i.retail_price;
        return sum + gap * unitCost;
      }, 0)
    : 0;

  return (
    <InventoryClient
      items={safeItems}
      categories={categories}
      suppliers={suppliers}
      totalItems={totalItems}
      lowStockCount={lowStockCount}
      totalValue={totalValue}
      canViewCost={canViewCost}
      hasWebsite={hasWebsite}
      tenantName={tenantName}
      currentPage={page}
      totalPages={totalPages}
      itemsPerPage={ITEMS_PER_PAGE}
      lowStockOnly={lowStockOnly}
      criticalCount={criticalCount}
      materialsCount={materialsCount}
      estimatedReorderValue={estimatedReorderValue}
    />
  );
}
