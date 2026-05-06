"use client";

import { formatCurrency } from "@/lib/format-currency";
import type { Repair, Invoice, Payment } from "./types";

interface FinancialSummaryProps {
  repair: Repair;
  invoice: Invoice | null;
  currency: string;
  balanceDue: number;
  onRecordPayment: () => void;
  onGenerateInvoice: () => void;
  isPending: boolean;
  readOnly: boolean;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

export default function FinancialSummary({
  repair,
  invoice,
  currency,
  balanceDue,
  onRecordPayment,
  onGenerateInvoice,
  isPending,
  readOnly,
}: FinancialSummaryProps) {
  const isTerminal = repair.stage === "collected";

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
      <h2 className="text-[0.75rem] font-semibold text-stone-400 uppercase tracking-[0.15em] mb-4">
        Financial
      </h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">Quoted</span>
          <span className="font-medium text-stone-900">
            {fmt(repair.quoted_price, currency)}
          </span>
        </div>
        {repair.final_price != null && repair.final_price !== repair.quoted_price && (
          <div className="flex justify-between">
            <span className="text-stone-500">Final</span>
            <span className="font-medium text-stone-900">
              {fmt(repair.final_price, currency)}
            </span>
          </div>
        )}
        {repair.deposit_amount && (
          <div className="flex justify-between">
            <span className="text-stone-500">Deposit</span>
            <span
              className={`font-medium ${
                repair.deposit_paid ? "text-green-700" : "text-amber-700"
              }`}
            >
              {fmt(repair.deposit_amount, currency)}
              {repair.deposit_paid && (
                <span className="ml-1 text-xs text-green-600">✓</span>
              )}
            </span>
          </div>
        )}
        {invoice && (
          <>
            <hr className="border-stone-200 my-2" />
            <div className="flex justify-between">
              <span className="text-stone-500">Subtotal</span>
              <span className="font-medium text-stone-900">
                {fmt(invoice.subtotal, currency)}
              </span>
            </div>
            {invoice.tax_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">
                  Tax ({(invoice.tax_rate * 100).toFixed(0)}%)
                </span>
                <span className="font-medium text-stone-900">
                  {fmt(invoice.tax_amount, currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-stone-200">
              <span className="text-stone-900 font-semibold">Total</span>
              <span className="font-bold text-stone-900">
                {fmt(invoice.total, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Paid</span>
              <span className="font-medium text-green-700">
                {fmt(invoice.amount_paid, currency)}
              </span>
            </div>
            {balanceDue > 0 && (
              <div className="flex justify-between text-amber-700">
                <span className="font-medium">Balance Due</span>
                <span className="font-bold">{fmt(balanceDue, currency)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Buttons */}
      {!readOnly && !isTerminal && (
        <div className="mt-4 space-y-2">
          {invoice ? (
            balanceDue > 0 && (
              <button
                onClick={onRecordPayment}
                className="w-full nx-btn-primary cursor-pointer"
              >
                Record Payment
              </button>
            )
          ) : (
            <button
              onClick={onGenerateInvoice}
              disabled={isPending}
              className="w-full nx-btn-primary cursor-pointer disabled:opacity-50"
            >
              Generate Invoice
            </button>
          )}
        </div>
      )}

      {/* Release nudge when balance clear */}
      {balanceDue === 0 && invoice && repair.stage === "ready" && !isTerminal && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700 font-medium">
            ✅ Fully paid — ready for customer pickup
          </p>
        </div>
      )}

      {/* Payment history */}
      {invoice && invoice.payments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200">
          <p className="text-[0.75rem] font-semibold text-stone-400 uppercase tracking-[0.15em] mb-2">
            Payments
          </p>
          <div className="space-y-1.5">
            {invoice.payments.map((p: Payment) => (
              <div key={p.id} className="flex justify-between text-xs">
                <span className="text-stone-500 capitalize">
                  {p.payment_method.replace("_", " ")}
                </span>
                <span className="text-stone-700 font-medium">
                  {fmt(p.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
