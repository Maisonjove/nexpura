import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantAccessStatuses } from "@/lib/support-access";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import AdminTenantsClient from "./AdminTenantsClient";
import logger from "@/lib/logger";

/**
 * /admin — CC-ready page-route (admin-cluster cleanup pass).
 *
 * Same shape as /admin/qa: sync top-level shell (title + description)
 * with a Suspense-wrapped async body. All DB work + support-access
 * lookup lives inside the body; auth is handled by the (admin) layout.
 *
 * three segment-config exports below (all rejected under CC) and add
 *   'use cache';
 *   cacheLife('minutes');
 *   cacheTag('admin-dashboard');
 * to `loadAdminDashboardData()`. Invalidation via `revalidateTag` on
 * subscription webhook / tenant signup writes.
 */


// Group 16 audit: plan-price source moved to src/lib/plans.ts so all
// three admin pages (/admin, /admin/tenants, /admin/revenue) share one
// definition. Pre-fix each page had its own copy and they had drifted
// (atelier missing on /admin/tenants → understated MRR by $897 against
// the same dataset).
//
// Phase 1.5 post-audit (Joey 2026-05-03): switched from the AUD-only
// calculateMRR / calculateProjectedMRR helpers to the per-currency
// breakdown variants. The old helpers silently misreported non-AUD subs
// as AUD-priced (USD Studio at $199 was being summed as AUD $299 etc.).
// The dashboard tile now shows a compact "A$… · US$… · £… · €…" line
// directly; full per-currency totals + ≈ AUD conversion live on
// /admin/revenue.
import {
  calculateMRRByCurrency,
  calculateProjectedMRRByCurrency,
  formatMRRByCurrency,
} from "@/lib/plans";

export default function AdminDashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Shell — pure static JSX. Prerenderable under CC. */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Admin Dashboard</h1>
        <p className="text-sm text-stone-500 mt-1">Platform overview and key metrics</p>
      </div>
      <Suspense fallback={<AdminDashboardSkeleton />}>
        <AdminDashboardBody />
      </Suspense>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. DB reads only; admin auth handled by (admin) layout.
