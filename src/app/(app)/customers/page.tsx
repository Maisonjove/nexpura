import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import {
  UserPlus,
  Users,
  MessageCircle,
  Tag,
  History,
  Crown,
  Inbox,
  ChevronDown,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth-context";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { ilikeOrValue } from "@/lib/db/or-escape";
import { Skeleton } from "@/components/ui/skeleton";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";
import {
  HubHeader,
  KpiCard,
  KpiStrip,
  SectionPanel,
  HubEmptyState,
} from "@/components/hub/HubPrimitives";
import CustomerListClient from "./CustomerListClient";

export const metadata = { title: "Customers — Nexpura" };

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

const DEFAULT_PAGE_SIZE = 200;

/**
 * Customers Hub — Section 7 of Kaitlyn's 2026-05-02 redesign brief.
 *
 * Wraps the existing CustomerRows streaming pattern (preserves the
 * unstable_cache + visibility-RLS dance) inside a hub shell:
 *   - HubHeader + "New customer" CTA
 *   - KPI strip (total customers / follow-ups / VIP / birthdays / requests)
 *   - Quick actions (CREATE / ENGAGE / SEGMENT)
 *   - Customer list panel (existing CustomerListClient with hideTitleBlock)
 *   - Empty state when no customers exist
 */
export default function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; page?: string; rt?: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <CustomersBody searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomersBody({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; page?: string; rt?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const page = parseInt(params.page || "1");

  const isReviewMode = matchesReviewOrStaffToken(params.rt);

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
    <div className="space-y-7 max-w-[1400px]">
      <HubHeader
        title="Customers"
        subtitle="Manage clients and follow-ups."
        ctas={[
          { label: "New customer", href: "/customers/new", variant: "primary", icon: UserPlus },
        ]}
      />

      <Suspense key={`kpis:${tenantId}:${userId ?? "review"}`} fallback={<KpiStripSkeleton />}>
        <CustomerKpis tenantId={tenantId} userId={userId} isReviewMode={isReviewMode} />
      </Suspense>

      {/* Brief 2 §9 — quick-action card grids removed. The most common
          actions (New customer in the header, Find customer via the list
          search, Follow-ups via the KPI chip) are reachable from the
          surrounding chrome. The rest live behind the "More" link below. */}
      <div className="flex items-center justify-end gap-3 -mt-2">
        <Link
          href="/reminders"
          className="text-[13px] font-medium text-nexpura-charcoal-700 hover:text-nexpura-bronze transition-colors"
        >
          Follow-ups
        </Link>
        <span className="text-nexpura-taupe-200" aria-hidden>·</span>
        <details className="relative">
          <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-[13px] font-medium text-nexpura-charcoal-700 hover:text-nexpura-bronze transition-colors">
            More <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
          </summary>
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-nexpura-taupe-100 bg-white shadow-md py-1 z-10">
            <Link href="/communications" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <MessageCircle className="w-4 h-4" strokeWidth={1.5} /> Communications
            </Link>
            <Link href="/customers?segment=vip" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <Crown className="w-4 h-4" strokeWidth={1.5} /> VIP clients
            </Link>
            <Link href="/marketing/segments" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <Tag className="w-4 h-4" strokeWidth={1.5} /> Segments
            </Link>
            <Link href="/sales" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <History className="w-4 h-4" strokeWidth={1.5} /> Purchase history
            </Link>
          </div>
        </details>
      </div>

      {/* Customer list panel — existing client component, unchanged data flow */}
      <Suspense key={`${q}:${page}`} fallback={<CustomerTableSkeleton />}>
        <CustomerRows tenantId={tenantId} userId={userId} q={q} page={page} isReviewMode={isReviewMode} />
      </Suspense>
    </div>
  );
}

// ─── KPI strip (server) ───────────────────────────────────────────────────

async function CustomerKpis({
  tenantId,
  userId,
  isReviewMode,
}: {
  tenantId: string;
  userId: string | null;
  isReviewMode: boolean;
}) {
  const admin = createAdminClient();

  const now = new Date();
  const monthIdx = now.getMonth() + 1; // postgres months are 1-indexed
  const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Widget-vs-list scope parity (post-audit/widget-list-reconciliation,
  // 2026-05-06). The list below (`CustomerRows`) resolves a per-user
  // `visibleIds` set via `get_visible_customer_ids` for location-restricted
  // staff. Pre-fix the KPIs ran tenant-wide so a restricted user saw
  // "Total customers: 12" while the list rendered 1 (their own location's).
  // Post-fix: KPIs intersect the same visibility window. Owner/manager
  // (allowed_location_ids IS NULL) returns null here and we skip the
  // intersection (full-tenant view, matching their list view).
  // CONTRIBUTING.md §17.1 documents the canonical pattern.
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
      visibleIds =
        (ids as unknown as Array<string | { get_visible_customer_ids: string }> | null)
          ?.map((r) => (typeof r === "string" ? r : r.get_visible_customer_ids)) ?? [];
    }
  }
  const applyVisibility = <T,>(q: T): T => {
    if (visibleIds === null) return q;
    const ids = visibleIds.length === 0
      // Empty scope — match nothing via impossible UUID. Symmetric with
      // locationScopeFilter() empty-allowed case (location-read-scope.ts).
      ? ["00000000-0000-0000-0000-000000000000"]
      : visibleIds;
    return (q as unknown as { in: (col: string, vals: string[]) => T }).in("id", ids);
  };

  // Birthdays this month: filter by EXTRACT(MONTH FROM birthday).
  // PostgREST exposes this via the `extract.month` filter when the column is
  // a date. If the function isn't available, the query degrades to 0.
  // Using a raw rpc-less approach: fetch counts with `birthday` not null and
  // post-filter in JS over a (small) bound.
  const [
    totalCustomers,
    vipCustomers,
    followUps,
    requests,
    birthdayCustomers,
  ] = await Promise.all([
    applyVisibility(
      admin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
    ),
    applyVisibility(
      admin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_vip", true)
        .is("deleted_at", null)
    ),
    // Follow-ups due — tasks with due_date <= today AND status != done.
    // Some tenants store these under `reminders` instead; we count tasks
    // here since the dashboard does. Tasks have no `location_id` column
    // (schema check 2026-05-06) so they remain tenant-wide; documented as
    // an explicit exception in §17.1. Visibility model for tasks is
    // assigned_to-based, applied at the task list page.
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .lte("due_date", todayIso)
      .not("status", "in", '("done","completed","cancelled")'),
    // Open client requests — best-effort: enquiries table if present.
    // Schema-tolerant: missing table → result.error is non-null, count = 0.
    admin
      .from("enquiries")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("status", "in", '("closed","converted","cancelled")'),
    // Birthdays this month — pull birthdays and filter client-side. The
    // customers table is unlikely to be huge for any single tenant.
    applyVisibility(
      admin
        .from("customers")
        .select("id, birthday")
        .eq("tenant_id", tenantId)
        .not("birthday", "is", null)
        .is("deleted_at", null)
    ),
  ]);

  const birthdaysThisMonth = (birthdayCustomers.data ?? []).filter((c) => {
    if (!c.birthday) return false;
    const d = new Date(c.birthday);
    if (Number.isNaN(d.getTime())) return false;
    return d.getMonth() + 1 === monthIdx;
  }).length;

  const total = totalCustomers.count ?? 0;
  const vip = vipCustomers.count ?? 0;
  const followUpCount = followUps.count ?? 0;
  // Enquiries count is null when the table doesn't exist; treat as 0.
  const requestCount = requests.error ? 0 : (requests.count ?? 0);

  return (
    <KpiStrip>
      <KpiCard label="Total customers" value={total} href="/customers" tone="neutral" />
      <KpiCard
        label="Follow-ups due"
        value={followUpCount}
        href="/reminders"
        tone={followUpCount > 0 ? "warn" : "neutral"}
      />
      <KpiCard
        label="VIP clients"
        value={vip}
        href="/customers?segment=vip"
        tone="neutral"
      />
      <KpiCard
        label="Birthdays this month"
        value={birthdaysThisMonth}
        tone="neutral"
        hint={birthdaysThisMonth > 0 ? "Reach out" : undefined}
      />
      <KpiCard
        label="Open client requests"
        value={requestCount}
        href="/enquiries"
        tone={requestCount > 0 ? "warn" : "neutral"}
      />
    </KpiStrip>
  );
}

// ─── Customer rows (existing pattern, wrapped in SectionPanel) ────────────

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

  // Location-scoped customer visibility (preserved from prior page).
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

  if (payload.count === 0 && !q) {
    return (
      <SectionPanel title="Customers">
        <HubEmptyState
          icon={Users}
          title="No customer profiles yet"
          description="No customer profiles yet. Create profiles to track purchases, repairs, preferences and follow-ups."
          ctas={[
            { label: "New customer", href: "/customers/new", variant: "primary", icon: UserPlus },
            { label: "Import customers", href: "/settings/import", variant: "secondary", icon: Inbox },
          ]}
        />
      </SectionPanel>
    );
  }

  return (
    <SectionPanel
      title="All customers"
      description={`${payload.count} total`}
    >
      <div className="p-5">
        <CustomerListClient
          initialCustomers={payload.rows}
          totalCount={payload.count}
          initialPage={page}
          pageSize={DEFAULT_PAGE_SIZE}
          q={q}
          hideTitleBlock
        />
      </div>
    </SectionPanel>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────

function KpiStripSkeleton() {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-nexpura-ivory-elevated rounded-xl px-4 py-3.5 border border-nexpura-taupe-100"
        >
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </section>
  );
}

function CustomerTableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
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
