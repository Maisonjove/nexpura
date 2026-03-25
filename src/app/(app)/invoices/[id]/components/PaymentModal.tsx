"use client";

import { useState } from "react";
import { fmt, PAYMENT_METHODS } from "./helpers";

interface PaymentModalProps {
  isOpen: boolean;
  amountDue: number;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: {
    amount: number;
    method: string;
    date: string;
    reference: string | null;
    notes: string | null;
  }) => void;
}

export default function PaymentModal({
  isOpen,
  amountDue,
  isPending,
  error,
  onClose,
  onSubmit,
}: PaymentModalProps) {
  const [payAmount, setPayAmount] = useState(String(amountDue || 0));
  const [payMethod, setPayMethod] = useState("Cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  if (!isOpen) return null;

  function handleSubmit() {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    onSubmit({
      amount: amt,
      method: payMethod,
      date: payDate,
      reference: payRef || null,
      notes: payNotes || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-stone-200">
          <h2 className="font-semibold text-lg font-semibold text-stone-900">Record Payment</h2>
          <p className="text-sm text-stone-500 mt-0.5">Amount due: {fmt(amountDue)}</p>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full pl-6 pr-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Payment Method</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Payment Date</label>
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Reference</label>
            <input
              type="text"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="Transaction ID, receipt number…"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Notes</label>
            <textarea
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none"
            />
          </div>
        </div>
        <div className="p-6 border-t border-stone-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-stone-900 text-stone-900 rounded-lg hover:bg-stone-900/5 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isPending}
            onClick={handleSubmit}
            className="px-4 py-2 text-sm bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50"
          >
            {isPending ? "Recording…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
