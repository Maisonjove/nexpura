"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useLocation } from "@/contexts/LocationContext";
import { getSales, SaleWithLocation } from "./sales-actions";
import { MapPin } from "lucide-react";

interface Props {
  initialSales: SaleWithLocation[];
}

const STATUS_COLOURS: Record<string, string> = {
  quote: "bg-stone-100 text-stone-700",
  confirmed: "bg-stone-100 text-stone-700",
  paid: "bg-green-50 text-green-700",
  completed: "bg-stone-100 text-amber-700",
  refunded: "bg-red-50 text-red-600",
  layby: "bg-amber-50 text-amber-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
        STATUS_COLOURS[status] || "bg-stone-900/10 text-stone-500"
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

export default function SalesListClient({ initialSales }: Props) {
  const { getFilterLocationIds, viewMode, currentLocationId, hasMultipleLocations } = useLocation();
  const [sales, setSales] = useState<SaleWithLocation[]>(initialSales);
  const [isPending, startTransition] = useTransition();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Determine if we should show the location column
  const showLocationColumn = hasMultipleLocations && (viewMode === "all" || !currentLocationId);

  // Refetch when location changes
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }

    const locationIds = getFilterLocationIds();
    
    startTransition(async () => {
      try {
        const newSales = await getSales(locationIds);
        setSales(newSales);
      } catch (error) {
        console.error("Failed to fetch sales:", error);
      }
    });
  }, [viewMode, currentLocationId, getFilterLocationIds, isInitialLoad]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">Sales</h1>
        <Link
          href="/sales/new"
          className="inline-flex items-center gap-2 bg-nexpura-charcoal text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-nexpura-charcoal-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Sale
        </Link>
      </div>

      {/* Loading state */}
      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700">
          Updating...
        </div>
      )}

      {/* Table */}
      {sales.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg font-semibold text-stone-900">No sales yet</h3>
          <p className="text-stone-500 mt-1 text-sm">Create your first sale to get started.</p>
          <Link
            href="/sales/new"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create first sale
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-5 py-3">
                    Sale #
                  </th>
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                    Customer
                  </th>
                  {showLocationColumn && (
                    <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                      Location
                    </th>
                  )}
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                    Payment
                  </th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                    Total
                  </th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">
                    Balance
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-platinum">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="px-5 py-3 text-xs font-mono text-stone-500">
                      {sale.sale_number}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-stone-900">
                        {sale.customer_name || <span className="text-stone-400">Walk-in</span>}
                      </p>
                      {sale.customer_email && (
                        <p className="text-xs text-stone-400">{sale.customer_email}</p>
                      )}
                    </td>
                    {showLocationColumn && (
                      <td className="px-4 py-3">
                        {sale.locationName ? (
                          <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                            <MapPin size={12} className="text-stone-400" />
                            {sale.locationName}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-300">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-stone-500">
                      {new Date(sale.sale_date || sale.created_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sale.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-500 capitalize">
                      {sale.payment_method || <span className="text-stone-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-stone-900">
                      {fmtCurrency(sale.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {sale.status === "layby" ? (
                        <span className="text-sm font-semibold text-amber-700">
                          {fmtCurrency(sale.total - (sale.amount_paid ?? 0))}
                        </span>
                      ) : (
                        <span className="text-stone-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sale.status === "layby" ? (
                        <Link
                          href={`/sales/${sale.id}`}
                          className="text-xs text-amber-600 font-medium hover:underline whitespace-nowrap"
                        >
                          Record Payment →
                        </Link>
                      ) : (
                        <Link
                          href={`/sales/${sale.id}`}
                          className="text-xs text-amber-700 font-medium hover:underline"
                        >
                          View →
                        </Link>
                      )}
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
