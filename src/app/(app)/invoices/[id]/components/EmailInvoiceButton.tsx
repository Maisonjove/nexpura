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
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!customerEmail) {
      onToast("No customer email on file");
      return;
    }
    setSending(true);
    try {
      const result = await emailInvoice(invoiceId);
      if (result.success) {
        onToast(`Invoice emailed to ${customerEmail}`);
      } else {
        onToast(`Failed: ${result.error ?? "Unknown error"}`);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={sending || !customerEmail}
      title={!customerEmail ? "No customer email on file" : "Email invoice to customer"}
      className="px-3 py-1.5 text-xs border border-stone-200 text-stone-500 rounded-lg hover:border-amber-600/40 hover:text-stone-900 transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      {sending ? "Sending…" : "Email"}
    </button>
  );
}
