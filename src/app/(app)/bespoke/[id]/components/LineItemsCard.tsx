import { formatCurrency } from "@/lib/format-currency";
import type { Invoice, InventoryItem } from "./types";

interface LineItemsCardProps {
  invoice: Invoice | null;
  inventory: InventoryItem[];
  currency: string;
  readOnly: boolean;
  isPending: boolean;
  onRemoveLineItem: (id: string) => void;
  onShowAddManual: () => void;
  onShowAddStock: () => void;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

export default function LineItemsCard({
  invoice,
  inventory,
  currency,
  readOnly,
  isPending,
  onRemoveLineItem,
  onShowAddManual,
  onShowAddStock,
}: LineItemsCardProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Line Items</h2>
        {invoice && (() => {
          const label = {
            draft: "Draft",
            unpaid: "Sent",
            partial: "Partial",
            paid: "Paid",
            voided: "Voided",
            overdue: "Overdue"
          }[invoice.status] || invoice.status;
          return (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${invoice.status === "paid" ? "bg-stone-900 text-white" : invoice.status === "partial" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
              {label}
            </span>
          );
        })()}
      </div>

      {invoice && invoice.lineItems.length > 0 ? (
        <div className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-wider">
                <th className="text-left pb-2 font-medium">Description</th>
                <th className="text-right pb-2 font-medium w-12">Qty</th>
                <th className="text-right pb-2 font-medium w-20">Price</th>
                <th className="text-right pb-2 font-medium w-20">Total</th>
                {!readOnly && <th className="w-8 pb-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {invoice.lineItems.map(li => (
                <tr key={li.id}>
                  <td className="py-2.5 text-stone-800">{li.description}</td>
                  <td className="py-2.5 text-right text-stone-600">{li.quantity}</td>
                  <td className="py-2.5 text-right text-stone-600">{fmt(li.unit_price, currency)}</td>
                  <td className="py-2.5 text-right text-stone-900 font-medium">{fmt(li.total, currency)}</td>
                  {!readOnly && (
                    <td className="py-2.5 text-right">
                      <button onClick={() => onRemoveLineItem(li.id)} className="text-stone-300 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-stone-200">
                <td colSpan={readOnly ? 3 : 4} className="pt-2.5 text-xs text-stone-400">Subtotal</td>
                <td className="pt-2.5 text-right text-sm text-stone-700">{fmt(invoice.subtotal, currency)}</td>
              </tr>
              <tr>
                <td colSpan={readOnly ? 3 : 4} className="py-0.5 text-xs text-stone-400">GST ({Math.round((invoice.tax_rate ?? 0.1) * 100)}%)</td>
                <td className="text-right text-sm text-stone-600">{fmt(invoice.tax_amount, currency)}</td>
              </tr>
              <tr>
                <td colSpan={readOnly ? 3 : 4} className="py-1 text-sm font-semibold text-stone-900">Total</td>
                <td className="text-right text-sm font-semibold text-stone-900">{fmt(invoice.total, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm text-stone-400 mb-4">No line items yet.</p>
      )}

      {!readOnly && (
        <div className="flex gap-2">
          <button onClick={onShowAddManual} className="flex items-center gap-1.5 text-xs font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Manual Item
          </button>
          {inventory.length > 0 && (
            <button onClick={onShowAddStock} className="flex items-center gap-1.5 text-xs font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              Add Stock Item
            </button>
          )}
        </div>
      )}
    </div>
  );
}
