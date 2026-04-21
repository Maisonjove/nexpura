"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recordLaybyPayment, completeLayby } from "@/app/(app)/pos/layby-actions";

interface SaleItem {
  id: string;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  paidAt: string;
}

interface Sale {
  id: string;
  saleNumber: string | null;
  customerName: string | null;
  customerId: string | null;
  total: number;
  amountPaid: number;
  depositAmount: number;
  status: string;
  saleDate: string | null;
}

interface Props {
  sale: Sale;
  saleItems: SaleItem[];
  payments: Payment[];
}

const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "eftpos", "other"];

export default function LaybyDetailClient({
  sale,
  saleItems,
  payments: initialPayments,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Payment form state
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [showPayForm, setShowPayForm] = useState(false);

  // Complete confirm
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completedMsg, setCompletedMsg] = useState<string | null>(null);

  const remaining = Math.max(0, sale.total - sale.amountPaid);
  const isFullyPaid = remaining <= 0.01;
  const isActive = sale.status === "layby";

  function handleRecordPayment() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await recordLaybyPayment(
        sale.id,
        amount,
        payMethod,
        payNotes,
      );
      if (result.error) {
        setError(result.error);
      } else {
        setPayAmount("");
        setPayNotes("");
        setShowPayForm(false);
        if (result.completed) {
          setCompletedMsg("Layby completed! Stock has been deducted from inventory.");
        } else {
          setSuccessMsg("Payment recorded.");
          setTimeout(() => setSuccessMsg(null), 4000);
        }
        router.refresh();
      }
    });
  }

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const result = await completeLayby(sale.id);
      if (result.error) {
        setError(result.error);
      } else {
        setShowCompleteConfirm(false);
        setCompletedMsg("Layby completed! Stock has been deducted from inventory.");
        router.refresh();
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link
          href="/laybys"
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          ← Laybys
        </Link>
        <span className="text-stone-200">/</span>
        <span className="text-sm text-stone-600 font-mono">
          {sale.saleNumber ?? sale.id}
        </span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            Layby — {sale.saleNumber}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {sale.customerName ?? "Unknown customer"}
            {sale.saleDate
              ? ` · ${new Date(sale.saleDate).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`
              : ""}
          </p>
        </div>
        <div>
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Active Layby
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-stone-100 text-stone-600">
              Completed
            </span>
          )}
        </div>
      </div>

      {/* Success / complete messages */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg">
          {successMsg}
        </div>
      )}
      {completedMsg && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
          ✅ {completedMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: items + payment history */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sale Items */}
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-900">Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-xs text-stone-500 uppercase tracking-wide border-b border-stone-100">
                  <th className="px-4 py-2 text-left font-medium">Item</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-right font-medium">Unit</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {saleItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-stone-400 text-center">
                      No items
                    </td>
                  </tr>
                ) : (
                  saleItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-stone-800">
                        {item.description ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-600">
                        {item.quantity ?? 1}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-600">
                        ${(item.unitPrice ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-stone-900">
                        ${(item.lineTotal ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Payment History */}
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-900">
                Payment History
              </h2>
            </div>
            {initialPayments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-stone-400 text-center">
                No payments recorded yet
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-xs text-stone-500 uppercase tracking-wide border-b border-stone-100">
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Method</th>
                    <th className="px-4 py-2 text-left font-medium">Notes</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {initialPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-stone-600 text-xs">
                        {new Date(p.paidAt).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-stone-700 capitalize">
                        {p.paymentMethod.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {p.notes ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-900">
                        ${(p.amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column: summary + actions */}
        <div className="space-y-4">
          {/* Financial Summary */}
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-stone-900 pb-2 border-b border-stone-100">
              Summary
            </h2>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Total</span>
              <span className="font-semibold text-stone-900">
                ${sale.total.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Deposit</span>
              <span className="text-stone-700">
                ${sale.depositAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Amount Paid</span>
              <span className="text-stone-700">
                ${sale.amountPaid.toFixed(2)}
              </span>
            </div>
            <div className="pt-2 border-t border-stone-100 flex justify-between text-sm font-semibold">
              <span className="text-stone-700">Remaining</span>
              <span
                className={
                  isFullyPaid ? "text-green-600" : "text-amber-600"
                }
              >
                ${remaining.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Actions */}
          {isActive && (
            <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-semibold text-stone-900">Actions</h2>

              {!isFullyPaid && !showPayForm && (
                <button
                  onClick={() => setShowPayForm(true)}
                  className="w-full px-4 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6347] transition-colors"
                >
                  Record Payment
                </button>
              )}

              {showPayForm && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={remaining}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder={`Max $${remaining.toFixed(2)}`}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="e.g. Cash received in store"
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRecordPayment}
                      disabled={isPending}
                      className="flex-1 px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6347] disabled:opacity-50 transition-colors"
                    >
                      {isPending ? "Saving…" : "Save Payment"}
                    </button>
                    <button
                      onClick={() => {
                        setShowPayForm(false);
                        setError(null);
                      }}
                      className="px-4 py-2 border border-stone-200 text-stone-600 text-sm rounded-lg hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {isFullyPaid && !showCompleteConfirm && (
                <button
                  onClick={() => setShowCompleteConfirm(true)}
                  className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  ✓ Complete Layby
                </button>
              )}

              {showCompleteConfirm && (
                <div className="space-y-3">
                  <p className="text-sm text-stone-600">
                    Mark this layby as complete? This will deduct items from inventory.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleComplete}
                      disabled={isPending}
                      className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? "Processing…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setShowCompleteConfirm(false)}
                      className="px-4 py-2 border border-stone-200 text-stone-600 text-sm rounded-lg hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
