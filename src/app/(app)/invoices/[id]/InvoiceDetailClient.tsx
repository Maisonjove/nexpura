"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { recordPayment, markAsSent, voidInvoice } from "../actions";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600" },
  sent: { label: "Sent", className: "bg-blue-50 text-blue-600" },
  partially_paid: { label: "Partially Paid", className: "bg-amber-50 text-amber-600" },
  paid: { label: "Paid", className: "bg-sage/10 text-sage" },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-600" },
  voided: { label: "Voided", className: "bg-gray-100 text-gray-400" },
};

const PAYMENT_METHODS = [
  "Cash",
  "Card (EFTPOS)",
  "Bank Transfer",
  "Afterpay",
  "Zip",
  "Cheque",
  "Other",
];

function fmt(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00").toLocaleDateString(
    "en-AU",
    { day: "2-digit", month: "short", year: "numeric" }
  );
}

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
} | null;

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  total: number;
  sort_order: number;
};

type Payment = {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

type Tenant = {
  name: string | null;
  business_name: string | null;
  abn: string | null;
  logo_url: string | null;
  bank_name: string | null;
  bank_bsb: string | null;
  bank_account: string | null;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
} | null;

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string | null;
  paid_at: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  tax_name: string;
  tax_rate: number;
  tax_inclusive: boolean;
  notes: string | null;
  footer_text: string | null;
  reference_type: string | null;
  created_at: string;
  customers: Customer;
};

interface Props {
  invoice: Invoice;
  lineItems: LineItem[];
  payments: Payment[];
  tenant: Tenant;
}

