"use client";

import Link from "next/link";

export interface Sale {
  id: string;
  sale_number: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  payment_method: string | null;
  total: number;
  sale_date: string;
  created_at: string;
}

interface Props {
  sales: Sale[];
}

const STATUS_COLOURS: Record<string, string> = {
  quote: "bg-blue-50 text-blue-600",
  confirmed: "bg-purple-50 text-purple-600",
  paid: "bg-green-50 text-green-700",
  completed: "bg-sage/10 text-sage",
  refunded: "bg-red-50 text-red-600",
  layby: "bg-amber-50 text-amber-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
        STATUS_COLOURS[status] || "bg-forest/10 text-forest/60"
      }`}
    >
      {status}
    </span>
  );
}

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function SalesListClient({ sales }: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-fraunces text-2xl font-semibold text-forest">Sales</h1>
        <Link
          href="/sales/new"
          className="inline-flex items-center gap-2 bg-sage text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-sage/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Sale
        </Link>
      </div>

      {/* Table */}
      {sales.length === 0 ? (
        <div className="bg-white border border-platinum rounded-xl p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sage/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h3 className="font-fraunces text-lg font-semibold text-forest">No sales yet</h3>
          <p className="text-forest/50 mt-1 text-sm">Create your first sale to get started.</p>
          <Link
            href="/sales/new"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create first sale
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-platinum rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-platinum">
                  <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-5 py-3">
                    Sale #
                  </th>
                  <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                    Customer
                  </th>
                  <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                    Payment
                  </th>
                  <th className="text-right text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                    Total
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-platinum">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-ivory/60 transition-colors">
                    <td className="px-5 py-3 text-xs font-mono text-forest/60">
                      {sale.sale_number}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-forest">
                        {sale.customer_name || <span className="text-forest/30">Walk-in</span>}
                      </p>
                      {sale.customer_email && (
                        <p className="text-xs text-forest/40">{sale.customer_email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-forest/60">
                      {new Date(sale.sale_date || sale.created_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sale.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-forest/60 capitalize">
                      {sale.payment_method || <span className="text-forest/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-forest">
                      {fmtCurrency(sale.total)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/sales/${sale.id}`}
                        className="text-xs text-sage font-medium hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
