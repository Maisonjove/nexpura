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
import { Skeleton } from "@/components/ui/skeleton";
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
  const q = params.q || "";
  const page = parseInt(params.page || "1");

  const isReviewMode = !!(params.rt && REVIEW_TOKENS.includes(params.rt));

  // Fast-path tenant resolution — no DB call, headers-only.
  let tenantId: string;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const headersList = await headers();
    const headerTenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
    if (!headerTenantId) redirect("/login");
    tenantId = headerTenantId;
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Shell — streams in the first HTML packet, before any DB query. */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Customers</h1>
        <Link
          href="/customers/new"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-amber-700 hover:bg-amber-800 text-white h-10 px-4 py-2"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Link>
      </div>

      {/* Row table + count + export button stream in behind Suspense. */}
      <Suspense key={`${q}:${page}`} fallback={<CustomerTableSkeleton />}>
        <CustomerRows tenantId={tenantId} q={q} page={page} isReviewMode={isReviewMode} />
      </Suspense>
    </div>
  );
}

async function CustomerRows({
  tenantId,
  q,
  page,
  isReviewMode,
}: {
  tenantId: string;
  q: string;
  page: number;
  isReviewMode: boolean;
}) {
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const admin = createAdminClient();

  const cacheKey = ["customers-list", tenantId, String(page), q || "nq"];
  const fetchPage = unstable_cache(
    async () => {
      let listQ = admin
        .from("customers")
        .select(
          "id, full_name, first_name, last_name, email, phone, mobile, tags, is_vip, created_at, updated_at"
        )
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      if (q) {
        listQ = listQ.or(
          `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,mobile.ilike.%${q}%`
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
      if (q) {
        countQ = countQ.or(
          `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,mobile.ilike.%${q}%`
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
