"use client";

import Link from "next/link";

interface RefundItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  restock: boolean;
}

interface Refund {
  id: string;
  refund_number: string;
  original_sale_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  reason: string | null;
  refund_method: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Props {
  refund: Refund;
  items: RefundItem[];
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export default function RefundDetailClient({ refund, items }: Props) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/refunds" className="text-stone-400 hover:text-stone-900 text-sm transition-colors">← Refunds</Link>
          <h1 className="text-2xl font-semibold text-stone-900 mt-1">{refund.refund_number}</h1>
          {refund.customer_name && <p className="text-stone-500 text-sm mt-0.5">{refund.customer_name}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex text-sm font-medium px-3 py-1 rounded-full bg-red-50 text-red-600 capitalize">
            {refund.status}
          </span>
          <a
            href={`/api/refund/${refund.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white border border-stone-200 text-stone-700 text-sm font-medium px-4 py-2 rounded-lg hover:border-stone-900 hover:text-stone-900 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download
          </a>
        </div>
      </div>

      {/* Link back to original sale */}
      {refund.original_sale_id && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-stone-700">This refund was processed against an original sale</p>
          <Link
            href={`/sales/${refund.original_sale_id}`}
            className="text-sm text-[#8B7355] font-semibold hover:underline"
          >
            View Original Sale →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">Refunded Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-5 py-3">Item</th>
                    <th className="text-center text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Qty</th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Unit Price</th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Total</th>
                    <th className="text-center text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Restocked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3 text-sm text-stone-900">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-center text-stone-500">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-stone-500">{fmtCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-stone-900">{fmtCurrency(item.line_total)}</td>
                      <td className="px-4 py-3 text-center">
                        {item.restock ? (
                          <span className="text-xs text-green-600 font-medium">✓ Yes</span>
                        ) : (
                          <span className="text-xs text-stone-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 border-t border-stone-200 bg-stone-50/40 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Subtotal</span>
                <span className="text-stone-900">{fmtCurrency(refund.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Tax</span>
                <span className="text-stone-900">{fmtCurrency(refund.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-stone-200 pt-2">
                <span className="text-stone-900">Total Refunded</span>
                <span className="text-lg text-red-600">−{fmtCurrency(refund.total)}</span>
              </div>
            </div>
          </div>

          {refund.notes && (
            <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-2">Notes</h2>
              <p className="text-sm text-stone-700 whitespace-pre-wrap">{refund.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-base font-semibold text-stone-900">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-400">Date</span>
                <span className="text-stone-900">
                  {new Date(refund.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              {refund.refund_method && (
                <div className="flex justify-between">
                  <span className="text-stone-400">Method</span>
                  <span className="text-stone-900 capitalize">{refund.refund_method}</span>
                </div>
              )}
              {refund.reason && (
                <div>
                  <p className="text-stone-400 mb-1">Reason</p>
                  <p className="text-stone-900">{refund.reason}</p>
                </div>
              )}
              {refund.customer_email && (
                <div className="flex justify-between gap-2">
                  <span className="text-stone-400 shrink-0">Email</span>
                  <span className="text-stone-900 truncate text-right text-xs">{refund.customer_email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
