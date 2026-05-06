"use client";

/**
 * Reconciliation client — date picker + diff table.
 *
 * Reads server-computed rows; renders pass/fail per row with the
 * canonical green/red colour treatment Joey specified in the A1
 * scope. Date-picker writes to ?from + ?to query params and reloads
 * the page server-side (no client-side fetching — keeps the
 * server-side aggregator as the single source of truth).
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  ReconciliationTotals,
  ReconciliationRow,
} from "@/lib/finance/reconciliation";

interface Props {
  totals: ReconciliationTotals;
  rows: ReconciliationRow[];
  fromIso: string;
  toIso: string;
  tenantName: string;
}

function isoToDateInput(iso: string): string {
  // ISO timestamp → YYYY-MM-DD for <input type=date>.
  return iso.slice(0, 10);
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function ReconciliationClient({
  totals,
  rows,
  fromIso,
  toIso,
  tenantName,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(isoToDateInput(fromIso));
  const [to, setTo] = useState(isoToDateInput(toIso));

  function applyRange() {
    const next = new URLSearchParams(sp.toString());
    next.set("from", from);
    next.set("to", to);
    startTransition(() => {
      router.push(`/financials/reconciliation?${next.toString()}`);
    });
  }

  const allMatch = rows.every((r) => r.isMatch);

  return (
    <main className="mx-auto max-w-5xl p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Reconciliation</h1>
        <p className="text-stone-600 text-sm mt-1">
          Cross-checks Sales / Refunds / GL totals for {tenantName}. Matches
          highlighted in green; deltas beyond ±$0.01 in red.
        </p>
      </header>

      <div className="bg-white border border-stone-200 rounded-lg p-4 mb-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-stone-600">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-stone-300 rounded px-3 py-1.5"
            disabled={isPending}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-stone-600">To (exclusive)</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-stone-300 rounded px-3 py-1.5"
            disabled={isPending}
          />
        </label>
        <button
          type="button"
          onClick={applyRange}
          disabled={isPending}
          className="bg-stone-900 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Apply"}
        </button>
      </div>

      <div
        className={`mb-6 rounded-lg p-4 text-sm ${
          allMatch
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}
      >
        <strong>{allMatch ? "All checks pass." : "Deltas detected."}</strong>{" "}
        {allMatch
          ? "The 4 reconciliation invariants hold for this date range."
          : `${rows.filter((r) => !r.isMatch).length} of ${rows.length} checks have non-zero deltas. Investigate the rows below.`}
      </div>

      <div className="overflow-x-auto bg-white border border-stone-200 rounded-lg">
        <table className="w-full text-sm" data-testid="reconciliation-table">
          <thead className="bg-stone-50 text-left text-stone-700">
            <tr>
              <th className="px-4 py-3 font-medium">Check</th>
              <th className="px-4 py-3 font-medium text-right">Expected</th>
              <th className="px-4 py-3 font-medium text-right">Actual</th>
              <th className="px-4 py-3 font-medium text-right">Δ</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.label}
                className={`border-t border-stone-100 ${
                  r.isMatch ? "" : "bg-red-50/40"
                }`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-900">{r.label}</div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {r.description}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-stone-700">
                  {fmtMoney(r.expected)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-stone-700">
                  {fmtMoney(r.actual)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono ${
                    r.isMatch ? "text-stone-500" : "text-red-700 font-semibold"
                  }`}
                >
                  {fmtMoney(r.delta)}
                </td>
                <td className="px-4 py-3 text-center">
                  {r.isMatch ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Match
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      Δ {fmtMoney(Math.abs(r.delta))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-xs text-stone-500">
        <strong>Row counts in range:</strong> sales={totals.counts.sales} ·
        sale_items={totals.counts.saleLineItems} ·
        refunds={totals.counts.refunds} ·
        refund_items={totals.counts.refundItems} ·
        gl_entries={totals.counts.glEntries}
      </div>
    </main>
  );
}
