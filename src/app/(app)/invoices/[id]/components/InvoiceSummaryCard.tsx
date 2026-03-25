import { fmt, fmtDate } from "./helpers";
import type { Invoice } from "./types";

interface InvoiceSummaryCardProps {
  invoice: Invoice;
}

export default function InvoiceSummaryCard({ invoice }: InvoiceSummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Customer</p>
          <p className="font-medium text-stone-900">{invoice.customers?.full_name || "—"}</p>
          {invoice.customers?.email && (
            <p className="text-sm text-stone-500">{invoice.customers.email}</p>
          )}
          {(invoice.customers?.phone || invoice.customers?.mobile) && (
            <p className="text-sm text-stone-500">{invoice.customers.phone || invoice.customers.mobile}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Dates</p>
          <p className="text-sm text-stone-900">
            <span className="text-stone-500">Issued:</span> {fmtDate(invoice.invoice_date)}
          </p>
          <p className="text-sm text-stone-900 mt-0.5">
            <span className="text-stone-500">Due:</span>{" "}
            <span className={invoice.due_date && new Date(invoice.due_date) < new Date() && !["paid", "voided"].includes(invoice.status) ? "text-red-500 font-medium" : ""}>
              {fmtDate(invoice.due_date)}
            </span>
          </p>
          {invoice.paid_at && (
            <p className="text-sm text-amber-700 mt-0.5">
              <span className="text-stone-500">Paid:</span> {fmtDate(invoice.paid_at)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Amount Due</p>
          <p className="font-semibold text-2xl font-semibold text-stone-900">{fmt(invoice.amount_due)}</p>
          <p className="text-xs text-stone-400 mt-0.5">Total: {fmt(invoice.total)}</p>
          {invoice.amount_paid > 0 && (
            <p className="text-xs text-amber-700 mt-0.5">Paid: {fmt(invoice.amount_paid)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
