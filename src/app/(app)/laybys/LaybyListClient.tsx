"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import {
  ArrowRightIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";

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
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Sales
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight">
              Laybys
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Manage layby orders and record instalment payments.
            </p>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const isActive = activeStatus === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatus(tab.value)}
                className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 ${
                  isActive
                    ? "bg-stone-900 text-white"
                    : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Layby list */}
        {visible.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <ClipboardDocumentListIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              {activeStatus === "all" ? "No laybys yet" : `No ${activeStatus} laybys`}
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
              {activeStatus === "all"
                ? "Create one from the POS screen to track instalment payments here."
                : "Try a different filter to see other layby orders."}
            </p>
            {activeStatus !== "all" && (
              <button
                onClick={() => setStatus("all")}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                View all laybys
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((lb) => {
              const total = lb.total || 0;
              const paid = lb.amount_paid || 0;
              const remaining = Math.max(0, total - paid);
              const progress = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
              const isActive = lb.status === "layby";
              const isCancelled = lb.status === "cancelled";
              const dueDate = (lb as unknown as { due_date?: string }).due_date;

              const isCompleted = !isActive && !isCancelled;

              return (
                <Link
                  key={lb.id}
                  href={`/laybys/${lb.id}`}
                  className="group block bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2.5">
                        <span className="font-mono text-xs text-stone-400 tabular-nums">
                          {lb.sale_number ?? "—"}
                        </span>
                        {isActive ? (
                          <span className="nx-badge-warning">Active</span>
                        ) : isCancelled ? (
                          <span className="nx-badge-danger">Cancelled</span>
                        ) : (
                          <span className="nx-badge-success">Completed</span>
                        )}
                      </div>
                      <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                        {lb.customer_name ?? "Unknown customer"}
                      </h3>

                      {/* Progress bar */}
                      <div className="mt-5 max-w-md">
                        <div className="flex items-center justify-between text-xs text-stone-500 mb-2 tabular-nums">
                          <span>
                            ${paid.toFixed(2)} of ${total.toFixed(2)} paid
                          </span>
                          <span className="text-stone-700 font-medium">
                            {Math.round(progress)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isCompleted ? "bg-emerald-500" : "bg-nexpura-bronze"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {dueDate && (
                        <p className="text-xs text-stone-500 mt-4">
                          Next due{" "}
                          <span className="text-stone-700">
                            {new Date(dueDate).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
                          Remaining
                        </p>
                        <p className="font-serif text-2xl text-stone-900 leading-none tracking-tight tabular-nums">
                          ${remaining.toFixed(2)}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300">
                        View
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
