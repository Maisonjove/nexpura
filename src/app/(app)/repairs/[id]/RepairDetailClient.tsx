"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { advanceRepairStage, archiveRepair, sendRepairQuoteEmail } from "../actions";
import { useRouter } from "next/navigation";
import { JobFinancePanel } from "@/components/JobFinancePanel";

interface Stage {
  key: string;
  label: string;
}

interface Props {
  repairId: string;
  currentStage: string;
  nextStage: Stage | null;
  dueDate: string | null;
  priority: string;
  quotedPrice: string | null;
  quotedPriceRaw: number | null;
  finalPrice: string | null;
  depositAmount: string | null;
  depositPaid: boolean;
  customerName: string | null;
  customerId: string | null;
  customerEmail: string | null;
  customerMobile: string | null;
  isOverdue: boolean;
  invoiceId: string | null;
  currency?: string;
  readOnly?: boolean;
}

const PRIORITY_MAP: Record<string, { dot: string; text: string; bg: string }> =
  {
    low: { dot: "bg-stone-900/30", text: "text-stone-500", bg: "bg-stone-50" },
    normal: { dot: "bg-amber-700", text: "text-amber-700", bg: "bg-stone-100" },
    high: { dot: "bg-amber-400", text: "text-amber-600", bg: "bg-amber-50" },
    urgent: { dot: "bg-red-500", text: "text-red-600", bg: "bg-red-50" },
  };

