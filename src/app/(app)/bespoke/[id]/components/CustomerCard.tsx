import Link from "next/link";
import type { Customer } from "./types";

interface CustomerCardProps {
  customer: Customer | null;
}

export default function CustomerCard({ customer }: CustomerCardProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Customer</h2>
      {customer ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-stone-900">{customer.full_name}</p>
            {customer.email && <p className="text-sm text-stone-500 mt-0.5">{customer.email}</p>}
            {customer.mobile && <p className="text-sm text-stone-500">{customer.mobile}</p>}
          </div>
          <Link href={`/customers/${customer.id}`} className="text-xs text-amber-700 hover:underline font-medium shrink-0">View Customer →</Link>
        </div>
      ) : (
        <p className="text-sm text-stone-400">No customer linked</p>
      )}
    </div>
  );
}
