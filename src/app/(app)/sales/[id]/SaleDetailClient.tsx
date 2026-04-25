"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateSaleStatus, deleteSale, generatePassportFromSaleItem } from "../actions";
import { processRefund } from "../../refunds/actions";
import { recordLaybyPayment } from "../actions-layby";

interface SaleItem {
  id: string;
  description: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
  inventory_id?: string | null;
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

interface LaybyPayment {
  id: string;
  amount: number;
  payment_method: string;
  // Schema column is `paid_at` (the older `payment_date` name never
  // existed). Page-side select was queried wrongly for months and 500'd
  // every layby sale-detail load — see migration history + 2026-04-25 fix.
  paid_at: string;
  notes: string | null;
}

interface Props {
  sale: Sale;
  items: SaleItem[];
  initialInvoiceId?: string | null;
  laybyPayments?: LaybyPayment[];
}

const STATUSES = ["quote", "confirmed", "paid", "completed", "refunded", "layby"];

const STATUS_COLOURS: Record<string, string> = {
  quote: "bg-stone-100 text-stone-700",
  confirmed: "bg-stone-100 text-stone-700",
  paid: "bg-green-50 text-green-700",
  completed: "bg-stone-100 text-amber-700",
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

export default function SaleDetailClient({ sale, items, initialInvoiceId, laybyPayments = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(initialInvoiceId ?? null);
  const [passportMsgs, setPassportMsgs] = useState<Record<string, string>>({});
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundItems, setRefundItems] = useState<Record<string, boolean>>({});
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("card");
  const [refundNotes, setRefundNotes] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  // Layby payment state
  const [showLaybyModal, setShowLaybyModal] = useState(false);
  const [laybyAmount, setLaybyAmount] = useState("");
  const [laybyMethod, setLaybyMethod] = useState("cash");
  const [laybyNotes, setLaybyNotes] = useState("");
  const [laybyDate, setLaybyDate] = useState(new Date().toISOString().split("T")[0]);
  const [laybyError, setLaybyError] = useState<string | null>(null);
  const [laybySuccess, setLaybySuccess] = useState<string | null>(null);
  const [currentAmountPaid, setCurrentAmountPaid] = useState<number>(sale.amount_paid ?? 0);

  function handleStatusChange(newStatus: string) {
    startTransition(async () => {
      const result = await updateSaleStatus(sale.id, newStatus);
      if (result?.error) {
        setStatusMsg(`Error: ${result.error}`);
      } else {
        if (result.invoiceId) {
          setInvoiceId(result.invoiceId);
          setStatusMsg(`Status updated — invoice auto-created!`);
        } else {
          setStatusMsg("Status updated");
        }
        router.refresh();
        setTimeout(() => setStatusMsg(null), 5000);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSale(sale.id);
    });
  }

  function handleProcessRefund() {
    setRefundError(null);
    const selectedItems = items.filter((item) => refundItems[item.id]);
    if (selectedItems.length === 0) {
      setRefundError("Select at least one item to refund");
      return;
    }
    if (!refundReason.trim()) {
      setRefundError("Refund reason is required");
      return;
    }
    startTransition(async () => {
      const result = await processRefund({
        originalSaleId: sale.id,
        reason: refundReason,
        refundMethod,
        notes: refundNotes,
        items: selectedItems.map((item) => ({
          original_sale_item_id: item.id,
          inventory_id: item.inventory_id ?? null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          restock: !!item.inventory_id,
        })),
      });
      if (result?.error) setRefundError(result.error);
    });
  }

  function handleGeneratePassport(item: SaleItem) {
    startTransition(async () => {
      const result = await generatePassportFromSaleItem(sale.id, item.description, item.inventory_id ?? null);
      if (result.error) {
        setPassportMsgs((prev) => ({ ...prev, [item.id]: `Error: ${result.error}` }));
      } else if (result.passportId) {
        setPassportMsgs((prev) => ({ ...prev, [item.id]: `Passport created!` }));
        router.refresh();
      }
    });
  }

  function handleLaybyPayment() {
    setLaybyError(null);
    const amount = parseFloat(laybyAmount);
    if (isNaN(amount) || amount <= 0) {
      setLaybyError("Enter a valid payment amount");
      return;
    }
    const remaining = sale.total - currentAmountPaid;
    if (amount > remaining + 0.01) {
      setLaybyError(`Amount exceeds remaining balance of ${fmtCurrency(remaining)}`);
      return;
    }
    startTransition(async () => {
      const result = await recordLaybyPayment({
        saleId: sale.id,
        amount,
        paymentMethod: laybyMethod,
        notes: laybyNotes || undefined,
        paymentDate: laybyDate,
      });
      if (result.error) {
        setLaybyError(result.error);
      } else {
        const newPaid = result.newAmountPaid ?? currentAmountPaid + amount;
        setCurrentAmountPaid(newPaid);
        setLaybyAmount("");
        setLaybyNotes("");
        setShowLaybyModal(false);
        if (result.fullyPaid) {
          setLaybySuccess("Layby complete — payment received in full");
        } else {
          setLaybySuccess(`Payment of ${fmtCurrency(amount)} recorded successfully`);
        }
        router.refresh();
        setTimeout(() => setLaybySuccess(null), 6000);
      }
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
          <h1 className="font-semibold text-2xl text-stone-900">
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

      {/* Invoice created banner */}
      {invoiceId && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-green-800 font-medium">
            ✓ Invoice auto-created for this sale
          </p>
          <Link
            href={`/invoices/${invoiceId}`}
            className="text-sm text-green-700 font-semibold hover:underline"
          >
            View Invoice →
          </Link>
        </div>
      )}

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
                      <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                        Passport
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
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
                        <td className="px-4 py-3 text-right">
                          {passportMsgs[item.id] ? (
                            <span className="text-xs text-green-600">{passportMsgs[item.id]}</span>
                          ) : (
                            <button
                              onClick={() => handleGeneratePassport(item)}
                              disabled={isPending}
                              title="Generate digital passport"
                              className="text-xs text-[#52B788] hover:text-[#3d9068] font-medium transition-colors disabled:opacity-50"
                            >
                              + Passport
                            </button>
                          )}
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
                <span className="text-stone-500">Tax</span>
                <span className="text-stone-900">{fmtCurrency(sale.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-stone-200 pt-2">
                <span className="text-stone-900">Total</span>
                <span className="font-semibold text-lg text-stone-900">{fmtCurrency(sale.total)}</span>
              </div>
            </div>
          </div>

          {/* Layby Payments Panel */}
          {(sale.status === "layby" || sale.payment_method === "layby") && (
            <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-amber-200 bg-amber-50/50 flex items-center justify-between">
                <h2 className="text-base font-semibold text-stone-900">Layby Payments</h2>
                {sale.status === "layby" && (
                  <button
                    onClick={() => {
                      setLaybyError(null);
                      setLaybyAmount("");
                      setLaybyNotes("");
                      setLaybyDate(new Date().toISOString().split("T")[0]);
                      setShowLaybyModal(true);
                    }}
                    className="text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Record Payment
                  </button>
                )}
              </div>
              <div className="px-5 py-4 space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-stone-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-stone-500 mb-1">Total</p>
                    <p className="text-sm font-semibold text-stone-900">{fmtCurrency(sale.total)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600 mb-1">Paid</p>
                    <p className="text-sm font-semibold text-green-700">{fmtCurrency(currentAmountPaid)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-amber-600 mb-1">Remaining</p>
                    <p className="text-sm font-semibold text-amber-700">{fmtCurrency(Math.max(0, sale.total - currentAmountPaid))}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-amber-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (currentAmountPaid / sale.total) * 100)}%` }}
                  />
                </div>

                {/* Payment history */}
                {laybyPayments.length > 0 ? (
                  <div className="space-y-0 border border-stone-100 rounded-lg overflow-hidden">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-2 bg-stone-50 border-b border-stone-100">
                      Payment History
                    </p>
                    {laybyPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-stone-100 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-stone-900">{fmtCurrency(p.amount)}</p>
                          <p className="text-xs text-stone-400 capitalize">
                            {p.payment_method} · {new Date(p.paid_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {p.notes && <p className="text-xs text-stone-400 italic mt-0.5">{p.notes}</p>}
                        </div>
                        <span className="text-xs text-green-600 font-medium">✓</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400 text-center py-2">No follow-up payments yet</p>
                )}
              </div>
            </div>
          )}

          {/* Layby success message */}
          {laybySuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 font-medium">
              ✓ {laybySuccess}
            </div>
          )}

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
                        ? "bg-stone-100 text-amber-700 font-medium"
                        : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                    } disabled:opacity-50`}
                  >
                    {s === sale.status && "✓ "}
                    {s}
                  </button>
                ))}
              </div>
              {statusMsg && (
                <p className="mt-2 text-xs text-amber-700 font-medium">{statusMsg}</p>
              )}
            </div>

            {/* View Invoice + Print Invoice */}
            {invoiceId && (
              <div className="border-t border-stone-200 pt-4 space-y-2">
                <Link
                  href={`/invoices/${invoiceId}`}
                  className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium bg-[#52B788] text-white py-2 px-4 rounded-lg hover:bg-[#3d9068] transition-colors"
                >
                  View Invoice
                </Link>
                <a
                  href={`/api/invoice/${invoiceId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-white border border-stone-200 text-stone-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:border-stone-900 hover:text-stone-900 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Invoice
                </a>
              </div>
            )}

            {/* Refund */}
            {(sale.status === "paid" || sale.status === "completed") && items.length > 0 && (
              <div className="border-t border-stone-200 pt-4">
                <button
                  onClick={() => {
                    setRefundItems({});
                    setRefundReason("");
                    setRefundMethod("card");
                    setRefundNotes("");
                    setRefundError(null);
                    setShowRefundModal(true);
                  }}
                  className="w-full text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors text-left"
                >
                  Process Refund…
                </button>
              </div>
            )}

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

      {/* Layby Payment Modal */}
      {showLaybyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-semibold text-stone-900 text-lg">Record Layby Payment</h3>
              <button onClick={() => setShowLaybyModal(false)} className="text-stone-400 hover:text-stone-900 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-5">
              {/* Balance info */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Remaining balance</span>
                  <span className="font-semibold text-amber-700">{fmtCurrency(Math.max(0, sale.total - currentAmountPaid))}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-stone-600">Total paid so far</span>
                  <span className="font-medium text-stone-700">{fmtCurrency(currentAmountPaid)}</span>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={sale.total - currentAmountPaid}
                  value={laybyAmount}
                  onChange={(e) => setLaybyAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
                <button
                  type="button"
                  onClick={() => setLaybyAmount((sale.total - currentAmountPaid).toFixed(2))}
                  className="mt-1 text-xs text-amber-700 hover:underline"
                >
                  Pay in full ({fmtCurrency(Math.max(0, sale.total - currentAmountPaid))})
                </button>
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Payment Method *</label>
                <select
                  value={laybyMethod}
                  onChange={(e) => setLaybyMethod(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card / EFTPOS</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Payment Date</label>
                <input
                  type="date"
                  value={laybyDate}
                  onChange={(e) => setLaybyDate(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Notes (optional)</label>
                <input
                  type="text"
                  value={laybyNotes}
                  onChange={(e) => setLaybyNotes(e.target.value)}
                  placeholder="e.g. Cash payment received"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              {laybyError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{laybyError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleLaybyPayment}
                  disabled={isPending}
                  className="flex-1 py-3 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Recording…" : "Record Payment"}
                </button>
                <button
                  onClick={() => setShowLaybyModal(false)}
                  className="flex-1 py-3 bg-stone-100 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-semibold text-stone-900 text-lg">Process Refund</h3>
              <button onClick={() => setShowRefundModal(false)} className="text-stone-400 hover:text-stone-900 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-5">
              {/* Select items */}
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Select items to refund</p>
                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  {items.map((item) => (
                    <label key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-0">
                      <input
                        type="checkbox"
                        checked={!!refundItems[item.id]}
                        onChange={(e) => setRefundItems((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                        className="rounded border-stone-300 text-amber-700 focus:ring-amber-600"
                      />
                      <span className="flex-1 text-sm text-stone-900">{item.description}</span>
                      <span className="text-sm font-medium text-stone-700">{fmtCurrency(item.line_total)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Reason *</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Faulty item, Customer changed mind"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              {/* Refund method */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Refund Method *</label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                >
                  <option value="card">Card / EFTPOS</option>
                  <option value="cash">Cash</option>
                  <option value="store_credit">Store Credit</option>
                  <option value="voucher">Gift Voucher</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Notes (optional)</label>
                <textarea
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 resize-none"
                />
              </div>

              {/* Totals preview */}
              {Object.values(refundItems).some(Boolean) && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                  <p className="text-xs text-red-600 font-medium mb-1">Refund Total (estimated)</p>
                  <p className="text-2xl font-bold text-red-600">
                    −{fmtCurrency(
                      items
                        .filter((i) => refundItems[i.id])
                        .reduce((sum, i) => sum + i.line_total, 0) * 1.1
                    )}
                  </p>
                  <p className="text-xs text-red-400 mt-1">Including tax. Stock will be automatically returned for inventory items.</p>
                </div>
              )}

              {refundError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{refundError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleProcessRefund}
                  disabled={isPending}
                  className="flex-1 py-3 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Processing…" : "Process Refund"}
                </button>
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="flex-1 py-3 bg-stone-100 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
