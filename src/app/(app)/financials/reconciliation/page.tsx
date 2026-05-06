/**
 * /financials/reconciliation — A1 Day 3 component 2.
 *
 * Owner + manager only. Gated behind tenants.a1_money_correctness:
 * tenants without the flag get a "this surface is in staged rollout"
 * notice instead of the page (matches the dispatch wrappers in
 * processRefund + /api/pos/refund — same flag, same canonical
 * inclusion criterion).
 *
 * Reads: src/lib/finance/reconciliation.ts:getReconciliationTotals.
 *
 * Date range:
 *   - Default: current calendar month (in tenant timezone — H-01 Day 4
 *     will tighten this; for now we use UTC midnight which is fine for
 *     AUD/AEST tenants since the day boundaries are within minutes).
 *   - User-supplied via ?from=YYYY-MM-DD&to=YYYY-MM-DD query params.
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import {
  getReconciliationTotals,
  buildReconciliationRows,
} from "@/lib/finance/reconciliation";
import ReconciliationClient from "./ReconciliationClient";

export const metadata = { title: "Reconciliation — Nexpura" };

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function startOfNextMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function parseDateOrFallback(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  // Accept YYYY-MM-DD; reject anything else and fall back.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return fallback;
  const d = new Date(`${input}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

export default async function ReconciliationPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const headersList = await headers();
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  const userId = headersList.get(AUTH_HEADERS.USER_ID);
  const role = headersList.get(AUTH_HEADERS.USER_ROLE);
  if (!tenantId || !userId) redirect("/login");

  // Owner + manager only. Staff with finance permission also see /financials,
  // but reconciliation is a higher-priv tool (exposes deltas across views).
  if (role !== "owner" && role !== "manager") {
    redirect("/financials");
  }

  const admin = createAdminClient();

  // Feature-flag gate. Same column as the refund dispatch wrappers
  // (process_refund_v2). The page only makes sense once GL entries
  // are being written + the property invariants hold.
  const { data: tenant } = await admin
    .from("tenants")
    .select("a1_money_correctness, name, timezone")
    .eq("id", tenantId)
    .single();

  if (!tenant?.a1_money_correctness) {
    return (
      <main className="mx-auto max-w-3xl p-8 font-sans">
        <h1 className="text-2xl font-semibold text-stone-900 mb-4">
          Reconciliation
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <p className="text-stone-700 mb-2 font-medium">
            This surface is in staged rollout.
          </p>
          <p className="text-stone-600 text-sm">
            The reconciliation view requires the A1 money-correctness
            mechanism (refund + GL transactional flow) which is being
            rolled out per-tenant. Your tenant is not yet enabled.
            Contact support to opt in early.
          </p>
        </div>
      </main>
    );
  }

  const fromIso = parseDateOrFallback(sp.from, startOfMonthIso());
  const toIso = parseDateOrFallback(sp.to, startOfNextMonthIso());

  const totals = await getReconciliationTotals(admin, tenantId, {
    fromIso,
    toIso,
  });
  const rows = buildReconciliationRows(totals);

  return (
    <ReconciliationClient
      totals={totals}
      rows={rows}
      fromIso={fromIso}
      toIso={toIso}
      tenantName={tenant.name ?? "your tenant"}
    />
  );
}
