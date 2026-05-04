"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { ReceiptRefundIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

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
  pending: "nx-badge-warning",
  approved: "nx-badge-neutral",
  rejected: "nx-badge-neutral",
  completed: "nx-badge-success",
  voided: "nx-badge-neutral",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Refunded",
  voided: "Voided",
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
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Sales
            </p>
            <h1 className="font-serif font-medium text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Refunds
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              {filtered.length} refund{filtered.length !== 1 ? "s" : ""}
              {activeStatus !== "all" && ` (filtered: ${activeStatus})`}
              {" — "}process refunds from individual sale records.
            </p>
          </div>
          <Link
            href="/sales"
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            Go to Sales
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* Status filter tabs */}
        <div className="bg-white border border-stone-200 rounded-2xl p-1.5 mb-10 inline-flex flex-wrap gap-1 max-w-full">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all duration-200 ${
                activeStatus === tab.value
                  ? "bg-nexpura-charcoal text-white"
                  : "text-stone-600 hover:text-nexpura-bronze hover:bg-stone-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List or Empty State */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <ReceiptRefundIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 mb-3 tracking-tight">
              {activeStatus === "all" ? "No refunds yet" : `No ${activeStatus} refunds`}
            </h3>
            <p className="text-stone-500 text-sm mb-7 max-w-sm mx-auto leading-relaxed">
              Process refunds from individual sale records to keep customer balances accurate.
            </p>
            <Link
              href="/sales"
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              Go to Sales
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <Link
                key={r.id}
                href={`/refunds/${r.id}`}
                className="group block nx-card hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
                  {/* Refund # + Customer */}
                  <div className="md:col-span-4 min-w-0">
                    <p className="font-mono text-sm font-semibold text-stone-900 tabular-nums">
                      {r.refund_number || "—"}
                    </p>
                    <p className="text-sm text-stone-700 mt-1.5 truncate">
                      {r.customer_name || <span className="text-stone-400">Walk-in</span>}
                    </p>
                  </div>

                  {/* Reason + Method */}
                  <div className="md:col-span-4 min-w-0">
                    <p className="text-sm text-stone-700 truncate">
                      {r.reason || <span className="text-stone-400">No reason</span>}
                    </p>
                    <p className="text-xs text-stone-500 mt-1.5 capitalize">
                      {r.refund_method || "—"}
                    </p>
                  </div>

                  {/* Status + Date */}
                  <div className="md:col-span-2 min-w-0">
                    <span className={STATUS_BADGE[r.status] || "nx-badge-neutral"}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                    <p className="text-xs text-stone-500 mt-2 tabular-nums">
                      {new Date(r.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="md:col-span-2 md:text-right">
                    <p className="text-base font-semibold text-stone-900 tabular-nums">
                      −{fmtCurrency(r.total)}
                    </p>
                    <span className="text-xs text-stone-400 group-hover:text-nexpura-bronze inline-flex items-center gap-1 mt-2 transition-colors duration-300 md:justify-end">
                      View
                      <ArrowRightIcon className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
