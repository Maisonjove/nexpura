"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { voidVoucher } from "../actions";

interface Voucher {
  id: string;
  code: string;
  original_amount: number;
  balance: number;
  issued_to_name: string | null;
  issued_to_email: string | null;
  issued_by: string | null;
  expires_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Redemption {
  id: string;
  amount_used: number;
  sale_id: string | null;
  created_at: string;
}

interface Props {
  voucher: Voucher;
  redemptions: Redemption[];
}

const STATUS_COLOURS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  redeemed: "bg-stone-100 text-stone-500",
  expired: "bg-red-50 text-red-500",
  voided: "bg-red-50 text-red-500",
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export default function VoucherDetailClient({ voucher, redemptions }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showVoid, setShowVoid] = useState(false);

  const usedAmount = voucher.original_amount - voucher.balance;
  const usedPct = (usedAmount / voucher.original_amount) * 100;

  function handleVoid() {
    startTransition(async () => {
      await voidVoucher(voucher.id);
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/vouchers" className="text-stone-400 hover:text-stone-900 text-sm transition-colors">← Vouchers</Link>
          <h1 className="text-2xl font-semibold font-mono text-stone-900 mt-1">{voucher.code}</h1>
          {voucher.issued_to_name && (
            <p className="text-stone-500 mt-0.5 text-sm">Issued to {voucher.issued_to_name}</p>
          )}
        </div>
        <span className={`inline-flex text-sm font-medium px-3 py-1 rounded-full capitalize ${STATUS_COLOURS[voucher.status] || "bg-stone-100 text-stone-500"}`}>
          {voucher.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Balance</h2>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Remaining balance</p>
                <p className="text-4xl font-bold text-stone-900">{fmtCurrency(voucher.balance)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-400 mb-0.5">Original value</p>
                <p className="text-lg font-semibold text-stone-500">{fmtCurrency(voucher.original_amount)}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-stone-100 rounded-full h-2">
              <div
                className="bg-amber-700 h-2 rounded-full transition-all"
                style={{ width: `${Math.max(0, 100 - usedPct)}%` }}
              />
            </div>
            <p className="text-xs text-stone-400 mt-1.5">{fmtCurrency(usedAmount)} used of {fmtCurrency(voucher.original_amount)}</p>
          </div>

          {/* Redemption History */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">Redemption History</h2>
            </div>
            {redemptions.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-stone-400">No redemptions yet</div>
            ) : (
              <div className="divide-y divide-stone-100">
                {redemptions.map((r) => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-900">−{fmtCurrency(r.amount_used)}</p>
                      {r.sale_id && (
                        <Link href={`/sales/${r.sale_id}`} className="text-xs text-amber-700 hover:underline">
                          View sale →
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-stone-400">
                      {new Date(r.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-stone-900">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-400">Code</span>
                <span className="font-mono font-semibold text-stone-900">{voucher.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Issued</span>
                <span className="text-stone-900">
                  {new Date(voucher.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              {voucher.issued_to_email && (
                <div className="flex justify-between gap-2">
                  <span className="text-stone-400 shrink-0">Email</span>
                  <span className="text-stone-900 truncate text-right">{voucher.issued_to_email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-400">Expires</span>
                <span className="text-stone-900">
                  {voucher.expires_at
                    ? new Date(voucher.expires_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                    : "No expiry"}
                </span>
              </div>
            </div>
            {voucher.notes && (
              <div className="border-t border-stone-100 pt-3">
                <p className="text-xs text-stone-400 mb-1">Notes</p>
                <p className="text-sm text-stone-700">{voucher.notes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {voucher.status === "active" && (
            <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-base font-semibold text-stone-900">Actions</h3>
              <p className="text-xs text-stone-500">
                To redeem this voucher, use code <strong className="font-mono">{voucher.code}</strong> in the POS payment screen.
              </p>
              {showVoid ? (
                <div className="space-y-2">
                  <p className="text-xs text-red-600">Void this voucher? It cannot be reactivated.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleVoid}
                      disabled={isPending}
                      className="flex-1 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {isPending ? "Voiding…" : "Confirm Void"}
                    </button>
                    <button
                      onClick={() => setShowVoid(false)}
                      className="flex-1 py-2 bg-stone-100 text-stone-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowVoid(true)}
                  className="text-xs text-stone-400 hover:text-red-500 transition-colors"
                >
                  Void voucher…
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
