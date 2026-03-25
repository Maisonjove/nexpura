"use client";

import { formatCurrency } from "@/lib/format-currency";
import type { Invoice, LineItem } from "./types";

interface LineItemsCardProps {
  invoice: Invoice | null;
  currency: string;
  onAddManual: () => void;
  onAddStock: () => void;
  onRemoveItem: (id: string) => void;
  readOnly: boolean;
  isTerminal: boolean;
  isPending: boolean;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

export default function LineItemsCard({
  invoice,
  currency,
  onAddManual,
  onAddStock,
  onRemoveItem,
  readOnly,
  isTerminal,
  isPending,
}: LineItemsCardProps) {
  const lineItems = invoice?.lineItems ?? [];

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          Line Items
        </h2>
        {!readOnly && !isTerminal && (
          <div className="flex gap-2">
            <button
              onClick={onAddManual}
              className="text-xs text-amber-700 hover:underline font-medium"
            >
              + Add manual
            </button>
            <button
              onClick={onAddStock}
              className="text-xs text-stone-500 hover:underline font-medium"
            >
              + From stock
            </button>
          </div>
        )}
      </div>
      {lineItems.length === 0 ? (
        <p className="text-sm text-stone-400 italic">No line items yet</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {lineItems.map((li: LineItem) => {
            return (
              <div key={li.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-stone-900">{li.description}</p>
                  <p className="text-xs text-stone-400">
                    {li.quantity} × {fmt(li.unit_price, currency)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-stone-900">
                    {fmt(li.total, currency)}
                  </span>
                  {!readOnly && !isTerminal && (
                    <button
                      onClick={() => onRemoveItem(li.id)}
                      disabled={isPending}
                      className="text-stone-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Remove"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
