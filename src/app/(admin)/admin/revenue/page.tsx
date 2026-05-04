import { Suspense } from "react";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import logger from "@/lib/logger";
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

/**
 * /admin/revenue — CC-ready page-route (admin cluster, third of four).
 *
 * Split: synchronous shell (header + "Revenue Overview" title) with an
 * async body wrapped in Suspense. All Supabase reads are inside the
 * async body; no cookies/headers are read anywhere.
 *
 * below (force-dynamic / revalidate / fetchCache — all rejected under
 * CC) and move the KPI body to `'use cache'` with
 * `cacheTag('admin-revenue')` + `cacheLife('minutes')`. Revalidation
 * happens on subscription webhook writes via `revalidateTag`.
 */


// Phase 1.5 post-audit (Joey 2026-05-03): per-currency MRR breakdown.
// Replaces the AUD-baseline calculateMRR call from Group 16 — that
// silently misreported MRR for non-AUD subs (a USD Studio sub at
// $199 was being counted as AUD $179). Now reads each sub's actual
// stripe_price_id (or tenant.currency fallback for admin-set subs)
// and reports four lines: AUD/USD/GBP/EUR. Below the breakdown,
// a single "≈ A$X (FX rates updated daily)" line consolidates via
// fx_rates daily cache.
import {
  calculateMRRByCurrency,
  convertMRRToAUD,
  formatCurrencyLine,
  resolveSubAmount,
  type FxRate,
  type FxLookup,
} from "@/lib/plans";
import { type CurrencyCode } from "@/data/pricing";

const SYMBOLS: Record<CurrencyCode, string> = { AUD: "A$", USD: "US$", GBP: "£", EUR: "€" };

