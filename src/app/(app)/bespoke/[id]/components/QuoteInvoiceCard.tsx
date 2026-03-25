import Link from "next/link";
import type { Invoice } from "./types";

interface QuoteInvoiceCardProps {
  invoice: Invoice | null;
  readOnly: boolean;
  isPending: boolean;
  onGenerateInvoice: () => void;
}

export default function QuoteInvoiceCard({
  invoice,
  readOnly,
  isPending,
  onGenerateInvoice,
}: QuoteInvoiceCardProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Quote / Invoice</h2>
      {invoice ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900">{invoice.invoice_number}</p>
            <p className="text-xs text-stone-400 mt-0.5 capitalize">{invoice.status}</p>
          </div>
          <Link href={`/invoices/${invoice.id}`} className="text-xs font-medium text-amber-700 hover:underline border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-lg">
            View Invoice →
          </Link>
        </div>
      ) : !readOnly ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-stone-400 flex-1">No invoice generated yet.</p>
          <button onClick={onGenerateInvoice} disabled={isPending} className="text-xs font-medium bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
            Generate Invoice
          </button>
        </div>
      ) : (
        <p className="text-sm text-stone-400">No invoice generated.</p>
      )}
    </div>
  );
}
