import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { getAuthContext } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import InventoryClient from "./InventoryClient";

export const metadata = { title: "Inventory — Nexpura" };

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];
const ITEMS_PER_PAGE = 100; // Initial load limit for performance

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ rt?: string; page?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const admin = createAdminClient();
  const page = parseInt(sp.page || "1", 10);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const isReviewMode = !!(sp.rt && REVIEW_TOKENS.includes(sp.rt));

  // Resolve tenantId as fast as possible.
  // For auth users: read from middleware-set header (instant, no DB round-trip).
  // For review mode: use the demo tenant constant.
  let tenantId: string;

  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const headersList = await headers();
    const headerTenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
    if (!headerTenantId) redirect("/login");
    tenantId = headerTenantId;
  }

  // Items + count are now tag-cached per-tenant via the `inventory:{tenantId}`
  // tag. Mutations in inventory/actions.ts (create/update/adjust-stock/delete)
  // and sales/actions.ts (stock-decrement on sale) call revalidateTag so
  // new/updated items appear on next nav.
  const fetchInventoryPage = unstable_cache(
    async () => {
      const [itemsResult, countResult] = await Promise.all([
        admin
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
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1),
        admin
          .from("inventory")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null),
      ]);
      return {
        items: itemsResult.data ?? [],
        count: countResult.count ?? 0,
      };
    },
    ["inventory-list", tenantId, String(page)],
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
    />
  );
}
