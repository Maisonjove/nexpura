"use client";

import { useState } from "react";
import { emailInvoice } from "../emailInvoice";

interface EmailInvoiceButtonProps {
  invoiceId: string;
  customerEmail: string | null;
  onToast: (msg: string) => void;
}

export default function EmailInvoiceButton({
  invoiceId,
  customerEmail,
  onToast,
}: EmailInvoiceButtonProps) {
  const [sending, setSending] = useState<"customer" | "test" | null>(null);

  async function handleSendToCustomer() {
    if (!customerEmail) {
      onToast("No customer email on file");
      return;
    }
    setSending("customer");
    try {
      const result = await emailInvoice(invoiceId);
      if (result.success) {
        onToast(`Invoice emailed to ${customerEmail}`);
      } else {
        onToast(`Failed: ${result.error ?? "Unknown error"}`);
      }
    } finally {
      setSending(null);
    }
  }

  // Section 4 #4: dry-run send to operator. Doesn't require
  // customerEmail (the recipient is the authed user) so the test
  // path is available even before the customer email is captured.
  async function handleSendToMe() {
    setSending("test");
    try {
      const result = await emailInvoice(invoiceId, { sendToOperator: true });
      if (result.success && result.sentTo) {
        onToast(`Test sent to ${result.sentTo} — check your inbox`);
      } else {
        onToast(`Test failed: ${result.error ?? "Unknown error"}`);
      }
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleSendToCustomer}
        disabled={sending !== null || !customerEmail}
        title={!customerEmail ? "No customer email on file" : "Email invoice to customer"}
        className="px-3 py-1.5 text-xs border border-stone-200 text-stone-500 rounded-lg hover:border-amber-600/40 hover:text-stone-900 transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {sending === "customer" ? "Sending…" : "Email"}
      </button>
      <button
        type="button"
        onClick={handleSendToMe}
        disabled={sending !== null}
        title="Send a test copy to your inbox to preview the email-as-customer-sees-it"
        className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-900 transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {sending === "test" ? "Sending test…" : "Send test to me"}
      </button>
    </div>
  );
}