// ─────────────────────────────────────────────────────────────────────────
async function AdminDashboardBody() {
  const { tenants, subscriptions, accessStatuses, demoRequestCounts } = await loadAdminDashboardData();

  const totalTenants = tenants?.length ?? 0;

  const activeCount = (subscriptions ?? []).filter(
    (s) => s.status === "active"
  ).length;

  const trialCount = (subscriptions ?? []).filter(
    (s) => s.status === "trialing"
  ).length;

  const suspendedCount = (subscriptions ?? []).filter(
    (s) => s.status === "suspended"
  ).length;

  // Joey 2026-05-03 directive: per-currency MRR. The compact line
  // ("A$… · US$… · £… · €…") avoids silently summing different
  // currencies. Full breakdown + ≈ AUD total lives on /admin/revenue.
  const tenantMap = new Map(
    (tenants ?? []).map((t) => [
      t.id,
      { is_free_forever: t.is_free_forever ?? false, currency: t.currency ?? null },
    ]),
  );
  const mrr = calculateMRRByCurrency(subscriptions ?? [], tenantMap);
  const projectedMrr = calculateProjectedMRRByCurrency(subscriptions ?? [], tenantMap);

  const recentTenants = (tenants ?? []).slice(0, 10);

  // Counts use text-2xl for the value; MRR tiles render the per-
  // currency line at smaller text so a populated all-four-currency
  // breakdown still fits in the lg:grid-cols-5 cell.
  type CountStat = { kind: "count"; label: string; value: string | number; accent: boolean };
  type MrrStat = { kind: "mrr"; label: string; value: string; accent: boolean; subText?: string };
  const stats: Array<CountStat | MrrStat> = [
    { kind: "count", label: "Total Tenants", value: totalTenants, accent: false },
    { kind: "count", label: "Active (Paying)", value: activeCount, accent: true },
    { kind: "count", label: "Trialing", value: trialCount, accent: false },
    { kind: "count", label: "Suspended", value: suspendedCount, accent: false },
    {
      kind: "mrr",
      label: "MRR",
      value: formatMRRByCurrency(mrr.byCurrency),
      accent: true,
      subText:
        mrr.fallbackSubCount > 0
          ? `incl. ${mrr.fallbackSubCount} admin-set`
          : undefined,
    },
    {
      kind: "mrr",
      label: "If Trials Convert",
      value: formatMRRByCurrency(projectedMrr.byCurrency),
      accent: false,
    },
  ];

  return (
    <>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm"
          >
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{stat.label}</p>
            {stat.kind === "count" ? (
              <p className={`text-2xl font-semibold mt-1 ${stat.accent ? "text-emerald-600" : "text-stone-900"}`}>
                {stat.value}
              </p>
            ) : (
              <>
                <p
                  className={`text-sm font-semibold mt-1 leading-snug break-words ${stat.accent ? "text-emerald-600" : "text-stone-900"}`}
                >
                  {stat.value}
                </p>
                {stat.subText && (
                  <p className="text-[10px] text-amber-700 mt-0.5">{stat.subText}</p>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Demo requests tile — separate from the main grid so the
          unread count stays visually distinct. Click → /admin/demo-requests. */}
      <Link
        href="/admin/demo-requests"
        className="block bg-white rounded-xl border border-stone-200 p-4 shadow-sm hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Demo Requests</p>
            <div className="flex items-baseline gap-3 mt-1">
              <span className={`text-2xl font-semibold ${demoRequestCounts.new > 0 ? "text-amber-700" : "text-stone-900"}`}>
                {demoRequestCounts.new}
              </span>
              <span className="text-xs text-stone-500">
                new{demoRequestCounts.scheduled > 0 ? ` · ${demoRequestCounts.scheduled} scheduled` : ""}
              </span>
            </div>
          </div>
          <span className="text-stone-400 text-sm">→</span>
        </div>
      </Link>

      {/* Recent Signups */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Recent Signups</h2>
          <Link href="/admin/tenants" className="text-sm text-stone-700 hover:text-stone-900 hover:underline">
            View all →
          </Link>
        </div>
        <AdminTenantsClient
          tenants={recentTenants}
          subscriptions={subscriptions ?? []}
          accessStatuses={accessStatuses}
        />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable data loader. No inputs; admin-wide view.
// ─────────────────────────────────────────────────────────────────────────
interface TenantRow {
  id: string;
  name: string;
  is_free_forever?: boolean | null;
  created_at: string;
  currency: string | null;
}
interface SubRow {
  tenant_id: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_price_id: string | null;
  currency: string | null;
}

async function loadAdminDashboardData(): Promise<{
  tenants: TenantRow[] | null;
  subscriptions: SubRow[] | null;
  accessStatuses: Record<string, { status: "pending" | "approved"; expiresAt?: string }>;
  demoRequestCounts: { new: number; scheduled: number };
}> {
  let tenants: TenantRow[] | null = null;
  let subscriptions: SubRow[] | null = null;
  let demoRequestCounts = { new: 0, scheduled: 0 };

  try {
    const adminClient = createAdminClient();

    const tenantsRes = await adminClient
      .from("tenants")
      .select("id, name, is_free_forever, created_at, deleted_at, currency")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    tenants = tenantsRes.data;

    const subsRes = await adminClient
      .from("subscriptions")
      .select(
        "tenant_id, plan, status, trial_ends_at, current_period_end, stripe_price_id, currency",
      );
    subscriptions = subsRes.data;

    // Demo requests — counts only. Two head-only queries beat pulling
    // every row when the dashboard just needs a "new" badge value.
    const [newRes, schedRes] = await Promise.all([
      adminClient
        .from("demo_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      adminClient
        .from("demo_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "scheduled"),
    ]);
    demoRequestCounts = {
      new: newRes.count ?? 0,
      scheduled: schedRes.count ?? 0,
    };
  } catch (error) {
    logger.error("[admin] loadAdminDashboardData failed", error);
    tenants = [];
    subscriptions = [];
  }

  const tenantIds = (tenants ?? []).map((t) => t.id);
  const accessStatuses: Record<string, { status: "pending" | "approved"; expiresAt?: string }> = {};
  try {
    const accessStatusMap = await getTenantAccessStatuses(tenantIds);
    accessStatusMap.forEach((value, key) => {
      accessStatuses[key] = {
        status: value.status as "pending" | "approved",
        expiresAt: value.expiresAt,
      };
    });
  } catch {
    // Ignore if support access check fails — shown as empty in UI.
  }

  return { tenants, subscriptions, accessStatuses, demoRequestCounts };
}

function AdminDashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <Skeleton className="h-14 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full border-t border-stone-100" />
        ))}
      </div>
    </>
  );
}
