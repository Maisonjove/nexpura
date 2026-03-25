import type { Invoice } from "./types";

interface InvoiceNotesCardProps {
  invoice: Invoice;
}

export default function InvoiceNotesCard({ invoice }: InvoiceNotesCardProps) {
  if (!invoice.notes && !invoice.footer_text) return null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
      {invoice.notes && (
        <div className="mb-4">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Notes</p>
          <p className="text-sm text-stone-900/70 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}
      {invoice.footer_text && (
        <div>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Footer</p>
          <p className="text-sm text-stone-900/70 whitespace-pre-wrap">{invoice.footer_text}</p>
        </div>
      )}
    </div>
  );
}
