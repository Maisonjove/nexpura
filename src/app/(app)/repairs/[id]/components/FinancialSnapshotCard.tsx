"use client";

import { formatCurrency } from "@/lib/format-currency";
import type { Repair, Invoice, Payment } from "./types";

interface FinancialSnapshotCardProps {
  repair: Repair;
  invoice: Invoice | null;
  currency: string;
  balanceDue: number;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

export default function FinancialSnapshotCard({
  repair,
  invoice,
  currency,
  balanceDue,
}: FinancialSnapshotCardProps) {
  const isFullyPaid = invoice && invoice.amount_paid >= invoice.total && invoice.total > 0;
  const isPartialPaid = invoice && invoice.amount_paid > 0 && invoice.amount_paid < invoice.total;
  const isUnpaid = !invoice || invoice.amount_paid === 0;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Financial Snapshot</h2>
      
      {/* Large Balance Due */}
      <div className="mb-4">
        <p className="text-xs text-stone-500 mb-1">Balance Due</p>
        <p className={`text-3xl font-bold ${balanceDue > 0 ? "text-amber-700" : "text-emerald-700"}`}>
          {fmt(balanceDue, currency)}
        </p>
      </div>

      {/* Payment Status */}
      <div className="mb-4">
        {isFullyPaid && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Fully Paid
          </span>
        )}
        {isPartialPaid && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Balance Due
          </span>
        )}
        {isUnpaid && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            Unpaid
          </span>
        )}
      </div>

      {/* Quoted vs Invoice Comparison */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">Quoted</span>
          <span className="text-stone-700 font-medium">{fmt(repair.quoted_price, currency)}</span>
        </div>
        {invoice && (
          <div className="flex justify-between">
            <span className="text-stone-500">Invoice Total</span>
            <span className="text-stone-900 font-semibold">{fmt(invoice.total, currency)}</span>
          </div>
        )}
      </div>

      {/* Deposit Chip */}
      {repair.deposit_amount != null && repair.deposit_amount > 0 && (
        <div className="mb-4">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            repair.deposit_paid 
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            {repair.deposit_paid ? "✓ Deposit Paid" : "Deposit Pending"} ({fmt(repair.deposit_amount, currency)})
          </span>
        </div>
      )}

      {/* Payment History */}
      {invoice && invoice.payments.length > 0 && (
        <div className="border-t border-stone-100 pt-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Payments</p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {invoice.payments.map((p: Payment) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-700 font-medium capitalize">{p.payment_method.replace(/_/g, " ")}</span>
                  {p.payment_date && (
                    <span className="text-stone-400 ml-1.5">
                      {new Date(p.payment_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
                <span className="font-semibold text-stone-800">{fmt(p.amount, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
