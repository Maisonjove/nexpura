"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import {
  PlusIcon,
  XMarkIcon,
  TicketIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { createVoucher } from "./actions";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "redeemed", label: "Redeemed" },
  { value: "expired", label: "Expired" },
  { value: "voided", label: "Voided" },
] as const;

interface Voucher {
  id: string;
  code: string;
  original_amount: number;
  balance: number;
  issued_to_name: string | null;
  issued_to_email: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
}

interface Props {
  vouchers: Voucher[];
}

const STATUS_BADGE: Record<string, string> = {
  active: "nx-badge-success",
  redeemed: "nx-badge-neutral",
  expired: "nx-badge-danger",
  voided: "nx-badge-danger",
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export default function VouchersClient({ vouchers }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [showNew, setShowNew] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string>(searchParams.get("status") || "all");

  const setStatus = useCallback((status: string) => {
    setActiveStatus(status || "all");
    const sp = new URLSearchParams();
    if (status && status !== "all") sp.set("status", status);
    const next = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
    if (typeof window !== "undefined") window.history.replaceState(null, "", next);
  }, [pathname]);

  // "expired" is computed (status='active' but expires_at < today) since the
  // DB never auto-transitions to expired. Voucher list mirrors this so the
  // chip-filtered counts match the user's expectation.
  const todayStr = new Date().toISOString().split("T")[0];
  const visibleVouchers = useMemo(() => {
    if (activeStatus === "all") return vouchers;
    if (activeStatus === "expired") {
      return vouchers.filter(
        (v) => v.status === "active" && !!v.expires_at && v.expires_at < todayStr
      );
    }
    if (activeStatus === "active") {
      return vouchers.filter(
        (v) => v.status === "active" && (!v.expires_at || v.expires_at >= todayStr)
      );
    }
    return vouchers.filter((v) => v.status === activeStatus);
  }, [vouchers, activeStatus, todayStr]);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createVoucher(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12 px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
      <div className="max-w-[1400px] mx-auto">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Sales
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Gift Vouchers
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              {vouchers.length} voucher{vouchers.length !== 1 ? "s" : ""} issued. Track balances, expiries, and redemptions.
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            New Voucher
          </button>
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 mb-10 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 ${
                activeStatus === tab.value
                  ? "bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] text-white shadow-[0_2px_4px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Voucher List */}
        {visibleVouchers.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl py-20 px-8 text-center">
            <TicketIcon className="w-8 h-8 text-stone-300 mx-auto mb-6" strokeWidth={1.5} />
            <h3 className="font-serif text-2xl text-stone-900 mb-3 tracking-tight">No gift vouchers yet</h3>
            <p className="text-stone-500 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
              Issue a voucher to gift a balance that customers can redeem at checkout.
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Issue Voucher
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleVouchers.map((v) => {
              const isExpired = v.status === "active" && !!v.expires_at && v.expires_at < todayStr;
              const displayStatus = isExpired ? "expired" : v.status;
              const badgeClass = STATUS_BADGE[displayStatus] || "nx-badge-neutral";
              return (
                <Link
                  key={v.id}
                  href={`/vouchers/${v.id}`}
                  className="group block bg-white border border-stone-200 rounded-2xl px-6 py-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 hover:-translate-y-0.5 transition-all duration-400"
                >
                  <div className="flex items-center gap-6">
                    {/* Icon */}
                    <div className="shrink-0">
                      <TicketIcon
                        className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-400"
                        strokeWidth={1.5}
                      />
                    </div>

                    {/* Code + recipient */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="inline-flex items-center font-mono text-[0.8125rem] font-medium text-stone-700 tracking-[0.05em] bg-stone-50 border border-stone-200 rounded-md px-2 py-0.5">
                          {v.code}
                        </span>
                        <span className={`${badgeClass} capitalize`}>
                          {displayStatus}
                        </span>
                      </div>
                      <p className="text-sm text-stone-500 mt-2 leading-relaxed truncate">
                        {v.issued_to_name || "Unassigned"}
                        {v.expires_at ? (
                          <>
                            <span className="mx-2 text-stone-300">·</span>
                            Expires {new Date(v.expires_at).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </>
                        ) : (
                          <>
                            <span className="mx-2 text-stone-300">·</span>
                            No expiry
                          </>
                        )}
                      </p>
                    </div>

                    {/* Amount block */}
                    <div className="text-right shrink-0">
                      <p className="font-serif text-2xl text-stone-900 tabular-nums leading-none tracking-tight">
                        {fmtCurrency(v.balance)}
                      </p>
                      <p className="text-[0.75rem] text-stone-400 mt-2 tabular-nums">
                        of {fmtCurrency(v.original_amount)}
                      </p>
                    </div>

                    {/* Arrow */}
                    <ArrowRightIcon
                      className="w-4 h-4 text-stone-300 group-hover:text-nexpura-bronze group-hover:translate-x-0.5 transition-all duration-400 shrink-0"
                      strokeWidth={1.5}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* New Voucher Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
              <div>
                <p className="text-[0.6875rem] uppercase tracking-luxury text-stone-400 mb-1">
                  Sales
                </p>
                <h2 className="font-serif text-2xl text-stone-900 tracking-tight leading-none">
                  Issue Gift Voucher
                </h2>
              </div>
              <button
                onClick={() => setShowNew(false)}
                className="text-stone-400 hover:text-stone-700 transition-colors duration-200 -mr-1"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 tabular-nums placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Custom Code
                </label>
                <input
                  name="custom_code"
                  type="text"
                  placeholder="Auto-generated if blank"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 font-mono uppercase tracking-[0.05em] placeholder:text-stone-400 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Recipient Name
                  </label>
                  <input
                    name="issued_to_name"
                    type="text"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Recipient Email
                  </label>
                  <input
                    name="issued_to_email"
                    type="email"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Expiry Date
                </label>
                <input
                  name="expires_at"
                  type="date"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-5 border-t border-stone-200 -mx-6 px-6 -mb-6 pb-6 bg-stone-50/40 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Creating…" : "Issue Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
