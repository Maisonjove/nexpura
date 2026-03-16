"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createVoucher } from "./actions";

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

const STATUS_COLOURS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  redeemed: "bg-stone-100 text-stone-500",
  expired: "bg-red-50 text-red-500",
  voided: "bg-red-50 text-red-500",
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export default function VouchersClient({ vouchers }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Gift Vouchers</h1>
          <p className="text-stone-500 text-sm mt-1">{vouchers.length} voucher{vouchers.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6447] transition-colors"
        >
          + New Voucher
        </button>
      </div>

      {/* New Voucher Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-semibold text-stone-900 text-lg">Issue Gift Voucher</h3>
              <button onClick={() => setShowNew(false)} className="text-stone-400 hover:text-stone-900 text-xl">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                  Amount *
                </label>
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                  Custom Code (optional — auto-generated if blank)
                </label>
                <input
                  name="custom_code"
                  type="text"
                  placeholder="e.g. BIRTHDAY2026"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Recipient Name</label>
                  <input
                    name="issued_to_name"
                    type="text"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Recipient Email</label>
                  <input
                    name="issued_to_email"
                    type="email"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Expiry Date (optional)</label>
                <input
                  name="expires_at"
                  type="date"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 bg-amber-700 text-white text-sm font-semibold rounded-lg hover:bg-[#7a6447] transition-colors disabled:opacity-50"
                >
                  {isPending ? "Creating…" : "Issue Voucher"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="flex-1 py-2.5 bg-stone-100 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voucher List */}
      {vouchers.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <p className="font-medium text-stone-900 mb-1">No gift vouchers yet</p>
          <p className="text-sm text-stone-500">Issue a voucher to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60">
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-5 py-3">Code</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Issued To</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Original</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Balance</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Expires</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-3 text-sm font-mono font-semibold text-stone-900">{v.code}</td>
                  <td className="px-4 py-3 text-sm text-stone-700">{v.issued_to_name || <span className="text-stone-400">—</span>}</td>
                  <td className="px-4 py-3 text-sm text-right text-stone-500">{fmtCurrency(v.original_amount)}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-stone-900">{fmtCurrency(v.balance)}</td>
                  <td className="px-4 py-3 text-sm text-stone-500">
                    {v.expires_at
                      ? new Date(v.expires_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                      : <span className="text-stone-400">No expiry</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLOURS[v.status] || "bg-stone-100 text-stone-500"}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/vouchers/${v.id}`}
                      className="text-xs text-amber-700 hover:text-[#7a6447] font-medium transition-colors"
                    >
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
