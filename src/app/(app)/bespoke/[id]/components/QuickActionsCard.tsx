import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";
import type { BespokeJob, Invoice } from "./types";

interface QuickActionsCardProps {
  job: BespokeJob;
  invoice: Invoice | null;
  currency: string;
  isPending: boolean;
  onTakeDeposit: (amount: number) => void;
  onRecordPayment: () => void;
  onMarkFullyPaid: () => void;
  onGenerateInvoice: () => void;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

export default function QuickActionsCard({
  job,
  invoice,
  currency,
  isPending,
  onTakeDeposit,
  onRecordPayment,
  onMarkFullyPaid,
  onGenerateInvoice,
}: QuickActionsCardProps) {
  const balanceDue = invoice
    ? Math.max(0, invoice.total - invoice.amount_paid)
    : (job.quoted_price ?? 0) - (job.deposit_paid ? (job.deposit_amount ?? 0) : 0);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Quick Actions</h2>
      <div className="space-y-2">
        {job.deposit_amount && !job.deposit_paid && (
          <button onClick={() => onTakeDeposit(job.deposit_amount ?? 0)} className="w-full text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2.5 rounded-lg hover:bg-amber-100 transition-colors text-left">
            💰 Take Deposit ({fmt(job.deposit_amount, currency)})
          </button>
        )}
        <button onClick={onRecordPayment} className="w-full text-sm font-medium bg-stone-50 text-stone-700 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-100 transition-colors text-left">
          📥 Record Payment
        </button>
        {balanceDue > 0 && invoice && (
          <button onClick={onMarkFullyPaid} disabled={isPending} className="w-full text-sm font-medium bg-stone-900 text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition-colors text-left disabled:opacity-50">
            ✓ Mark Fully Paid ({fmt(balanceDue, currency)})
          </button>
        )}
        {invoice ? (
          <Link href={`/invoices/${invoice.id}`} className="block w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors">
            📄 View Invoice
          </Link>
        ) : (
          <button onClick={onGenerateInvoice} disabled={isPending} className="w-full text-sm font-medium bg-amber-600 text-white px-4 py-2.5 rounded-lg hover:bg-amber-700 transition-colors text-left disabled:opacity-50">
            📄 Generate Invoice
          </button>
        )}
      </div>
    </div>
  );
}
