import Image from "next/image";
import { fmt, fmtDate } from "./helpers";
import type { Invoice, LineItem, Payment, Tenant } from "./types";

interface PreviewViewProps {
  invoice: Invoice;
  lineItems: LineItem[];
  payments: Payment[];
  tenant: Tenant;
}

export default function PreviewView({ invoice, lineItems, payments, tenant }: PreviewViewProps) {
  const businessName = tenant?.business_name || tenant?.name || "Your Business";
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm">
      <div className="p-10 max-w-3xl mx-auto font-inter">
        {/* Top header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            {tenant?.logo_url ? (
              <Image src={tenant.logo_url} alt="Logo" width={200} height={56} className="h-14 object-contain mb-3" unoptimized />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-stone-900 flex items-center justify-center mb-3">
                <span className="text-white font-semibold text-xl font-bold">
                  {businessName[0].toUpperCase()}
                </span>
              </div>
            )}
            <p className="font-semibold text-stone-900 text-lg">{businessName}</p>
            {tenant?.abn && (
              <p className="text-sm text-stone-500 mt-0.5">ABN: {tenant.abn}</p>
            )}
            {(tenant?.address_line1 || tenant?.suburb) && (
              <p className="text-sm text-stone-500 mt-0.5">
                {[tenant.address_line1, tenant.suburb, tenant.state, tenant.postcode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {tenant?.phone && <p className="text-sm text-stone-500">{tenant.phone}</p>}
            {tenant?.email && <p className="text-sm text-stone-500">{tenant.email}</p>}
          </div>

          <div className="text-right">
            <p className="font-semibold text-4xl font-bold text-stone-900 tracking-tight">INVOICE</p>
            <p className="text-lg font-semibold text-stone-900/70 mt-1">{invoice.invoice_number}</p>
            <div className="mt-3 space-y-1 text-sm text-stone-500">
              <p><span className="font-medium text-stone-900/80">Issued:</span> {fmtDate(invoice.invoice_date)}</p>
              {invoice.due_date && (
                <p><span className="font-medium text-stone-900/80">Due:</span> {fmtDate(invoice.due_date)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">Bill To</p>
          <div className="bg-stone-900/3 rounded-xl p-4 border border-stone-200">
            <p className="font-semibold text-stone-900 text-base">{invoice.customers?.full_name || "—"}</p>
            {invoice.customers?.email && (
              <p className="text-sm text-stone-500 mt-0.5">{invoice.customers.email}</p>
            )}
            {(invoice.customers?.phone || invoice.customers?.mobile) && (
              <p className="text-sm text-stone-500">{invoice.customers.phone || invoice.customers.mobile}</p>
            )}
            {invoice.customers?.address_line1 && (
              <p className="text-sm text-stone-500 mt-0.5">
                {[
                  invoice.customers.address_line1,
                  invoice.customers.suburb,
                  invoice.customers.state,
                  invoice.customers.postcode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-stone-900">
                <th className="text-left pb-3 font-semibold text-stone-900 text-xs uppercase tracking-wider">
                  Description
                </th>
                <th className="text-right pb-3 pr-4 font-semibold text-stone-900 text-xs uppercase tracking-wider w-16">
                  Qty
                </th>
                <th className="text-right pb-3 pr-4 font-semibold text-stone-900 text-xs uppercase tracking-wider w-28">
                  Unit Price
                </th>
                <th className="text-right pb-3 font-semibold text-stone-900 text-xs uppercase tracking-wider w-28">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? "" : "bg-stone-900/2"}>
                  <td className="py-3 pr-4 text-stone-900/80">
                    {item.description}
                    {item.discount_pct > 0 && (
                      <span className="ml-2 text-xs text-stone-400">({item.discount_pct}% off)</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right text-stone-500">{item.quantity}</td>
                  <td className="py-3 pr-4 text-right text-stone-500">{fmt(item.unit_price)}</td>
                  <td className="py-3 text-right font-medium text-stone-900">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm text-stone-500">
              <span>Subtotal</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-500">
              <span>{invoice.tax_name} ({(invoice.tax_rate * 100).toFixed(0)}%{invoice.tax_inclusive ? " incl." : ""})</span>
              <span>{fmt(invoice.tax_amount)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-stone-500">
                <span>Discount</span>
                <span>−{fmt(invoice.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-stone-900 border-t-2 border-stone-900 pt-2">
              <span>Total</span>
              <span>{fmt(invoice.total)}</span>
            </div>
            {totalPaid > 0 && (
              <>
                <div className="flex justify-between text-sm text-amber-700">
                  <span>Amount Paid</span>
                  <span>{fmt(totalPaid)}</span>
                </div>
                <div className="flex justify-between font-bold text-stone-900 border-t border-stone-200 pt-2 text-lg">
                  <span>Amount Due</span>
                  <span>{fmt(invoice.amount_due)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        {(invoice.footer_text || invoice.notes) && (
          <div className="border-t border-stone-200 pt-6 space-y-4">
            {invoice.notes && (
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">Notes</p>
                <p className="text-sm text-stone-500 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
            {invoice.footer_text && (
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">Payment Instructions</p>
                <p className="text-sm text-stone-500 whitespace-pre-wrap">{invoice.footer_text}</p>
              </div>
            )}
          </div>
        )}

        {/* Pay Now button */}
        {invoice.stripe_payment_link && !["paid", "voided"].includes(invoice.status) && (
          <div className="mt-6 flex justify-center">
            <a
              href={invoice.stripe_payment_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Pay Now — {invoice.amount_due.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
            </a>
          </div>
        )}

        {/* Thank you */}
        <div className="mt-8 pt-6 border-t border-stone-200 text-center">
          <p className="font-semibold text-sm text-stone-400 italic">Thank you for your business</p>
        </div>
      </div>
    </div>
  );
}