export default function InvoiceDetailClient({
  invoice,
  lineItems,
  payments,
  tenant,
}: Props) {
  const [view, setView] = useState<"manage" | "preview">("manage");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Payment form state
  const [payAmount, setPayAmount] = useState(String(invoice.amount_due || 0));
  const [payMethod, setPayMethod] = useState("Cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const badge = STATUS_BADGE[invoice.status] ?? STATUS_BADGE.draft;
  const canEdit = invoice.status === "draft";
  const canVoid = !["paid", "voided"].includes(invoice.status);
  const canMarkSent = invoice.status === "draft";
  const canRecordPayment = !["paid", "voided"].includes(invoice.status);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function handleMarkSent() {
    startTransition(async () => {
      try {
        const result = await markAsSent(invoice.id);
        if (result?.customerEmail) {
          showToast(`Invoice sent to ${result.customerEmail}`);
        } else {
          showToast("Invoice marked as sent");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  }

  function handleVoid() {
    startTransition(async () => {
      try {
        await voidInvoice(invoice.id);
        setShowVoidConfirm(false);
        showToast("Invoice voided");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
        setShowVoidConfirm(false);
      }
    });
  }

  function handleRecordPayment() {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await recordPayment(invoice.id, amt, payMethod, payDate, payRef || null, payNotes || null);
        setShowPaymentModal(false);
        showToast("Payment recorded successfully");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error recording payment");
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-forest text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-right">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/invoices" className="text-sm text-forest/50 hover:text-forest transition-colors">
            ← Invoices
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-fraunces text-2xl font-semibold text-forest">
              {invoice.invoice_number}
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-sm text-forest/50 mt-0.5">
            {invoice.customers?.full_name || "No customer"} · Issued {fmtDate(invoice.invoice_date)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* View toggle */}
          <div className="flex items-center bg-platinum/50 rounded-lg p-0.5">
            <button
              onClick={() => setView("manage")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "manage"
                  ? "bg-white text-forest shadow-sm"
                  : "text-forest/50 hover:text-forest"
              }`}
            >
              Manage
            </button>
            <button
              onClick={() => setView("preview")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "preview"
                  ? "bg-white text-forest shadow-sm"
                  : "text-forest/50 hover:text-forest"
              }`}
            >
              Preview
            </button>
          </div>

          {canEdit && (
            <Link
              href={`/invoices/${invoice.id}/edit`}
              className="px-3 py-1.5 text-xs border border-forest text-forest rounded-lg hover:bg-forest/5 transition-colors"
            >
              Edit
            </Link>
          )}
          {canMarkSent && (
            <button
              disabled={isPending}
              onClick={handleMarkSent}
              className="px-3 py-1.5 text-xs border border-forest text-forest rounded-lg hover:bg-forest/5 transition-colors disabled:opacity-50"
            >
              Mark as Sent
            </button>
          )}
          {canRecordPayment && (
            <button
              onClick={() => {
                setPayAmount(String(invoice.amount_due));
                setShowPaymentModal(true);
              }}
              className="px-3 py-1.5 text-xs bg-sage text-white rounded-lg hover:bg-sage/90 transition-colors"
            >
              Record Payment
            </button>
          )}
          <a
            href={`/api/invoice/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs border border-platinum text-forest/60 rounded-lg hover:border-sage/40 hover:text-forest transition-colors inline-flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </a>
          {canVoid && (
            <button
              onClick={() => setShowVoidConfirm(true)}
              className="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
            >
              Void
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {view === "manage" ? (
        <ManagementView
          invoice={invoice}
          lineItems={lineItems}
          payments={payments}
        />
      ) : (
        <PreviewView
          invoice={invoice}
          lineItems={lineItems}
          payments={payments}
          tenant={tenant}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-platinum">
              <h2 className="font-fraunces text-lg font-semibold text-forest">Record Payment</h2>
              <p className="text-sm text-forest/50 mt-0.5">Amount due: {fmt(invoice.amount_due)}</p>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-forest/60 mb-1.5">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-forest/50 text-sm">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full pl-6 pr-3 py-2 border border-platinum rounded-lg text-sm text-forest focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-forest/60 mb-1.5">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-platinum rounded-lg text-sm text-forest focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-forest/60 mb-1.5">Payment Date</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 border border-platinum rounded-lg text-sm text-forest focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-forest/60 mb-1.5">Reference</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Transaction ID, receipt number…"
                  className="w-full px-3 py-2 border border-platinum rounded-lg text-sm text-forest placeholder-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-forest/60 mb-1.5">Notes</label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes…"
                  className="w-full px-3 py-2 border border-platinum rounded-lg text-sm text-forest placeholder-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-platinum flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setError(null);
                }}
                className="px-4 py-2 text-sm border border-forest text-forest rounded-lg hover:bg-forest/5 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isPending}
                onClick={handleRecordPayment}
                className="px-4 py-2 text-sm bg-sage text-white rounded-lg hover:bg-sage/90 transition-colors disabled:opacity-50"
              >
                {isPending ? "Recording…" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Confirm Modal */}
      {showVoidConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-fraunces text-lg font-semibold text-forest mb-2">Void Invoice?</h2>
            <p className="text-sm text-forest/60 mb-6">
              This will mark the invoice as voided. This action cannot be undone. The invoice record will be preserved.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowVoidConfirm(false)}
                className="px-4 py-2 text-sm border border-forest text-forest rounded-lg hover:bg-forest/5 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isPending}
                onClick={handleVoid}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isPending ? "Voiding…" : "Void Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManagementView({
  invoice,
  lineItems,
  payments,
}: {
  invoice: Invoice;
  lineItems: LineItem[];
  payments: Payment[];
}) {
  return (
    <div className="space-y-5">
      {/* Invoice summary card */}
      <div className="bg-white rounded-xl border border-platinum shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-medium text-forest/50 uppercase tracking-wider mb-1">Customer</p>
            <p className="font-medium text-forest">{invoice.customers?.full_name || "—"}</p>
            {invoice.customers?.email && (
              <p className="text-sm text-forest/50">{invoice.customers.email}</p>
            )}
            {(invoice.customers?.phone || invoice.customers?.mobile) && (
              <p className="text-sm text-forest/50">{invoice.customers.phone || invoice.customers.mobile}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-forest/50 uppercase tracking-wider mb-1">Dates</p>
            <p className="text-sm text-forest">
              <span className="text-forest/50">Issued:</span> {fmtDate(invoice.invoice_date)}
            </p>
            <p className="text-sm text-forest mt-0.5">
              <span className="text-forest/50">Due:</span>{" "}
              <span className={invoice.due_date && new Date(invoice.due_date) < new Date() && !["paid", "voided"].includes(invoice.status) ? "text-red-500 font-medium" : ""}>
                {fmtDate(invoice.due_date)}
              </span>
            </p>
            {invoice.paid_at && (
              <p className="text-sm text-sage mt-0.5">
                <span className="text-forest/50">Paid:</span> {fmtDate(invoice.paid_at)}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-forest/50 uppercase tracking-wider mb-1">Amount Due</p>
            <p className="font-fraunces text-2xl font-semibold text-forest">{fmt(invoice.amount_due)}</p>
            <p className="text-xs text-forest/40 mt-0.5">Total: {fmt(invoice.total)}</p>
            {invoice.amount_paid > 0 && (
              <p className="text-xs text-sage mt-0.5">Paid: {fmt(invoice.amount_paid)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-platinum shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-platinum">
          <h2 className="font-fraunces text-base font-semibold text-forest">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-platinum bg-forest/2">
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">
                  Description
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">
                  Qty
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">
                  Disc
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-platinum">
              {lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-3 text-forest">{item.description}</td>
                  <td className="px-4 py-3 text-right text-forest/70">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-forest/70">{fmt(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right text-forest/50 text-xs">
                    {item.discount_pct ? `${item.discount_pct}%` : "—"}
                  </td>
                  <td className="px-6 py-3 text-right font-medium text-forest">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Totals */}
        <div className="px-6 py-4 border-t border-platinum">
          <div className="ml-auto max-w-xs space-y-1.5">
            <div className="flex justify-between text-sm text-forest/70">
              <span>Subtotal</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-forest/70">
              <span>{invoice.tax_name} ({(invoice.tax_rate * 100).toFixed(0)}%{invoice.tax_inclusive ? " incl." : ""})</span>
              <span>{fmt(invoice.tax_amount)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-forest/70">
                <span>Discount</span>
                <span>−{fmt(invoice.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-forest border-t border-platinum pt-2">
              <span className="font-fraunces">Total</span>
              <span className="font-fraunces">{fmt(invoice.total)}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <div className="flex justify-between text-sm text-sage">
                <span>Amount Paid</span>
                <span>{fmt(invoice.amount_paid)}</span>
              </div>
            )}
            {invoice.amount_due > 0 && (
              <div className="flex justify-between font-bold text-forest border-t border-platinum pt-2">
                <span>Amount Due</span>
                <span>{fmt(invoice.amount_due)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl border border-platinum shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-platinum">
          <h2 className="font-fraunces text-base font-semibold text-forest">Payment History</h2>
        </div>
        {payments.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-forest/40">No payments recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-platinum">
            {payments.map((p) => (
              <div key={p.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-forest">{p.payment_method}</p>
                  <p className="text-xs text-forest/50 mt-0.5">
                    {fmtDate(p.payment_date)}
                    {p.reference && <span className="ml-2">· Ref: {p.reference}</span>}
                  </p>
                  {p.notes && <p className="text-xs text-forest/40 mt-0.5">{p.notes}</p>}
                </div>
                <p className="font-fraunces text-base font-semibold text-sage">{fmt(p.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {(invoice.notes || invoice.footer_text) && (
        <div className="bg-white rounded-xl border border-platinum shadow-sm p-6">
          {invoice.notes && (
            <div className="mb-4">
              <p className="text-xs font-medium text-forest/50 uppercase tracking-wider mb-2">Notes</p>
              <p className="text-sm text-forest/70 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          {invoice.footer_text && (
            <div>
              <p className="text-xs font-medium text-forest/50 uppercase tracking-wider mb-2">Footer</p>
              <p className="text-sm text-forest/70 whitespace-pre-wrap">{invoice.footer_text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewView({
  invoice,
  lineItems,
  payments,
  tenant,
}: {
  invoice: Invoice;
  lineItems: LineItem[];
  payments: Payment[];
  tenant: Tenant;
}) {
  const businessName = tenant?.business_name || tenant?.name || "Your Business";
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="bg-white rounded-2xl border border-platinum shadow-sm">
      {/* Invoice paper */}
      <div className="p-10 max-w-3xl mx-auto font-inter">
        {/* Top header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            {tenant?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logo_url} alt="Logo" className="h-14 object-contain mb-3" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-forest flex items-center justify-center mb-3">
                <span className="text-white font-fraunces text-xl font-bold">
                  {businessName[0].toUpperCase()}
                </span>
              </div>
            )}
            <p className="font-semibold text-forest text-lg">{businessName}</p>
            {tenant?.abn && (
              <p className="text-sm text-forest/50 mt-0.5">ABN: {tenant.abn}</p>
            )}
            {(tenant?.address_line1 || tenant?.suburb) && (
              <p className="text-sm text-forest/50 mt-0.5">
                {[tenant.address_line1, tenant.suburb, tenant.state, tenant.postcode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {tenant?.phone && <p className="text-sm text-forest/50">{tenant.phone}</p>}
            {tenant?.email && <p className="text-sm text-forest/50">{tenant.email}</p>}
          </div>

          <div className="text-right">
            <p className="font-fraunces text-4xl font-bold text-forest tracking-tight">INVOICE</p>
            <p className="text-lg font-semibold text-forest/70 mt-1">{invoice.invoice_number}</p>
            <div className="mt-3 space-y-1 text-sm text-forest/60">
              <p><span className="font-medium text-forest/80">Issued:</span> {fmtDate(invoice.invoice_date)}</p>
              {invoice.due_date && (
                <p><span className="font-medium text-forest/80">Due:</span> {fmtDate(invoice.due_date)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-forest/40 uppercase tracking-widest mb-2">Bill To</p>
          <div className="bg-forest/3 rounded-xl p-4 border border-platinum/60">
            <p className="font-semibold text-forest text-base">{invoice.customers?.full_name || "—"}</p>
            {invoice.customers?.email && (
              <p className="text-sm text-forest/60 mt-0.5">{invoice.customers.email}</p>
            )}
            {(invoice.customers?.phone || invoice.customers?.mobile) && (
              <p className="text-sm text-forest/60">{invoice.customers.phone || invoice.customers.mobile}</p>
            )}
            {invoice.customers?.address_line1 && (
              <p className="text-sm text-forest/60 mt-0.5">
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
              <tr className="border-b-2 border-forest">
                <th className="text-left pb-3 font-semibold text-forest text-xs uppercase tracking-wider">
                  Description
                </th>
                <th className="text-right pb-3 pr-4 font-semibold text-forest text-xs uppercase tracking-wider w-16">
                  Qty
                </th>
                <th className="text-right pb-3 pr-4 font-semibold text-forest text-xs uppercase tracking-wider w-28">
                  Unit Price
                </th>
                <th className="text-right pb-3 font-semibold text-forest text-xs uppercase tracking-wider w-28">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? "" : "bg-forest/2"}>
                  <td className="py-3 pr-4 text-forest/80">
                    {item.description}
                    {item.discount_pct > 0 && (
                      <span className="ml-2 text-xs text-forest/40">({item.discount_pct}% off)</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right text-forest/60">{item.quantity}</td>
                  <td className="py-3 pr-4 text-right text-forest/60">{fmt(item.unit_price)}</td>
                  <td className="py-3 text-right font-medium text-forest">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm text-forest/60">
              <span>Subtotal</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-forest/60">
              <span>{invoice.tax_name} ({(invoice.tax_rate * 100).toFixed(0)}%{invoice.tax_inclusive ? " incl." : ""})</span>
              <span>{fmt(invoice.tax_amount)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-forest/60">
                <span>Discount</span>
                <span>−{fmt(invoice.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-forest border-t-2 border-forest pt-2">
              <span>Total</span>
              <span>{fmt(invoice.total)}</span>
            </div>
            {totalPaid > 0 && (
              <>
                <div className="flex justify-between text-sm text-sage">
                  <span>Amount Paid</span>
                  <span>{fmt(totalPaid)}</span>
                </div>
                <div className="flex justify-between font-bold text-forest border-t border-platinum pt-2 text-lg">
                  <span>Amount Due</span>
                  <span>{fmt(invoice.amount_due)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        {(invoice.footer_text || invoice.notes) && (
          <div className="border-t border-platinum pt-6 space-y-4">
            {invoice.notes && (
              <div>
                <p className="text-xs font-semibold text-forest/40 uppercase tracking-widest mb-1">Notes</p>
                <p className="text-sm text-forest/60 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
            {invoice.footer_text && (
              <div>
                <p className="text-xs font-semibold text-forest/40 uppercase tracking-widest mb-1">Payment Instructions</p>
                <p className="text-sm text-forest/60 whitespace-pre-wrap">{invoice.footer_text}</p>
              </div>
            )}
          </div>
        )}

        {/* Thank you */}
        <div className="mt-8 pt-6 border-t border-platinum text-center">
          <p className="font-fraunces text-sm text-forest/40 italic">Thank you for your business</p>
        </div>
      </div>
    </div>
  );
}
