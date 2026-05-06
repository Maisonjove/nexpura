"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format-currency";
import type { Repair, Invoice, Customer } from "./types";
import { REPAIR_STAGES, STAGE_COLORS } from "./constants";
import { generateRepairInvoice } from "../actions";

interface StatusStripProps {
  repair: Repair;
  customer: Customer | null;
  invoice: Invoice | null;
  currency: string;
  readOnly: boolean;
  tenantId: string;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

function StatusChip({ invoice, repair, currency }: { invoice: Invoice | null; repair: Repair; currency: string }) {
  if (!invoice) {
    return <span className="nx-badge-neutral">Unpaid</span>;
  }
  if (invoice.amount_paid >= invoice.total && invoice.total > 0) {
    return <span className="nx-badge-success">Fully Paid</span>;
  }
  if (repair.deposit_paid && invoice.amount_paid > 0 && invoice.amount_paid < invoice.total) {
    return <span className="nx-badge-warning">Partially Paid ({fmt(invoice.amount_paid, currency)})</span>;
  }
  if (repair.deposit_paid && invoice.amount_paid === 0) {
    return <span className="nx-badge-warning">Deposit Paid</span>;
  }
  return <span className="nx-badge-neutral">Unpaid</span>;
}

export default function StatusStrip({
  repair,
  customer,
  invoice,
  currency,
  readOnly,
  tenantId,
}: StatusStripProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const sc = STAGE_COLORS[repair.stage] ?? STAGE_COLORS.intake;
  const isTerminal = ["collected", "cancelled"].includes(repair.stage);
  const isOverdue = repair.due_date && new Date(repair.due_date) < new Date(new Date().toDateString()) && !isTerminal;
  const balanceDue = invoice
    ? Math.max(0, invoice.total - invoice.amount_paid)
    : (repair.quoted_price ?? 0) - (repair.deposit_paid ? (repair.deposit_amount ?? 0) : 0);

  const handleCreateInvoice = () => {
    setInvoiceError(null);
    startTransition(async () => {
      const result = await generateRepairInvoice(repair.id, tenantId);
      if (result.error) {
        setInvoiceError(result.error);
        return;
      }
      if (result.invoiceId) {
        router.push(`/invoices/${result.invoiceId}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl px-5 py-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-base font-semibold text-stone-900">{repair.repair_number}</span>
        <span className="text-stone-300">·</span>
        <span className="text-sm text-stone-700 font-medium">{customer?.full_name ?? "—"}</span>
        <span className="text-stone-300">·</span>
        <span className="text-sm text-stone-500 truncate max-w-xs">{repair.item_description || repair.item_type}</span>
        <span className="text-stone-300">·</span>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          {REPAIR_STAGES.find(s => s.key === repair.stage)?.label ?? repair.stage}
        </span>
        <StatusChip invoice={invoice} repair={repair} currency={currency} />
        {repair.due_date && (
          <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : "text-stone-500"}`}>
            {isOverdue ? "⚠ Overdue · " : "Due: "}
            {new Date(repair.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
        {!readOnly && (
          <Link href={`/repairs/${repair.id}/edit`} className="ml-auto text-xs text-stone-400 hover:text-stone-700 border border-stone-200 px-3 py-1.5 rounded-md hover:border-stone-300 transition-colors duration-200">
            Edit
          </Link>
        )}
      </div>

      {/* Alert banners */}
      <div className="mt-3 flex flex-wrap gap-2">
        {isOverdue && (
          <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full font-medium">⚠ Overdue</span>
        )}
        {!customer?.email && !customer?.mobile && (
          <span className="text-xs bg-stone-50 text-stone-600 border border-stone-200 px-3 py-1 rounded-full">📵 No contact info</span>
        )}
        {!invoice && !isTerminal && (
          readOnly ? (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full">📄 No invoice yet</span>
          ) : (
            <button
              type="button"
              onClick={handleCreateInvoice}
              disabled={isPending}
              className="text-xs bg-nexpura-bronze hover:bg-nexpura-bronze-hover text-white border border-[#7A6347] px-3 py-1 rounded-full font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Generate a draft invoice for this repair"
            >
              {isPending ? "Creating invoice…" : "📄 Create Invoice"}
            </button>
          )
        )}
        {invoiceError && (
          <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full">
            {invoiceError}
          </span>
        )}
        {repair.stage === "ready" && (
          <span className="text-xs bg-stone-100 text-stone-800 border border-stone-300 px-3 py-1 rounded-full font-semibold">✅ Ready for pickup</span>
        )}
        {balanceDue > 0 && !isTerminal && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-medium">
            Balance due: {fmt(balanceDue, currency)}
          </span>
        )}
      </div>
    </div>
  );
}
