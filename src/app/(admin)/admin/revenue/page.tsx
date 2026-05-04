import { Suspense } from "react";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import logger from "@/lib/logger";

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
    <div className="max-w-5xl mx-auto py-10 px-4">
      {/* Shell — pure static JSX. No awaits, no DB. Paints in the first
          streamed chunk; prerenderable under cacheComponents. */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 mb-1 inline-block">← Admin</Link>
          <h1 className="text-2xl font-semibold text-stone-900">Revenue Overview</h1>
          <p className="text-sm text-stone-500 mt-0.5">Live MRR, ARR, plan breakdown, and subscription metrics</p>
        </div>
      </div>
      <Suspense fallback={<RevenueBodySkeleton />}>
        <RevenueBody />
      </Suspense>
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
      {/* MRR card — multi-currency breakdown + ≈ AUD total */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-2xl mb-0.5">💰</div>
            <h2 className="text-sm font-semibold text-stone-700">MRR — Monthly Recurring Revenue</h2>
            <p className="text-xs text-stone-400 mt-0.5">Per-currency breakdown across active paying tenants.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {CURRENCY_ORDER.map((cur) => (
            <div key={cur} className="border border-stone-100 rounded-lg p-3 bg-stone-50/40">
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{cur}</div>
              <div className="text-xl font-semibold text-stone-900">
                {formatCurrencyLine(cur, mrr.byCurrency[cur] ?? 0)}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-stone-100 pt-3 flex items-baseline justify-between">
          <div>
            <div className="text-xs text-stone-500">
              {audTotalResult.isStale
                ? "≈ A$— (FX rate stale)"
                : `≈ ${fmtAUD(audTotalResult.audTotal ?? 0)} total`}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">
              {audTotalResult.isStale
                ? `Latest fx_rates row missing or > 7 days old; cron at /api/cron/fx-refresh writes daily 02:00 UTC.`
                : `FX rates updated daily.`}
            </div>
          </div>
          {mrr.fallbackSubCount > 0 && (
            <div className="text-[11px] text-amber-700 max-w-[260px] text-right">
              Includes {mrr.fallbackSubCount} admin-set sub{mrr.fallbackSubCount === 1 ? "" : "s"}, currency inferred from tenant settings (no Stripe price_id).
            </div>
          )}
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "ARR (≈ AUD)",
            value: arr === null ? "≈ A$—" : fmtAUD(arr),
            icon: "📈",
            sub: arr === null ? "FX rate stale" : "Annual run rate (≈ AUD)",
          },
          { label: "Active Subscriptions", value: activeSubs.length, icon: "✓", sub: "Paying tenants" },
          { label: "Trialing", value: trialSubs.length, icon: "⏳", sub: "On trial" },
          { label: "New (30d)", value: newTenants, icon: "🆕", sub: "New tenants" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
            <div className="text-2xl mb-2">{k.icon}</div>
            <div className="text-2xl font-bold text-stone-900">{k.value}</div>
            <div className="text-xs text-stone-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Trialing", value: trialSubs.length, color: "text-amber-600" },
          { label: "Past Due", value: pastDueSubs.length, color: pastDueSubs.length > 0 ? "text-red-600" : "text-stone-900" },
          { label: "Churned", value: cancelledSubs.length, color: cancelledSubs.length > 5 ? "text-red-600" : "text-stone-900" },
          { label: "Churn Rate", value: `${churnRate}%`, color: "text-stone-900" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-stone-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">Plan Distribution (Active)</h2>
          <p className="text-[11px] text-stone-400 mb-3">
            Tenant count per plan. Per-currency MRR is shown in the breakdown card above
            — a single $/mo figure here would silently mix currencies.
          </p>
          <div className="space-y-3">
            {Object.entries(planBreakdown).map(([plan, count]) => {
              const pct = activeSubs.length > 0 ? Math.round((count / activeSubs.length) * 100) : 0;
              return (
                <div key={plan}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-stone-900 capitalize">{plan}</span>
                    <span className="text-stone-500">{count} {count === 1 ? "tenant" : "tenants"}</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
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
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">Conversion Funnel</h2>
          <div className="space-y-3">
            {[
              { label: "Total Signups", value: (tenants ?? []).length, width: 100 },
              { label: "Trialing", value: trialSubs.length, width: (tenants ?? []).length > 0 ? (trialSubs.length / (tenants ?? []).length) * 100 : 0 },
              { label: "Active (Paid)", value: activeSubs.length, width: (tenants ?? []).length > 0 ? (activeSubs.length / (tenants ?? []).length) * 100 : 0 },
              { label: "Conversion Rate", value: `${conversionRate}%`, width: parseFloat(conversionRate) },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-600">{row.label}</span>
                  <span className="font-medium text-stone-900">{row.value}</span>
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
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-6 shadow-sm">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Active Subscriptions</h2>
          <span className="text-xs text-stone-400">
            {activeSubs.length} {activeSubs.length === 1 ? "tenant" : "tenants"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-500">Tenant</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Plan</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-stone-500">MRR</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Renews</th>
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
                  <tr key={sub.tenant_id} className="hover:bg-stone-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/tenants/${sub.tenant_id}`} className="font-medium text-stone-900 hover:text-stone-600">
                        {tenant?.name ?? "Unknown"}
                      </Link>
                      {tenant?.is_free_forever && (
                        <span className="ml-2 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Free</span>
                      )}
                      {resolved?.source === "tenant_fallback" && (
                        <span
                          className="ml-2 text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"
                          title="Currency inferred from tenant settings — no Stripe price_id on subscription row."
                        >
                          inferred
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-stone-700">{sub.plan}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-900">{cell}</td>
                    <td className="px-4 py-3 text-stone-500">
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
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-red-800 mb-3">⚠️ At Risk — Payment Required ({pastDueSubs.length})</h2>
          <div className="space-y-2">
            {pastDueSubs.map((sub) => {
              const tenant = tenantMap.get(sub.tenant_id);
              return (
                <div key={sub.tenant_id} className="flex items-center justify-between">
                  <Link href={`/admin/tenants/${sub.tenant_id}`} className="text-sm font-medium text-red-800 hover:text-red-900">
                    {tenant?.name ?? "Unknown"}
                  </Link>
                  <span className="text-xs text-red-600 capitalize">{sub.plan}</span>
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
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
            <Skeleton className="h-6 w-6 mb-2" />
            <Skeleton className="h-7 w-24 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <Skeleton className="h-6 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm space-y-3">
            <Skeleton className="h-4 w-40 mb-4" />
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j}>
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full border-t border-stone-100" />
        ))}
      </div>
    </div>
  );
}
