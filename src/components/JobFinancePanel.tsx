"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-currency";

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  note?: string | null;
  paid_at: string;
}

interface FinanceProps {
  jobId: string;
  jobType: "repair" | "bespoke";
  customerName: string | null;
  customerId: string | null;
  customerEmail: string | null;
  quotedPrice: number | null;
  depositAmount: number | null;
  depositPaid: boolean;
  finalPrice: number | null;
  invoiceId: string | null;
  status: string;
  currency?: string;
  payments?: PaymentRecord[];
  readOnly?: boolean;
}

export function JobFinancePanel({
  jobId,
  jobType,
  customerName,
  customerId,
  customerEmail,
  quotedPrice,
  depositAmount,
  depositPaid,
  finalPrice,
  invoiceId,
  status,
  currency = "AUD",
  payments,
  readOnly = false,
}: FinanceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = finalPrice || quotedPrice || 0;
  const depositPaidAmount = depositPaid ? (depositAmount || 0) : 0;
  const balanceRemaining = total - depositPaidAmount;

  async function handleCreateInvoice() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/create-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, jobType }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else if (data.invoiceId) {
          router.push(`/invoices/${data.invoiceId}`);
        } else {
          router.refresh();
        }
      } catch {
        setError("Failed to create invoice");
      }
    });
  }

  async function handleMarkDepositPaid() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/mark-deposit-paid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, jobType }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          router.refresh();
        }
      } catch {
        setError("Failed to update deposit status");
      }
    });
  }

  return (
    <Card className="overflow-hidden border-stone-200 shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
        <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Financials</h3>
        {invoiceId ? (
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-700/10 px-2 py-0.5 rounded-full">
            Invoiced
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
            No Invoice
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Total Job Value — large and prominent */}
        <div className="bg-stone-50 rounded-lg p-4 border border-stone-200">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Total Job Value</p>
          <p className="text-3xl font-bold text-stone-900">
            {total > 0 ? formatCurrency(total, currency) : <span className="text-stone-300">—</span>}
          </p>
          {finalPrice && quotedPrice && finalPrice !== quotedPrice && (
            <p className="text-xs text-stone-400 mt-1">
              Quoted: {formatCurrency(quotedPrice, currency)} · Final: {formatCurrency(finalPrice, currency)}
            </p>
          )}
        </div>

        {/* Deposit */}
        {depositAmount && depositAmount > 0 ? (
          <div className={`rounded-lg p-4 border ${depositPaid ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Deposit</p>
              {depositPaid ? (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">✓ Paid</span>
              ) : (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Unpaid</span>
              )}
            </div>
            <p className="text-xl font-bold text-stone-800">{formatCurrency(depositAmount, currency)}</p>
            {!depositPaid && !readOnly && (
              <button
                onClick={handleMarkDepositPaid}
                disabled={isPending}
                className="mt-2 w-full text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md py-1.5 transition-colors disabled:opacity-50"
              >
                {isPending ? "Updating…" : "Mark Deposit as Paid"}
              </button>
            )}
          </div>
        ) : null}

        {/* Balance Remaining — highlighted */}
        <div className={`rounded-lg p-4 border ${
          balanceRemaining <= 0
            ? "bg-emerald-50 border-emerald-200"
            : "bg-red-50 border-red-200"
        }`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">Balance Remaining</p>
          <p className={`text-2xl font-bold ${balanceRemaining <= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {balanceRemaining <= 0 ? "Paid in Full" : formatCurrency(balanceRemaining, currency)}
          </p>
        </div>

        {/* Invoice CTA */}
        <div className="pt-2 space-y-2">
          {invoiceId ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full text-xs border-stone-200 font-semibold"
              >
                <Link href={`/invoices/${invoiceId}`}>View Invoice</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full text-xs border-stone-200"
              >
                <a href={`/api/invoice/${invoiceId}/pdf`} target="_blank" rel="noopener noreferrer">
                  Print PDF
                </a>
              </Button>
            </div>
          ) : !readOnly ? (
            <Button
              onClick={handleCreateInvoice}
              disabled={isPending || !total}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white text-sm font-bold h-10 shadow-sm"
            >
              {isPending ? "Generating…" : "Generate Invoice"}
            </Button>
          ) : null}

          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="w-full text-xs text-stone-400 hover:text-stone-900"
            >
              <Link href={`/invoices/new?${jobType}_id=${jobId}${customerId ? `&customer_id=${customerId}` : ""}`}>
                Manual Invoice
              </Link>
            </Button>
          )}
        </div>

        {/* Payment History */}
        {payments && payments.length > 0 && (
          <div className="pt-2 border-t border-stone-100">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">Payment History</p>
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-stone-500 capitalize truncate">
                      {p.method.replace(/_/g, " ")}
                      {p.note && <span className="text-stone-400 ml-1">· {p.note}</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="font-semibold text-stone-800">{formatCurrency(p.amount, currency)}</span>
                    <span className="text-stone-300">
                      {new Date(p.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-5 pb-4">
          <p className="text-[11px] text-red-500 text-center font-medium bg-red-50 rounded px-3 py-2">{error}</p>
        </div>
      )}
    </Card>
  );
}
