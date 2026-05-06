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

// Cluster-PR item 8 (R5-F4):
// Pre-fix: malformed dates (e.g. ?from=52026-05-01 from a triple-click +
// retype that produced year=52026) silently fell back to the default
// range. The user saw "current month" data but had asked for May 52026
// and had no idea their input was rejected.
//
// Fix: parse strictly (4-digit year, 1-9999 inclusive — matches HTML
// <input type=date> spec) and return both the resolved ISO + a flag the
// page passes to the client to show a banner. The client also pins
// max="9999-12-31" on the input so the type=date picker won't even
// produce a 5-digit year via its native UI; the server-side guard
// handles direct URL manipulation / browser quirks.
function parseDateOrFallback(input: string | undefined, fallback: string): {
  iso: string;
  warning: string | null;
} {
  if (!input) return { iso: fallback, warning: null };
  // Strict YYYY-MM-DD with 4-digit year. Year must be 1-9999.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) {
    return {
      iso: fallback,
      warning: `Invalid date "${input}" — fell back to default range.`,
    };
  }
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return {
      iso: fallback,
      warning: `Date "${input}" is out of range — fell back to default.`,
    };
  }
  const d = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return {
      iso: fallback,
      warning: `Could not parse date "${input}" — fell back to default.`,
    };
  }
  return { iso: d.toISOString(), warning: null };
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

  const fromParsed = parseDateOrFallback(sp.from, startOfMonthIso());
  const toParsed = parseDateOrFallback(sp.to, startOfNextMonthIso());
  const fromIso = fromParsed.iso;
  const toIso = toParsed.iso;
  const dateWarning = [fromParsed.warning, toParsed.warning]
    .filter((w): w is string => Boolean(w))
    .join(" ");

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
      dateWarning={dateWarning || null}
    />
  );
}
