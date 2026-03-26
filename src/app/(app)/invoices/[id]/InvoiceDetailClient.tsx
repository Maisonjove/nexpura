"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { recordPayment, markAsSent, voidInvoice } from "../actions";

import {
  STATUS_BADGE,
  fmtDate,
  LineItemsTable,
  PaymentHistory,
  InvoiceSummaryCard,
  InvoiceNotesCard,
  PreviewView,
  PaymentModal,
  VoidConfirmModal,
  EmailInvoiceButton,
} from "./components";

import type { InvoiceDetailClientProps } from "./components/types";

export default function InvoiceDetailClient({
  invoice,
  lineItems,
  payments,
  tenant,
  readOnly = false,
}: InvoiceDetailClientProps) {
  const [view, setView] = useState<"manage" | "preview">(readOnly ? "preview" : "manage");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function handleRecordPayment(data: {
    amount: number;
    method: string;
    date: string;
    reference: string | null;
    notes: string | null;
  }) {
    if (!data.amount || data.amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await recordPayment(invoice.id, data.amount, data.method, data.date, data.reference, data.notes);
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
        <div className="fixed top-4 right-4 z-50 bg-stone-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-right">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/invoices" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
            ← Invoices
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-semibold text-2xl font-semibold text-stone-900">
              {invoice.invoice_number}
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-sm text-stone-500 mt-0.5">
            {invoice.customers?.full_name || "No customer"} · Issued {fmtDate(invoice.invoice_date)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* View toggle */}
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
            <button
              onClick={() => setView("manage")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "manage"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              Manage
            </button>
            <button
              onClick={() => setView("preview")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "preview"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              Preview
            </button>
          </div>

          {!readOnly && canEdit && (
            <Link
              href={`/invoices/${invoice.id}/edit`}
              className="px-3 py-1.5 text-xs border border-stone-900 text-stone-900 rounded-lg hover:bg-stone-900/5 transition-colors"
            >
              Edit
            </Link>
          )}
          {!readOnly && canMarkSent && (
            <button
              disabled={isPending}
              onClick={handleMarkSent}
              className="px-3 py-1.5 text-xs border border-stone-900 text-stone-900 rounded-lg hover:bg-stone-900/5 transition-colors disabled:opacity-50"
            >
              Mark as Sent
            </button>
          )}
          {!readOnly && canRecordPayment && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-3 py-1.5 text-xs bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors"
            >
              Record Payment
            </button>
          )}
          {invoice.stripe_payment_link && !["paid", "voided"].includes(invoice.status) && (
            <a
              href={invoice.stripe_payment_link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Pay Now
            </a>
          )}
          {invoice.customers?.id && (
            <Link
              href={`/passports/new?invoice_id=${invoice.id}&customer_id=${invoice.customers.id}`}
              className="px-3 py-1.5 text-xs border border-amber-600 text-amber-700 rounded-lg hover:bg-amber-700/5 transition-colors inline-flex items-center gap-1"
              title="Issue a Digital Passport for an item on this invoice"
            >
              🛡️ Issue Passport
            </Link>
          )}
          <a
            href={`/api/invoice/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors inline-flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </a>
          <a
            href={`/api/invoice/${invoice.id}/pdf?format=thermal`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs border border-stone-200 text-stone-500 rounded-lg hover:border-amber-600/40 hover:text-stone-900 transition-colors inline-flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Thermal
          </a>
          <EmailInvoiceButton invoiceId={invoice.id} customerEmail={invoice.customers?.email ?? null} onToast={showToast} />
          {!readOnly && canVoid && (
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
        <div className="space-y-5">
          <InvoiceSummaryCard invoice={invoice} />
          <LineItemsTable invoice={invoice} lineItems={lineItems} />
          <PaymentHistory payments={payments} />
          <InvoiceNotesCard invoice={invoice} />
        </div>
      ) : (
        <PreviewView
          invoice={invoice}
          lineItems={lineItems}
          payments={payments}
          tenant={tenant}
        />
      )}

      {/* Payment Modal */}
      {!readOnly && (
        <PaymentModal
          isOpen={showPaymentModal}
          amountDue={invoice.amount_due}
          isPending={isPending}
          error={error}
          onClose={() => {
            setShowPaymentModal(false);
            setError(null);
          }}
          onSubmit={handleRecordPayment}
        />
      )}

      {/* Void Confirm Modal */}
      {!readOnly && (
        <VoidConfirmModal
          isOpen={showVoidConfirm}
          isPending={isPending}
          onClose={() => setShowVoidConfirm(false)}
          onConfirm={handleVoid}
        />
      )}
    </div>
  );
}
