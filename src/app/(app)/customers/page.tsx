import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAuthContext } from "@/lib/auth-context";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { ilikeOrValue } from "@/lib/db/or-escape";
import { Skeleton } from "@/components/ui/skeleton";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";
import CustomerListClient from "./CustomerListClient";

export const metadata = { title: "Customers — Nexpura" };

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

const DEFAULT_PAGE_SIZE = 200;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; page?: string; rt?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const page = parseInt(params.page || "1");

  // W7-HIGH-04: matchesReviewOrStaffToken compares constant-time
  // against env-loaded secrets. Empty env => returns false => bypass
  // disabled (fail-closed).
  const isReviewMode = matchesReviewOrStaffToken(params.rt);

  // Fast-path tenant resolution — no DB call, headers-only.
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

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Shell — streams in the first HTML packet, before any DB query. */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Customers</h1>
        <Link
          href="/customers/new"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-nexpura-charcoal hover:bg-nexpura-charcoal-700 text-white h-10 px-4 py-2"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Link>
      </div>

      {/* Row table + count + export button stream in behind Suspense. */}
      <Suspense key={`${q}:${page}`} fallback={<CustomerTableSkeleton />}>
        <CustomerRows tenantId={tenantId} userId={userId} q={q} page={page} isReviewMode={isReviewMode} />
      </Suspense>
    </div>
  );
}

async function CustomerRows({
  tenantId,
  userId,
  q,
  page,
  isReviewMode,
}: {
  tenantId: string;
  userId: string | null;
  q: string;
  page: number;
  isReviewMode: boolean;
}) {
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const admin = createAdminClient();

  // Location-scoped customer visibility. All-access users get every
  // tenant customer; restricted users get only those linked to their
  // allowed locations via sales/repairs/bespoke (or with no location-
  // scoped activity at all). See migration
  // 20260421_customer_location_visibility.sql.
  let visibleIds: string[] | null = null;
  if (!isReviewMode && userId) {
    const { data: member } = await admin
      .from("team_members")
      .select("allowed_location_ids")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (member && member.allowed_location_ids !== null) {
      const { data: ids } = await admin.rpc("get_visible_customer_ids", {
        p_user_id: userId,
        p_tenant_id: tenantId,
      });
      visibleIds = (ids as unknown as Array<string | { get_visible_customer_ids: string }> | null)
        ?.map((r) => typeof r === "string" ? r : r.get_visible_customer_ids) ?? [];
    }
  }
  const visibleIdsKey = visibleIds === null ? "all" : `${visibleIds.length}:${visibleIds.slice(0, 5).join(",")}`;

  const cacheKey = ["customers-list", tenantId, String(page), q || "nq", visibleIdsKey];
  const fetchPage = unstable_cache(
    async () => {
      let listQ = admin
        .from("customers")
        .select(
          "id, full_name, first_name, last_name, email, phone, mobile, tags, is_vip, created_at, updated_at"
        )
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      if (visibleIds !== null) {
        if (visibleIds.length === 0) return { rows: [], count: 0 };
        listQ = listQ.in("id", visibleIds);
      }
      // W2-004: quote user input so PostgREST metachars can't escape.
      const qIlike = q ? ilikeOrValue(q) : null;
      if (qIlike) {
        listQ = listQ.or(
          `full_name.${qIlike},email.${qIlike},phone.${qIlike},mobile.${qIlike}`
        );
      }
      const listResult = await listQ
        .order("created_at", { ascending: false })
        .range(offset, offset + DEFAULT_PAGE_SIZE - 1);

      let countQ = admin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      if (visibleIds !== null) {
        countQ = countQ.in("id", visibleIds);
      }
      if (qIlike) {
        countQ = countQ.or(
          `full_name.${qIlike},email.${qIlike},phone.${qIlike},mobile.${qIlike}`
        );
      }
      const { count } = await countQ;

      return {
        rows: listResult.data ?? [],
        count: count ?? 0,
      };
    },
    cacheKey,
    { tags: [CACHE_TAGS.customers(tenantId)], revalidate: 3600 }
  );

  const [auth, payload] = await Promise.all([
    isReviewMode ? Promise.resolve(null) : getAuthContext(),
    fetchPage(),
  ]);
  if (!isReviewMode && !auth) redirect("/login");

  return (
    <CustomerListClient
      initialCustomers={payload.rows}
      totalCount={payload.count}
      initialPage={page}
      pageSize={DEFAULT_PAGE_SIZE}
      q={q}
      hideTitleBlock
    />
  );
}

function CustomerTableSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter bar shape */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
      {/* Table shape */}
      <div className="nx-table-wrapper">
        <div className="px-6 py-3 border-b border-stone-100 bg-stone-50/50 flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-28 ml-auto" />
        </div>
        <div className="divide-y divide-stone-100">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
