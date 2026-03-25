import { fmt } from "./helpers";
import type { Invoice, LineItem } from "./types";

interface LineItemsTableProps {
  invoice: Invoice;
  lineItems: LineItem[];
}

export default function LineItemsTable({ invoice, lineItems }: LineItemsTableProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-200">
        <h2 className="text-base font-semibold text-stone-900">Line Items</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-900/2">
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                Description
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                Qty
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                Unit Price
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                Disc
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-platinum">
            {lineItems.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-3 text-stone-900">{item.description}</td>
                <td className="px-4 py-3 text-right text-stone-900/70">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-stone-900/70">{fmt(item.unit_price)}</td>
                <td className="px-4 py-3 text-right text-stone-500 text-xs">
                  {item.discount_pct ? `${item.discount_pct}%` : "—"}
                </td>
                <td className="px-6 py-3 text-right font-medium text-stone-900">{fmt(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Totals */}
      <div className="px-6 py-4 border-t border-stone-200">
        <div className="ml-auto max-w-xs space-y-1.5">
          <div className="flex justify-between text-sm text-stone-900/70">
            <span>Subtotal</span>
            <span>{fmt(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-stone-900/70">
            <span>{invoice.tax_name} ({(invoice.tax_rate * 100).toFixed(0)}%{invoice.tax_inclusive ? " incl." : ""})</span>
            <span>{fmt(invoice.tax_amount)}</span>
          </div>
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-stone-900/70">
              <span>Discount</span>
              <span>−{fmt(invoice.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-stone-900 border-t border-stone-200 pt-2">
            <span className="font-semibold">Total</span>
            <span className="font-semibold">{fmt(invoice.total)}</span>
          </div>
          {invoice.amount_paid > 0 && (
            <div className="flex justify-between text-sm text-amber-700">
              <span>Amount Paid</span>
              <span>{fmt(invoice.amount_paid)}</span>
            </div>
          )}
          {invoice.amount_due > 0 && (
            <div className="flex justify-between font-bold text-stone-900 border-t border-stone-200 pt-2">
              <span>Amount Due</span>
              <span>{fmt(invoice.amount_due)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
