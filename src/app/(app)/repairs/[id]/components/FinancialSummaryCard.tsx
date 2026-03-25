"use client";

import { formatCurrency } from "@/lib/format-currency";
import type { Repair, Invoice, Payment } from "./types";

interface FinancialSummaryCardProps {
  repair: Repair;
  invoice: Invoice | null;
  currency: string;
  balanceDue: number;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

export default function FinancialSummaryCard({
  repair,
  invoice,
  currency,
  balanceDue,
}: FinancialSummaryCardProps) {
  const isTerminal = ["collected", "cancelled"].includes(repair.stage);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Financial Summary</h2>
        {balanceDue === 0 && invoice && invoice.amount_paid > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Paid</span>
        )}
        {balanceDue > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Balance Due</span>
        )}
      </div>
      <div className="space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">Quoted</span>
          <span className="text-stone-700">{fmt(repair.quoted_price, currency)}</span>
        </div>
        {invoice && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Subtotal</span>
              <span className="text-stone-700">{fmt(invoice.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">GST</span>
              <span className="text-stone-700">{fmt(invoice.tax_amount, currency)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-stone-100 pt-2">
              <span className="text-stone-900">Total</span>
              <span className="text-stone-900">{fmt(invoice.total, currency)}</span>
            </div>
          </>
        )}
        {repair.deposit_amount != null && (
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Deposit {repair.deposit_paid ? "(paid)" : "(pending)"}</span>
            <span className={repair.deposit_paid ? "text-stone-700" : "text-stone-400"}>{fmt(repair.deposit_amount, currency)}</span>
          </div>
        )}
        {invoice && (
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Total Paid</span>
            <span className="text-stone-700">{fmt(invoice.amount_paid, currency)}</span>
          </div>
        )}
        {balanceDue > 0 ? (
          <div className="flex justify-between text-sm font-bold border-t border-amber-200 pt-2 mt-2">
            <span className="text-amber-700">Balance Due</span>
            <span className="text-amber-700">{fmt(balanceDue, currency)}</span>
          </div>
        ) : invoice && invoice.amount_paid > 0 ? (
          <div className="flex justify-between text-sm font-semibold border-t border-stone-100 pt-2">
            <span className="text-amber-700">✓ Fully Paid</span>
            <span className="text-amber-700">{fmt(invoice.amount_paid, currency)}</span>
          </div>
        ) : null}
      </div>

      {/* Release nudge when balance clear */}
      {balanceDue === 0 && !isTerminal && (
        <div className="mt-3 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-600 flex items-center gap-2">
          <span className="text-green-600">✓</span> Balance clear — ready to release
        </div>
      )}

      {/* Payment history */}
      {invoice && invoice.payments.length > 0 && (
        <div className="mt-4 border-t border-stone-100 pt-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Payment History</p>
          <div className="space-y-2">
            {invoice.payments.map((p: Payment) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-700 font-medium capitalize">{p.payment_method.replace(/_/g, " ")}</span>
                  {p.payment_date && <span className="text-stone-400 ml-1.5">{new Date(p.payment_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                  {p.notes && <span className="text-stone-400 block">{p.notes}</span>}
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