export default function RepairDetailClient({
  repairId,
  currentStage,
  nextStage,
  dueDate,
  priority,
  quotedPrice,
  quotedPriceRaw,
  finalPrice,
  depositAmount,
  depositPaid,
  customerName,
  customerId,
  customerEmail,
  customerMobile,
  isOverdue,
  invoiceId,
  currency = "AUD",
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteToast, setQuoteToast] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<null | "sent" | "error">(null);

  async function handleEmailReceipt() {
    setIsSending(true);
    setEmailStatus(null);
    try {
      const res = await fetch(`/api/repair/${repairId}/email-receipt`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setEmailStatus("sent");
      } else {
        setEmailStatus("error");
      }
    } catch {
      setEmailStatus("error");
    } finally {
      setIsSending(false);
    }
  }

  const p = PRIORITY_MAP[priority] || PRIORITY_MAP.normal;

  function handleAdvance() {
    if (!nextStage) return;
    setError(null);
    startTransition(async () => {
      const result = await advanceRepairStage(repairId, nextStage.key, notes);
      if (result?.error) {
        setError(result.error);
      } else {
        setShowModal(false);
        setNotes("");
        router.refresh();
      }
    });
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveRepair(repairId);
    });
  }

  async function handleSendQuote() {
    if (!quotedPriceRaw) return;
    setQuoteSending(true);
    setQuoteToast(null);
    try {
      const result = await sendRepairQuoteEmail(repairId);
      if (result.success) {
        setQuoteToast(customerEmail ? `Quote sent to ${customerEmail}` : "Quote email sent");
      } else {
        setQuoteToast(`Failed: ${result.error}`);
      }
    } finally {
      setQuoteSending(false);
      setTimeout(() => setQuoteToast(null), 5000);
    }
  }

  const isTerminal = ["collected", "cancelled"].includes(currentStage);

  return (
    <>
      {/* Actions Panel */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5">
        <h3 className="text-base font-semibold text-stone-900">
          Actions
        </h3>

        <div className="grid grid-cols-2 gap-2">
          {/* Download PDF */}
          <a
            href={`/api/repair/${repairId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-white border border-stone-200 text-stone-900 rounded-lg hover:bg-stone-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Ticket
          </a>

          {/* Create Task */}
          <Link
            href={`/tasks?new=1&linked_type=repair&linked_id=${repairId}&stage=${currentStage}`}
            className="border border-stone-200 text-stone-600 text-xs font-medium px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Task
          </Link>
        </div>

        {/* Quick Contact Actions */}
        {customerMobile && (
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${customerMobile}`}
              className="flex items-center justify-center gap-2 bg-stone-50 border border-stone-200 text-stone-700 text-xs font-medium px-4 py-2 rounded-lg hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call
            </a>
            <a
              href={`https://wa.me/${customerMobile.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-stone-50 border border-stone-200 text-stone-700 text-xs font-medium px-4 py-2 rounded-lg hover:border-green-200 hover:bg-green-50 hover:text-green-700 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              WhatsApp
            </a>
          </div>
        )}

        {/* Email Receipt to Customer */}
        {!readOnly && customerEmail && (
          <div>
            <button
              onClick={handleEmailReceipt}
              disabled={isSending}
              className="w-full flex items-center justify-center gap-2 bg-white border border-stone-200 text-stone-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:border-amber-600 hover:text-amber-700 transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {isSending ? "Sending…" : "Email Receipt"}
            </button>
            {emailStatus === "sent" && (
              <p className="mt-2 text-xs font-medium text-amber-700">✓ Email sent to {customerEmail}</p>
            )}
            {emailStatus === "error" && (
              <p className="mt-2 text-xs font-medium text-red-500">✗ Failed to send. Try again.</p>
            )}
          </div>
        )}

        {/* Advance Stage */}
        {!readOnly && nextStage && !isTerminal && (
          <div>
            <button
              onClick={() => setShowModal(true)}
              className="w-full bg-amber-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-amber-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
              Advance to {nextStage.label}
            </button>
          </div>
        )}

        {/* Send Quote button — shown when stage is 'quoted' and there's a quoted price */}
        {!readOnly && currentStage === "quoted" && quotedPriceRaw && (
          <div>
            <button
              onClick={handleSendQuote}
              disabled={quoteSending}
              className="w-full bg-amber-700/90 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {quoteSending ? "Sending…" : "Send Quote to Customer"}
            </button>
            {quoteToast && (
              <p className={`mt-2 text-xs font-medium ${quoteToast.startsWith("Failed") ? "text-red-500" : "text-amber-700"}`}>
                {quoteToast}
              </p>
            )}
          </div>
        )}

        {currentStage === "collected" && (
          <div className="flex items-center gap-2 text-sm text-stone-500 bg-amber-700/5 border border-amber-600/20 rounded-lg px-4 py-3">
            <svg
              className="w-4 h-4 text-amber-700 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Repair collected
          </div>
        )}

        {currentStage === "cancelled" && (
          <div className="flex items-center gap-2 text-sm text-stone-400 bg-stone-50 border border-stone-900/10 rounded-lg px-4 py-3">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Repair cancelled
          </div>
        )}

        {/* Quick info */}
        <div className="border-t border-stone-200 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
              Due Date
            </span>
            {dueDate ? (
              <span
                className={`text-sm font-medium ${
                  isOverdue ? "text-red-500" : "text-stone-900"
                }`}
              >
                {isOverdue && "⚠ "}
                {new Date(dueDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            ) : (
              <span className="text-sm text-stone-400">Not set</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
              Priority
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${p.text} ${p.bg} px-2 py-0.5 rounded-full`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
              {priority}
            </span>
          </div>
        </div>

        {/* Finance Panel */}
        <JobFinancePanel
          jobId={repairId}
          jobType="repair"
          quotedPrice={quotedPriceRaw}
          depositAmount={depositAmount ? parseFloat(depositAmount.replace(/[^\d.]/g, "")) : null}
          depositPaid={depositPaid}
          finalPrice={finalPrice ? parseFloat(finalPrice.replace(/[^\d.]/g, "")) : null}
          invoiceId={invoiceId}
          customerId={customerId}
          customerName={customerName}
          customerEmail={customerEmail}
          status={currentStage}
          currency={currency}
          readOnly={readOnly}
        />

        {/* Customer */}
        {customerId && customerName && (
          <div className="border-t border-stone-200 pt-4">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">
              Customer
            </p>
            <Link
              href={`/customers/${customerId}`}
              className="text-sm font-medium text-stone-900 hover:text-amber-700 transition-colors flex items-center gap-1"
            >
              {customerName}
              <svg
                className="w-3.5 h-3.5 text-stone-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </Link>
          </div>
        )}

        {/* Archive */}
        {!readOnly && (
          <div className="border-t border-stone-200 pt-4">
            {showArchiveConfirm ? (
              <div className="space-y-2">
                <p className="text-xs text-stone-500">
                  Archive this repair? It will be hidden from all views.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleArchive}
                    disabled={isPending}
                    className="flex-1 bg-red-500 text-white text-xs font-medium py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {isPending ? "Archiving…" : "Confirm Archive"}
                  </button>
                  <button
                    onClick={() => setShowArchiveConfirm(false)}
                    className="flex-1 bg-white border border-stone-200 text-stone-900 text-xs font-medium py-2 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="w-full text-xs text-stone-400 hover:text-red-500 transition-colors text-left"
              >
                Archive repair…
              </button>
            )}
          </div>
        )}
      </div>

      {/* Advance Stage Modal */}
      {showModal && nextStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-lg font-semibold text-stone-900 mb-1">
              Advance Stage
            </h3>
            <p className="text-sm text-stone-500 mb-5">
              Moving repair to{" "}
              <span className="font-semibold text-stone-900">
                {nextStage.label}
              </span>
            </p>

            <div>
              <label className="block text-sm font-medium text-stone-900 mb-1.5">
                Notes{" "}
                <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this stage transition…"
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 resize-none"
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-white border border-stone-200 text-stone-900 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdvance}
                disabled={isPending}
                className="flex-1 bg-amber-700 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50"
              >
                {isPending ? "Advancing…" : `Confirm → ${nextStage.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
