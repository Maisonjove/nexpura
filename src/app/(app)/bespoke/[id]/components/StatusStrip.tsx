"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";
import type { BespokeJob, Invoice, Customer } from "./types";
import { BESPOKE_STAGES, STAGE_COLORS } from "./constants";

interface StatusStripProps {
  job: BespokeJob;
  customer: Customer | null;
  invoice: Invoice | null;
  currency: string;
  readOnly: boolean;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

function StatusChip({ invoice, job, currency }: { invoice: Invoice | null; job: BespokeJob; currency: string }) {
  if (!invoice) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">Unpaid</span>;
  }
  if (invoice.amount_paid >= invoice.total && invoice.total > 0) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-900 text-white">Fully Paid</span>;
  }
  if (invoice.amount_paid > 0 && invoice.amount_paid < invoice.total) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">Partially Paid ({fmt(invoice.amount_paid, currency)})</span>;
  }
  if (job.deposit_paid) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Deposit Paid</span>;
  }
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">Unpaid</span>;
}

export default function StatusStrip({
  job,
  customer,
  invoice,
  currency,
  readOnly,
}: StatusStripProps) {
  const sc = STAGE_COLORS[job.stage] ?? STAGE_COLORS.brief;
  const isTerminal = ["delivered", "cancelled"].includes(job.stage);
  const isOverdue = job.due_date && new Date(job.due_date) < new Date(new Date().toDateString()) && !isTerminal;
  const balanceDue = invoice
    ? Math.max(0, invoice.total - invoice.amount_paid)
    : (job.quoted_price ?? 0) - (job.deposit_paid ? (job.deposit_amount ?? 0) : 0);

  return (
    <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-base font-semibold text-stone-900">{job.job_number}</span>
        <span className="text-stone-300">·</span>
        <span className="text-sm text-stone-700 font-medium">{customer?.full_name ?? "—"}</span>
        <span className="text-stone-300">·</span>
        <span className="text-sm text-stone-600 truncate max-w-xs font-medium">{job.title}</span>
        <span className="text-stone-300">·</span>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          {BESPOKE_STAGES.find(s => s.key === job.stage)?.label ?? job.stage}
        </span>
        <StatusChip invoice={invoice} job={job} currency={currency} />
        {job.due_date && (
          <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : "text-stone-500"}`}>
            {isOverdue ? "⚠ Overdue · " : "Due: "}
            {new Date(job.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
        {!readOnly && (
          <Link href={`/bespoke/${job.id}/edit`} className="ml-auto text-xs text-stone-400 hover:text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg transition-colors">
            Edit
          </Link>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isOverdue && <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full font-medium">⚠ Overdue</span>}
        {!customer?.email && !customer?.mobile && <span className="text-xs bg-stone-50 text-stone-600 border border-stone-200 px-3 py-1 rounded-full">📵 No contact info</span>}
        {!invoice && !isTerminal && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full">📄 No invoice yet</span>}
        {job.stage === "ready" && <span className="text-xs bg-stone-100 text-stone-800 border border-stone-300 px-3 py-1 rounded-full font-semibold">✅ Ready for pickup</span>}
        {balanceDue > 0 && !isTerminal && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-medium">
            Balance due: {fmt(balanceDue, currency)}
          </span>
        )}
      </div>
    </div>
  );
}
