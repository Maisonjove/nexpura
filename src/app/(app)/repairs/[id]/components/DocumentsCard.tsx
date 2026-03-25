"use client";

import type { Repair, Invoice, Customer } from "./types";

interface DocumentsCardProps {
  repair: Repair;
  invoice: Invoice | null;
  customer: Customer | null;
  readOnly: boolean;
  emailSending: boolean;
  emailSuccess: string | null;
  emailError: string | null;
  onEmailInvoice: () => void;
  onEmailReady: () => void;
  onGenerateInvoice: () => void;
}

export default function DocumentsCard({
  repair,
  invoice,
  customer,
  readOnly,
  emailSending,
  emailSuccess,
  emailError,
  onEmailInvoice,
  onEmailReady,
  onGenerateInvoice,
}: DocumentsCardProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Documents</h2>
      <div className="space-y-2">
        <button onClick={() => window.open(`/print/repair/${repair.id}`, "_blank")} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
          🖨️ Print Repair Ticket
        </button>
        <button onClick={() => window.open(`/print/receipt/repair/${repair.id}`, "_blank")} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
          🧾 Print Receipt
        </button>
        {invoice?.id ? (
          <>
            {!readOnly && (
              <>
                <button onClick={onEmailInvoice} disabled={emailSending} title="Send invoice to customer via email" className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 disabled:opacity-50 transition-colors">
                  ✉️ {emailSending ? "Sending..." : "Email Invoice"}
                </button>
                {emailSuccess && (
                  <div className={`text-xs px-3 py-2 rounded-lg ${emailSuccess.toLowerCase().includes("demo") || emailSuccess.toLowerCase().includes("logged") ? "bg-amber-50 text-amber-700" : "bg-stone-900 text-white"}`}>
                    {emailSuccess}
                  </div>
                )}
                {emailError && (
                  <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700">
                    {emailError}
                  </div>
                )}
              </>
            )}
            <button onClick={() => window.open(`/print/invoice/${invoice.id}`, "_blank")} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
              🖨️ Print Invoice
            </button>
          </>
        ) : !readOnly ? (
          <button onClick={onGenerateInvoice} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center gap-2 transition-colors font-medium">
            📄 Generate Invoice
          </button>
        ) : null}
        {!readOnly && customer?.email ? (
          <a href={`mailto:${customer.email}?subject=Re: Your repair — Marcus & Co.`} className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
            ✉️ Email Customer
          </a>
        ) : !readOnly ? (
          <div className="text-sm text-stone-400 px-3 py-2">No email on file</div>
        ) : null}
        {repair.stage === "ready" && customer?.email && !readOnly && (
          <button onClick={onEmailReady} disabled={emailSending} className="w-full text-left text-sm px-3 py-2 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 flex items-center gap-2 transition-colors disabled:opacity-50">
            ✉️ Email Ready for Collection
          </button>
        )}
      </div>
    </div>
  );
}
