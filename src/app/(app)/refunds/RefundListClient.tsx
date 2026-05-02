"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

interface Refund {
  id: string;
  refund_number: string | null;
  original_sale_id: string | null;
  customer_name: string | null;
  total: number;
  refund_method: string | null;
  reason: string | null;
  status: string;
  created_at: string;
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Processed" },
  { value: "voided", label: "Voided" },
] as const;

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  rejected: "bg-stone-100 text-stone-600",
  completed: "bg-red-50 text-red-700",
  voided: "bg-stone-100 text-stone-500",
};

export default function RefundListClient({ refunds }: { refunds: Refund[] }) {
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

  const filtered = useMemo(() => {
    if (activeStatus === "all") return refunds;
    return refunds.filter((r) => r.status === activeStatus);
  }, [refunds, activeStatus]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Refunds</h1>
          <p className="text-stone-500 text-sm mt-1">
            {filtered.length} refund{filtered.length !== 1 ? "s" : ""}
            {activeStatus !== "all" && ` (filtered: ${activeStatus})`}
          </p>
        </div>
        <p className="text-sm text-stone-400">Process refunds from individual sale records</p>
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

      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center shadow-sm">
          <p className="font-medium text-stone-900 mb-1">
            {activeStatus === "all" ? "No refunds yet" : `No ${activeStatus} refunds`}
          </p>
          <p className="text-sm text-stone-500">Process refunds from individual sale records.</p>
          <Link href="/sales" className="mt-4 inline-block text-sm text-amber-700 hover:underline font-medium">
            Go to Sales →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60">
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-5 py-3">Refund #</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Reason</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Method</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Amount</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-3 text-sm font-mono font-semibold text-stone-900">{r.refund_number}</td>
                  <td className="px-4 py-3 text-sm text-stone-700">{r.customer_name || <span className="text-stone-400">Walk-in</span>}</td>
                  <td className="px-4 py-3 text-sm text-stone-500 max-w-[160px] truncate">{r.reason || "—"}</td>
                  <td className="px-4 py-3 text-sm text-stone-500 capitalize">{r.refund_method || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[r.status] || "bg-stone-100 text-stone-500"}`}>
                      {r.status === "completed" ? "processed" : r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">−{fmtCurrency(r.total)}</td>
                  <td className="px-4 py-3 text-sm text-stone-400">
                    {new Date(r.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/refunds/${r.id}`} className="text-xs text-amber-700 hover:text-[#7a6447] font-medium transition-colors">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
