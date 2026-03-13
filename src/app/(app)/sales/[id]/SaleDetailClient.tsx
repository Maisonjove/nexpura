"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateSaleStatus, deleteSale } from "../actions";

interface SaleItem {
  id: string;
  description: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
}

interface Sale {
  id: string;
  sale_number: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  payment_method: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  sale_date: string;
  created_at: string;
}

interface Props {
  sale: Sale;
  items: SaleItem[];
}

const STATUSES = ["quote", "confirmed", "paid", "completed", "refunded", "layby"];

const STATUS_COLOURS: Record<string, string> = {
  quote: "bg-stone-100 text-stone-700",
  confirmed: "bg-stone-100 text-stone-700",
  paid: "bg-green-50 text-green-700",
  completed: "bg-stone-100 text-[#8B7355]",
  refunded: "bg-red-50 text-red-600",
  layby: "bg-amber-50 text-amber-700",
};

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function SaleDetailClient({ sale, items }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  function handleStatusChange(newStatus: string) {
    startTransition(async () => {
      const result = await updateSaleStatus(sale.id, newStatus);
      if (result?.error) {
        setStatusMsg(`Error: ${result.error}`);
      } else {
        setStatusMsg("Status updated");
        router.refresh();
        setTimeout(() => setStatusMsg(null), 3000);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSale(sale.id);
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/sales" className="text-stone-400 hover:text-stone-900 transition-colors text-sm">
              ← Sales
            </Link>
          </div>
          <h1 className="font-semibold text-2xl font-semibold text-stone-900">
            {sale.sale_number}
          </h1>
          {sale.customer_name && (
            <p className="text-stone-500 mt-1">{sale.customer_name}</p>
          )}
        </div>
        <span
          className={`inline-flex items-center text-sm font-medium px-3 py-1 rounded-full capitalize ${
            STATUS_COLOURS[sale.status] || "bg-stone-900/10 text-stone-500"
          }`}
        >
          {sale.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Line items */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">Line Items</h2>
            </div>
            {items.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-stone-400">
                No line items recorded
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-5 py-3">
                        Description
                      </th>
                      <th className="text-center text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                        Qty
                      </th>
                      <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                        Unit Price
                      </th>
                      <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-platinum">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-3 text-sm text-stone-900">{item.description}</td>
                        <td className="px-4 py-3 text-sm text-center text-stone-500">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-right text-stone-500">
                          {fmtCurrency(item.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-stone-900">
                          {fmtCurrency(item.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div className="px-5 py-4 border-t border-stone-200 bg-stone-50/40 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Subtotal</span>
                <span className="text-stone-900">{fmtCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Discount</span>
                  <span className="text-stone-900">−{fmtCurrency(sale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">GST (10%)</span>
                <span className="text-stone-900">{fmtCurrency(sale.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-stone-200 pt-2">
                <span className="text-stone-900">Total</span>
                <span className="font-semibold text-lg text-stone-900">{fmtCurrency(sale.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {sale.notes && (
            <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-2">Notes</h2>
              <p className="text-sm text-stone-900/70 whitespace-pre-wrap">{sale.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Actions */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-stone-900">Actions</h3>

            {/* Status update */}
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                Update Status
              </label>
              <div className="space-y-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={isPending || s === sale.status}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-all capitalize ${
                      s === sale.status
                        ? "bg-stone-100 text-[#8B7355] font-medium"
                        : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                    } disabled:opacity-50`}
                  >
                    {s === sale.status && "✓ "}
                    {s}
                  </button>
                ))}
              </div>
              {statusMsg && (
                <p className="mt-2 text-xs text-[#8B7355] font-medium">{statusMsg}</p>
              )}
            </div>

            {/* Delete */}
            <div className="border-t border-stone-200 pt-4">
              {showDelete ? (
                <div className="space-y-2">
                  <p className="text-xs text-stone-500">
                    Delete this sale permanently? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={isPending}
                      className="flex-1 bg-red-500 text-white text-xs font-medium py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {isPending ? "Deleting…" : "Confirm Delete"}
                    </button>
                    <button
                      onClick={() => setShowDelete(false)}
                      className="flex-1 bg-white border border-stone-200 text-stone-900 text-xs font-medium py-2 rounded-lg hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDelete(true)}
                  className="w-full text-xs text-stone-400 hover:text-red-500 transition-colors text-left"
                >
                  Delete sale…
                </button>
              )}
            </div>
          </div>

          {/* Sale info */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-base font-semibold text-stone-900">Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
                  Sale #
                </span>
                <span className="text-sm font-mono font-medium text-stone-900">
                  {sale.sale_number}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
                  Date
                </span>
                <span className="text-sm text-stone-900">
                  {new Date(sale.sale_date || sale.created_at).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              {sale.payment_method && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
                    Payment
                  </span>
                  <span className="text-sm text-stone-900 capitalize">{sale.payment_method}</span>
                </div>
              )}
              {sale.customer_email && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
                    Email
                  </span>
                  <span className="text-sm text-stone-900 truncate max-w-[160px]">
                    {sale.customer_email}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
