"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}: FinanceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = finalPrice || quotedPrice || 0;
  const balanceRemaining = depositPaid ? total - (depositAmount || 0) : total;

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
        } else {
          router.refresh();
        }
      } catch (err) {
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
      } catch (err) {
        setError("Failed to update deposit status");
      }
    });
  }

  return (
    <Card className="p-5 space-y-4 border-stone-200">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">
          Financials
        </h3>
        {invoiceId ? (
          <Badge variant="outline" className="text-[#8B7355] border-[#8B7355]/30 bg-[#8B7355]/5">
            Invoiced
          </Badge>
        ) : (
          <Badge variant="outline" className="text-stone-400">
            Pending Invoice
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">Quoted Price</span>
          <span className="font-medium text-stone-900">
            {quotedPrice ? `£${quotedPrice.toFixed(2)}` : "—"}
          </span>
        </div>

        {depositAmount && depositAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Deposit Amount</span>
            <div className="text-right">
              <div className="font-medium text-stone-900">
                £{depositAmount.toFixed(2)}
              </div>
              <button
                onClick={handleMarkDepositPaid}
                disabled={depositPaid || isPending}
                className={`text-[10px] uppercase font-bold tracking-tight ${
                  depositPaid ? "text-[#8B7355]" : "text-amber-600 hover:underline"
                }`}
              >
                {depositPaid ? "✓ Paid" : "Mark as Paid"}
              </button>
            </div>
          </div>
        )}

        {finalPrice && finalPrice !== quotedPrice && (
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Final Price</span>
            <span className="font-medium text-stone-900">
              £{finalPrice.toFixed(2)}
            </span>
          </div>
        )}

        <div className="pt-2 border-t border-stone-100 flex justify-between items-end">
          <span className="text-xs font-bold text-stone-400 uppercase">
            Balance Remaining
          </span>
          <span className={`text-lg font-bold ${balanceRemaining <= 0 ? "text-[#8B7355]" : "text-stone-900"}`}>
            £{balanceRemaining.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="pt-2 space-y-2">
        {invoiceId ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full text-xs border-stone-200"
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
        ) : (
          <Button
            onClick={handleCreateInvoice}
            disabled={isPending || !total}
            className="w-full bg-[#8B7355] hover:bg-[#7A6347] text-white text-xs font-semibold h-9"
          >
            {isPending ? "Generating..." : "Generate Linked Invoice"}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          asChild
          className="w-full text-xs text-stone-500 hover:text-stone-900"
        >
          <Link href={`/invoices/new?${jobType}_id=${jobId}${customerId ? `&customer_id=${customerId}` : ""}`}>
            Manual Invoice
          </Link>
        </Button>
      </div>

      {error && (
        <p className="text-[11px] text-red-500 text-center font-medium">{error}</p>
      )}
    </Card>
  );
}
