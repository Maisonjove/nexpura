"use client";

import { PAYMENT_METHODS } from "../constants";

interface RecordPaymentModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  formError: string | null;
  paymentAmount: string;
  setPaymentAmount: (v: string) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  paymentNotes: string;
  setPaymentNotes: (v: string) => void;
  currency: string;
}

export default function RecordPaymentModal({
  show,
  onClose,
  onSubmit,
  isPending,
  formError,
  paymentAmount,
  setPaymentAmount,
  paymentMethod,
  setPaymentMethod,
  paymentNotes,
  setPaymentNotes,
  currency,
}: RecordPaymentModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg text-stone-900 mb-4">Record Payment</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Amount ({currency}) *</label>
            <input 
              type="number" 
              value={paymentAmount} 
              onChange={e => setPaymentAmount(e.target.value)} 
              placeholder="0.00" 
              step="0.01" 
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Payment Method</label>
            <select 
              value={paymentMethod} 
              onChange={e => setPaymentMethod(e.target.value)} 
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Notes (optional)</label>
            <input 
              value={paymentNotes} 
              onChange={e => setPaymentNotes(e.target.value)} 
              placeholder="e.g. Deposit received" 
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze" 
            />
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
          <button onClick={onSubmit} disabled={isPending} className="flex-1 bg-nexpura-bronze text-white text-sm font-medium py-2.5 rounded-lg hover:bg-nexpura-bronze-hover disabled:opacity-50">
            {isPending ? "Recording…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
