import { Suspense } from "react";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantAccessStatuses } from "@/lib/support-access";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import AdminTenantsClient from "./AdminTenantsClient";
import logger from "@/lib/logger";
import { ArrowRightIcon, EnvelopeIcon } from "@heroicons/react/24/outline";

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
    <div className="bg-nexpura-ivory min-h-screen -m-6">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Shell — pure static JSX. Prerenderable under CC. */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
            Admin
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
            Dashboard
          </h1>
          <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
            Platform overview, tenant activity, and key revenue metrics.
          </p>
        </div>
        <Suspense fallback={<AdminDashboardSkeleton />}>
          <AdminDashboardBody />
        </Suspense>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. DB reads only; admin auth handled by (admin) layout.
// ─────────────────────────────────────────────────────────────────────────
async function AdminDashboardBody() {
  // cacheComponents: this body must re-render after server actions
  // mutate tenants/subscriptions. Without `connection()` the
  // prerender pipeline implicitly caches the body and `revalidatePath`
  // / `router.refresh()` keep serving stale state. See PR #130 for the
  // demo-requests Mark Completed bug that surfaced this pattern.
  await connection();
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
      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-stone-200 rounded-2xl p-5"
          >
            <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-luxury">
              {stat.label}
            </p>
            {stat.kind === "count" ? (
              <p
                className={`font-serif text-3xl mt-2 leading-none tracking-tight tabular-nums ${
                  stat.accent ? "text-emerald-700" : "text-stone-900"
                }`}
              >
                {stat.value}
              </p>
            ) : (
              <>
                <p
                  className={`text-sm font-semibold mt-2 leading-snug break-words tabular-nums ${
                    stat.accent ? "text-emerald-700" : "text-stone-900"
                  }`}
                >
                  {stat.value}
                </p>
                {stat.subText && (
                  <p className="text-[10px] text-amber-700 mt-1">{stat.subText}</p>
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
        className="group block bg-white border border-stone-200 rounded-2xl p-6 mb-10 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <EnvelopeIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />
            <div>
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-luxury">
                Demo Requests
              </p>
              <div className="flex items-baseline gap-3 mt-1.5">
                <span
                  className={`font-serif text-2xl leading-none tracking-tight tabular-nums ${
                    demoRequestCounts.new > 0 ? "text-amber-700" : "text-stone-900"
                  }`}
                >
                  {demoRequestCounts.new}
                </span>
                <span className="text-xs text-stone-500">
                  new
                  {demoRequestCounts.scheduled > 0
                    ? ` · ${demoRequestCounts.scheduled} scheduled`
                    : ""}
                </span>
              </div>
            </div>
          </div>
          <ArrowRightIcon className="w-4 h-4 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />
        </div>
      </Link>

      {/* Recent Signups */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-luxury">
            Recent Signups
          </h2>
          <Link
            href="/admin/tenants"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-nexpura-bronze transition-colors duration-200"
          >
            View all
            <ArrowRightIcon className="w-3.5 h-3.5" />
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-2xl p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-20 w-full rounded-2xl mb-10" />
      <Skeleton className="h-4 w-32 mb-5" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </>
  );
}
