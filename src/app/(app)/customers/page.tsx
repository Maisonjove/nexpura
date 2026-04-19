import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthContext } from "@/lib/auth-context";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import { getCached, tenantCacheKey } from "@/lib/cache";
import CustomerListClient from "./CustomerListClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

const DEFAULT_PAGE_SIZE = 200;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; page?: string; rt?: string }>;
}) {
  const params = await searchParams;
  // `q` is the ONLY filter that still hits the server — it lets deep-link
  // URLs and the client-side "Search all customers" escape hatch look past
  // the recent-200 cap with a full-tenant ILIKE match. Tag filtering and
  // sort are now entirely client-side over the loaded set.
  const q = params.q || "";
  // `?page=N` is preserved as a paging escape hatch for tenants with >200
  // customers — mostly used via the "Load older" button on the client, or
  // via deep-link. Default view is always page 1 with the 200 most recent.
  const page = parseInt(params.page || "1");
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const admin = createAdminClient();

  const isReviewMode = !!(params.rt && REVIEW_TOKENS.includes(params.rt));

  let tenantId: string;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const headersList = await headers();
    const headerTenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
    if (!headerTenantId) redirect("/login");
    tenantId = headerTenantId;
  }

  // List query — no count:"exact" here. Combining list+count in one request
  // forces PostgREST to run a SELECT COUNT(*) alongside the ranged fetch,
  // which on a 200k+-row table with deleted_at filter causes an index scan
  // and adds hundreds of ms to TTFB on every nav. Count is fetched
  // separately below and cached.
  let listQuery = admin
    .from("customers")
    .select(
      "id, full_name, first_name, last_name, email, phone, mobile, tags, is_vip, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (q) {
    listQuery = listQuery.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,mobile.ilike.%${q}%`
    );
  }

  listQuery = listQuery
    .order("created_at", { ascending: false })
    .range(offset, offset + DEFAULT_PAGE_SIZE - 1);

  // Count query — head-only (no row serialization) + 30-second per-tenant
  // Redis cache. Cache is keyed on tenant + search `q` so deep-link search
  // URLs still get accurate totals, but the default /customers view is
  // served count-from-cache after the first hit of a 30s window.
  // Freshness trade-off: exact total may lag by up to 30s after a create/
  // delete. Acceptable — the list itself (and the "Showing X of TOTAL"
  // label) stays coherent because the list rows are read fresh every time.
  const countCacheKey = tenantCacheKey(tenantId, "customers-count", q || "all");
  const countPromise = getCached(
    countCacheKey,
    async () => {
      let cq = admin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      if (q) {
        cq = cq.or(
          `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,mobile.ilike.%${q}%`
        );
      }
      const { count } = await cq;
      return count ?? 0;
    },
    30
  );

  const [auth, listResult, totalCount] = await Promise.all([
    isReviewMode ? Promise.resolve(null) : getAuthContext(),
    listQuery,
    countPromise,
  ]);
  const customers = listResult.data;
  const count = totalCount;

  if (!isReviewMode && !auth) redirect("/login");

  return (
    <CustomerListClient
      initialCustomers={customers || []}
      totalCount={count || 0}
      initialPage={page}
      pageSize={DEFAULT_PAGE_SIZE}
      q={q}
    />
  );
}
