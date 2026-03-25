import { fmt, fmtDate } from "./helpers";
import type { Payment } from "./types";

interface PaymentHistoryProps {
  payments: Payment[];
}

export default function PaymentHistory({ payments }: PaymentHistoryProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-200">
        <h2 className="text-base font-semibold text-stone-900">Payment History</h2>
      </div>
      {payments.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-stone-400">No payments recorded yet</p>
        </div>
      ) : (
        <div className="divide-y divide-platinum">
          {payments.map((p) => (
            <div key={p.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-900">{p.payment_method}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {fmtDate(p.payment_date)}
                  {p.reference && <span className="ml-2">· Ref: {p.reference}</span>}
                </p>
                {p.notes && <p className="text-xs text-stone-400 mt-0.5">{p.notes}</p>}
              </div>
              <p className="text-base font-semibold text-amber-700">{fmt(p.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
