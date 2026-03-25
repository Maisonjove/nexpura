"use client";

import { useState, useEffect } from "react";
import { PAYMENT_METHODS } from "../constants";

interface RecordPaymentModalProps {
  isOpen: boolean;
  currency: string;
  isPending: boolean;
  initialAmount?: number;
  hasInvoice: boolean;
  onClose: () => void;
  onSubmit: (data: { amount: number; method: string; notes: string }) => void;
}

export default function RecordPaymentModal({
  isOpen,
  currency,
  isPending,
  initialAmount,
  hasInvoice,
  onClose,
  onSubmit,
}: RecordPaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialAmount) {
      setPaymentAmount(String(initialAmount));
    }
  }, [isOpen, initialAmount]);

  if (!isOpen) return null;

  function handleSubmit() {
    setFormError(null);
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      setFormError("Enter a valid amount");
      return;
    }
    if (!hasInvoice) {
      setFormError("No invoice linked. Add a line item first.");
      return;
    }
    onSubmit({ amount, method: paymentMethod, notes: paymentNotes });
    setPaymentAmount("");
    setPaymentNotes("");
  }

  function handleClose() {
    setFormError(null);
    setPaymentAmount("");
    setPaymentNotes("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg text-stone-900 mb-4">Record Payment</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Amount ({currency}) *</label>
            <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" step="0.01" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-700" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-700">
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Notes (optional)</label>
            <input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g. 50% deposit" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-700" />
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={handleClose} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending} className="flex-1 bg-amber-700 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-amber-800 disabled:opacity-50">{isPending ? "Recording…" : "Record Payment"}</button>
        </div>
      </div>
    </div>
  );
}