function fmtAUD(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export const metadata = { title: "Revenue — Nexpura Admin" };

export default function RevenueAdminPage() {
  return (
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Shell — pure static JSX. No awaits, no DB. Paints in the first
            streamed chunk; prerenderable under cacheComponents. */}
        <div className="mb-14 flex items-start gap-4">
          <Link
            href="/admin"
            className="mt-2 text-stone-400 hover:text-nexpura-bronze transition-colors duration-300"
            aria-label="Back to admin"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Admin
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-stone-900 leading-[1.05] tracking-tight">
              Revenue
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Live MRR, ARR, plan breakdown, and subscription metrics.
            </p>
          </div>
        </div>
        <Suspense fallback={<RevenueBodySkeleton />}>
          <RevenueBody />
        </Suspense>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. DB reads only; no request-scoped access (auth handled
// by the (admin) layout).
// ─────────────────────────────────────────────────────────────────────────
async function RevenueBody() {
  // cacheComponents — see PR #130. Read-only surface but the marker
  // is added for consistency across the (admin)/* surface so the
  // ESLint rule (post-Phase-2 cleanup) can require it everywhere.
  await connection();
  const { subs, tenants, fxRates } = await loadRevenueData();

  const tenantMap = new Map((tenants ?? []).map((t) => [t.id, t]));

  const activeSubs = (subs ?? []).filter((s) => s.status === "active");
  const trialSubs = (subs ?? []).filter((s) => s.status === "trialing");
  const pastDueSubs = (subs ?? []).filter((s) => s.status === "past_due");
  const cancelledSubs = (subs ?? []).filter((s) => s.status === "canceled" || s.status === "cancelled");

  // Per-currency MRR breakdown.
  const mrr = calculateMRRByCurrency(subs ?? [], tenantMap);

  // FX-converted approximate AUD total. Lookup helper closes over the
  // latest-rate-per-pair map. Returns null when any rate is missing
  // or older than 7 days → UI renders "≈ A$— (FX rate stale)".
  const fxLookup: FxLookup = (base, target) => {
    const row = fxRates.find((r) => r.base === base && r.target === target);
    return row ?? null;
  };
  const audTotalResult = convertMRRToAUD(mrr.byCurrency, fxLookup);
  // ARR remains a calculated 12× of paying-MRR. With the multi-currency
  // breakdown this only makes sense as an AUD-equivalent run-rate, so
  // gate it behind a successful FX conversion.
  const arr = audTotalResult.audTotal !== null ? audTotalResult.audTotal * 12 : null;

  // Plan breakdown
  const planBreakdown = { boutique: 0, studio: 0, atelier: 0 };
  for (const s of activeSubs) {
    // Normalize legacy keys to new names
    const key = s.plan === "basic" ? "boutique" : s.plan === "pro" ? "studio" : s.plan === "ultimate" || s.plan === "group" ? "atelier" : s.plan;
    if (key in planBreakdown) planBreakdown[key as keyof typeof planBreakdown]++;
  }

  // Churn rate (cancelled / total)
  const churnRate = (subs ?? []).length > 0
    ? ((cancelledSubs.length / (subs ?? []).length) * 100).toFixed(1)
    : "0.0";

  // Conversion rate (active / (active + trialing + cancelled))
  const conversionBase = activeSubs.length + trialSubs.length + cancelledSubs.length;
  const conversionRate = conversionBase > 0
    ? ((activeSubs.length / conversionBase) * 100).toFixed(1)
    : "0.0";

  // Recently joined (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const newTenants = (tenants ?? []).filter((t) => t.created_at > thirtyDaysAgo).length;

  // 4-line breakdown — emits zero rows too so the layout always shows
  // exactly four (matches Joey's 2026-05-03 spec: "MRR as 4 separate
  // lines (one per currency: AUD, USD, GBP, EUR)").
  const CURRENCY_ORDER: CurrencyCode[] = ["AUD", "USD", "GBP", "EUR"];

  return (
    <>
      {/* Top stat strip — ARR, Active, Trialing, New (30d) */}
      <div className="mb-14 grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6 lg:divide-x lg:divide-stone-200">
        <div className="lg:px-8 lg:first:pl-0">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            ARR (≈ AUD)
          </p>
          <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
            {arr === null ? "≈ A$—" : fmtAUD(arr)}
          </p>
          <p className="text-xs text-stone-500 mt-3">
            {arr === null ? "FX rate stale" : "Annual run rate (≈ AUD)"}
          </p>
        </div>
        <div className="lg:px-8">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            Active
          </p>
          <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
            {activeSubs.length}
          </p>
          <p className="text-xs text-stone-500 mt-3">Paying tenants</p>
        </div>
        <div className="lg:px-8">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            Trialing
          </p>
          <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
            {trialSubs.length}
          </p>
          <p className="text-xs text-stone-500 mt-3">On trial</p>
        </div>
        <div className="lg:px-8 lg:last:pr-0">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            New (30d)
          </p>
          <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-emerald-600">
            {newTenants}
          </p>
          <p className="text-xs text-stone-500 mt-3">New tenants</p>
        </div>
      </div>

      {/* MRR card — multi-currency breakdown + ≈ AUD total */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-10">
        <div className="mb-6">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            Monthly Recurring Revenue
          </p>
          <h2 className="font-serif text-2xl text-stone-900 leading-tight tracking-tight">
            Per-currency breakdown
          </h2>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">
            Across active paying tenants.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-6 md:divide-x md:divide-stone-200">
          {CURRENCY_ORDER.map((cur, i) => (
            <div
              key={cur}
              className={`md:px-6 ${i === 0 ? "md:first:pl-0" : ""} ${i === CURRENCY_ORDER.length - 1 ? "md:last:pr-0" : ""}`}
            >
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                {cur}
              </p>
              <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                {formatCurrencyLine(cur, mrr.byCurrency[cur] ?? 0)}
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-stone-200 mt-6 pt-5 flex items-baseline justify-between gap-6 flex-wrap">
          <div>
            <p className="text-sm text-stone-700 tabular-nums">
              {audTotalResult.isStale
                ? "≈ A$— (FX rate stale)"
                : `≈ ${fmtAUD(audTotalResult.audTotal ?? 0)} total`}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              {audTotalResult.isStale
                ? `Latest fx_rates row missing or > 7 days old; cron at /api/cron/fx-refresh writes daily 02:00 UTC.`
                : `FX rates updated daily.`}
            </p>
          </div>
          {mrr.fallbackSubCount > 0 && (
            <p className="text-xs text-amber-700 max-w-[280px] text-right leading-relaxed">
              Includes {mrr.fallbackSubCount} admin-set sub{mrr.fallbackSubCount === 1 ? "" : "s"}, currency inferred from tenant settings (no Stripe price_id).
            </p>
          )}
        </div>
      </div>

      {/* Secondary stat strip — Past Due, Churned, Churn Rate, Conversion */}
      <div className="mb-14 grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6 lg:divide-x lg:divide-stone-200">
        <div className="lg:px-8 lg:first:pl-0">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            Past Due
          </p>
          <p
            className={`font-serif text-4xl leading-none tracking-tight tabular-nums ${
              pastDueSubs.length > 0 ? "text-nexpura-oxblood" : "text-stone-900"
            }`}
          >
            {pastDueSubs.length}
          </p>
        </div>
        <div className="lg:px-8">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            Churned
          </p>
          <p
            className={`font-serif text-4xl leading-none tracking-tight tabular-nums ${
              cancelledSubs.length > 5 ? "text-nexpura-oxblood" : "text-stone-900"
            }`}
          >
            {cancelledSubs.length}
          </p>
        </div>
        <div className="lg:px-8">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            Churn Rate
          </p>
          <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
            {churnRate}%
          </p>
        </div>
        <div className="lg:px-8 lg:last:pr-0">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            Conversion
          </p>
          <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-emerald-600">
            {conversionRate}%
          </p>
        </div>
      </div>

      {/* Plan breakdown + Conversion funnel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            Plan Distribution
          </p>
          <h2 className="font-serif text-xl text-stone-900 leading-tight tracking-tight mb-2">
            Active subscriptions
          </h2>
          <p className="text-xs text-stone-500 leading-relaxed mb-5">
            Tenant count per plan. Per-currency MRR is shown in the breakdown above
            — a single $/mo figure here would silently mix currencies.
          </p>
          <div className="space-y-4">
            {Object.entries(planBreakdown).map(([plan, count]) => {
              const pct = activeSubs.length > 0 ? Math.round((count / activeSubs.length) * 100) : 0;
              return (
                <div key={plan}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-stone-900 capitalize">{plan}</span>
                    <span className="text-stone-500 tabular-nums">{count} {count === 1 ? "tenant" : "tenants"}</span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-stone-700 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            Conversion Funnel
          </p>
          <h2 className="font-serif text-xl text-stone-900 leading-tight tracking-tight mb-5">
            Signup to paid
          </h2>
          <div className="space-y-4">
            {[
              { label: "Total Signups", value: (tenants ?? []).length, width: 100 },
              { label: "Trialing", value: trialSubs.length, width: (tenants ?? []).length > 0 ? (trialSubs.length / (tenants ?? []).length) * 100 : 0 },
              { label: "Active (Paid)", value: activeSubs.length, width: (tenants ?? []).length > 0 ? (activeSubs.length / (tenants ?? []).length) * 100 : 0 },
              { label: "Conversion Rate", value: `${conversionRate}%`, width: parseFloat(conversionRate) },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-stone-600">{row.label}</span>
                  <span className="font-medium text-stone-900 tabular-nums">{row.value}</span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-stone-500 rounded-full"
                    style={{ width: `${row.width}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active subscriptions table */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden mb-10">
        <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
          <div>
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
              Subscriptions
            </p>
            <h2 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
              Active tenants
            </h2>
          </div>
          <span className="text-sm text-stone-500 tabular-nums">
            {activeSubs.length} {activeSubs.length === 1 ? "tenant" : "tenants"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left px-6 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                  Tenant
                </th>
                <th className="text-left px-5 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                  Plan
                </th>
                <th className="text-right px-5 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                  MRR
                </th>
                <th className="text-left px-5 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                  Renews
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {activeSubs.map((sub) => {
                const tenant = tenantMap.get(sub.tenant_id);
                // Resolve per-sub price in the sub's actual currency.
                // Avoids the legacy AUD-only PLAN_PRICES table that
                // misreported non-AUD subs (Group 16 / Joey 2026-05-03).
                const resolved = tenant?.is_free_forever
                  ? null
                  : resolveSubAmount(sub, tenantMap);
                const cell = tenant?.is_free_forever
                  ? "—"
                  : resolved
                    ? `${SYMBOLS[resolved.currency]}${resolved.amount.toLocaleString()}`
                    : "?";
                return (
                  <tr key={sub.tenant_id} className="hover:bg-stone-50/60 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/tenants/${sub.tenant_id}`}
                        className="font-medium text-stone-900 hover:text-nexpura-bronze transition-colors duration-200"
                      >
                        {tenant?.name ?? "Unknown"}
                      </Link>
                      {tenant?.is_free_forever && (
                        <span className="ml-2 nx-badge-success">Free</span>
                      )}
                      {resolved?.source === "tenant_fallback" && (
                        <span
                          className="ml-2 nx-badge-warning"
                          title="Currency inferred from tenant settings — no Stripe price_id on subscription row."
                        >
                          inferred
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="capitalize text-stone-700">{sub.plan}</span>
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-stone-900 tabular-nums">{cell}</td>
                    <td className="px-5 py-4 text-stone-500 tabular-nums">
                      {sub.current_period_end ? fmtDate(sub.current_period_end) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Past due / at risk */}
      {pastDueSubs.length > 0 && (
        <div className="bg-white border border-nexpura-oxblood/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <ExclamationTriangleIcon className="w-5 h-5 text-nexpura-oxblood" />
            <div>
              <p className="text-[0.6875rem] font-semibold text-nexpura-oxblood uppercase tracking-luxury mb-1">
                At Risk
              </p>
              <h2 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                Payment required ({pastDueSubs.length})
              </h2>
            </div>
          </div>
          <div className="divide-y divide-stone-100">
            {pastDueSubs.map((sub) => {
              const tenant = tenantMap.get(sub.tenant_id);
              return (
                <div key={sub.tenant_id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/admin/tenants/${sub.tenant_id}`}
                    className="text-sm font-medium text-stone-900 hover:text-nexpura-bronze transition-colors duration-200"
                  >
                    {tenant?.name ?? "Unknown"}
                  </Link>
                  <span className="text-xs text-stone-500 capitalize">{sub.plan}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable data loader. Takes no inputs; admin-wide view.
// ─────────────────────────────────────────────────────────────────────────
interface SubRow {
  tenant_id: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  /** Phase 1.5 post-audit (Joey 2026-05-03) — added in
   *  20260503_subscriptions_currency_priceid.sql so MRR can resolve
   *  per-currency rather than assuming AUD-baseline. NULL on legacy
   *  admin-set subs that never went through Stripe. */
  stripe_price_id: string | null;
  currency: string | null;
}
interface TenantRow {
  id: string;
  name: string;
  created_at: string;
  is_free_forever: boolean | null;
  currency: string | null;
}

interface FxRateRow {
  base_currency: string;
  target_currency: string;
  rate: number;
  fetched_at: string;
}

async function loadRevenueData(): Promise<{
  subs: SubRow[] | null;
  tenants: TenantRow[] | null;
  fxRates: FxRate[];
}> {
  try {
    const admin = createAdminClient();

    const [subsRes, tenantsRes, fxRes] = await Promise.all([
      admin
        .from("subscriptions")
        .select(
          "tenant_id, plan, status, trial_ends_at, current_period_end, created_at, stripe_price_id, currency",
        ),
      admin
        .from("tenants")
        .select("id, name, created_at, is_free_forever, currency")
        .is("deleted_at", null),
      // fx_rates is append-only; we want the latest row per
      // (base, target). Order by fetched_at desc then dedupe in JS —
      // simpler than a Postgres DISTINCT ON across the supabase-js
      // typed client and fx_rates is small (<= 12 active pairs).
      admin
        .from("fx_rates")
        .select("base_currency, target_currency, rate, fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(500),
    ]);

    const seen = new Set<string>();
    const fxRates: FxRate[] = [];
    for (const row of (fxRes.data ?? []) as FxRateRow[]) {
      const key = `${row.base_currency}→${row.target_currency}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fxRates.push({
        base: row.base_currency as CurrencyCode,
        target: row.target_currency as CurrencyCode,
        rate: Number(row.rate),
        fetchedAt: new Date(row.fetched_at),
      });
    }

    return { subs: subsRes.data, tenants: tenantsRes.data, fxRates };
  } catch (error) {
    logger.error("[admin/revenue] loadRevenueData failed", error);
    return { subs: [], tenants: [], fxRates: [] };
  }
}

function RevenueBodySkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6 lg:divide-x lg:divide-stone-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="lg:px-8 lg:first:pl-0 lg:last:pr-0">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-9 w-32 mb-3" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <Skeleton className="h-3 w-40 mb-3" />
        <Skeleton className="h-7 w-56 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-12 mb-3" />
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6 lg:divide-x lg:divide-stone-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="lg:px-8 lg:first:pl-0 lg:last:pr-0">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
            <Skeleton className="h-3 w-40 mb-2" />
            <Skeleton className="h-6 w-48 mb-4" />
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j}>
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <Skeleton className="h-16 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full border-t border-stone-100" />
        ))}
      </div>
    </div>
  );
}
