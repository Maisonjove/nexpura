"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

interface Layby {
  id: string;
  sale_number: string | null;
  customer_name: string | null;
  total: number;
  amount_paid: number;
  deposit_amount: number;
  status: string;
  sale_date: string | null;
  created_at: string;
  collected_at?: string | null;
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "layby", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export default function LaybyListClient({ rows }: { rows: Layby[] }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [activeStatus, setActiveStatus] = useState<string>(searchParams.get("status") || "all");

  const setStatus = useCallback((status: string) => {
    setActiveStatus(status || "all");
    const sp = new URLSearchParams();
    if (status && status !== "all") sp.set("status", status);
    const next = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
    if (typeof window !== "undefined") window.history.replaceState(null, "", next);
  }, [pathname]);

  const visible = useMemo(() => {
    if (activeStatus === "all") return rows;
    return rows.filter((r) => r.status === activeStatus);
  }, [rows, activeStatus]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Laybys</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Manage layby orders and record instalment payments
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-1 p-2 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeStatus === tab.value
                  ? "bg-nexpura-charcoal text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        {visible.length === 0 ? (
          <div className="px-6 py-16 text-center text-stone-400 text-sm">
            {activeStatus === "all" ? "No laybys yet. Create one from the POS screen." : `No ${activeStatus} laybys.`}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50 text-xs text-stone-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Sale #</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Paid</th>
                <th className="px-4 py-3 text-right font-medium">Remaining</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Next Due</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((lb) => {
                const remaining = (lb.total || 0) - (lb.amount_paid || 0);
                const isActive = lb.status === "layby";
                const isCancelled = lb.status === "cancelled";
                return (
                  <tr key={lb.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-stone-700 text-xs">
                      {lb.sale_number}
                    </td>
                    <td className="px-4 py-3 text-stone-800 font-medium">
                      {lb.customer_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      ${(lb.total || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      ${(lb.amount_paid || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-900">
                      ${Math.max(0, remaining).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          Active
                        </span>
                      ) : isCancelled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                          Cancelled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-500">
                          Completed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {/* Layby schedules aren't strictly stored as fixed-date instalments;
                          the next due date is implied by remaining-balance and the
                          tenant's instalment cadence. Show "—" when there's no
                          stored due_date column on this row. */}
                      {(lb as unknown as { due_date?: string }).due_date
                        ? new Date((lb as unknown as { due_date: string }).due_date).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/laybys/${lb.id}`}
                        className="text-xs font-medium text-amber-700 hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
