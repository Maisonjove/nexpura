"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { advanceJobStage, archiveBespokeJob } from "../actions";
import { useRouter } from "next/navigation";

interface Stage {
  key: string;
  label: string;
}

interface Props {
  jobId: string;
  currentStage: string;
  nextStage: Stage | null;
  dueDate: string | null;
  priority: string;
  quotedPrice: string | null;
  depositAmount: string | null;
  depositPaid: boolean;
  customerName: string | null;
  customerId: string | null;
  customerEmail: string | null;
  isOverdue: boolean;
  invoiceId: string | null;
}

const PRIORITY_MAP: Record<string, { dot: string; text: string; bg: string }> = {
  low: { dot: "bg-stone-900/30", text: "text-stone-500", bg: "bg-stone-50" },
  normal: { dot: "bg-[#8B7355]", text: "text-[#8B7355]", bg: "bg-stone-100" },
  high: { dot: "bg-amber-400", text: "text-amber-600", bg: "bg-amber-50" },
  urgent: { dot: "bg-red-500", text: "text-red-600", bg: "bg-red-50" },
};

export default function JobDetailClient({
  jobId,
  currentStage,
  nextStage,
  dueDate,
  priority,
  quotedPrice,
  depositAmount,
  depositPaid,
  customerName,
  customerId,
  customerEmail,
  isOverdue,
  invoiceId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<null | "sent" | "error">(null);

  async function handleEmailReceipt() {
    setIsSending(true);
    setEmailStatus(null);
    try {
      const res = await fetch(`/api/bespoke/${jobId}/email-receipt`, { method: "POST" });
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
      const result = await advanceJobStage(jobId, nextStage.key, notes);
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
      await archiveBespokeJob(jobId);
    });
  }

  return (
    <>
      {/* Actions Panel */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5">
        <h3 className="text-base font-semibold text-stone-900">Actions</h3>

        {/* Print Job Sheet */}
        <a
          href={`/api/bespoke/${jobId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-stone-200 text-stone-900 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Job Sheet
        </a>

        {/* Email Receipt to Customer */}
        {customerEmail && (
          <div>
            <button
              onClick={handleEmailReceipt}
              disabled={isSending}
              className="w-full flex items-center justify-center gap-2 bg-white border border-stone-200 text-stone-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:border-[#8B7355] hover:text-[#8B7355] transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {isSending ? "Sending…" : "Email Receipt to Customer"}
            </button>
            {emailStatus === "sent" && (
              <p className="mt-2 text-xs font-medium text-[#8B7355]">✓ Email sent to {customerEmail}</p>
            )}
            {emailStatus === "error" && (
              <p className="mt-2 text-xs font-medium text-red-500">✗ Failed to send. Try again.</p>
            )}
          </div>
        )}

        {/* Print Invoice */}
        {invoiceId && (
          <a
            href={`/api/invoice/${invoiceId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-stone-200 text-stone-900 rounded-lg hover:bg-stone-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Invoice
          </a>
        )}

        {/* Create Invoice */}
        <Link
          href={`/invoices/new?bespoke_id=${jobId}${customerId ? `&customer_id=${customerId}` : ""}`}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[#8B7355]/10 border border-[#8B7355]/30 text-[#8B7355] rounded-lg hover:bg-[#8B7355]/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Create Invoice
        </Link>

        {/* Create Task */}
        <div>
          <Link
            href={`/tasks?new=1&linked_type=bespoke&linked_id=${jobId}&stage=${currentStage}`}
            className="w-full border border-stone-200 text-stone-600 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Create Task
          </Link>
        </div>

        {/* Advance Stage */}
        {nextStage && (
          <div>
            <button
              onClick={() => setShowModal(true)}
              className="w-full bg-[#8B7355] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#7A6347] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Advance to {nextStage.label}
            </button>
          </div>
        )}

        {currentStage === "completed" && (
          <div className="flex items-center gap-2 text-sm text-stone-500 bg-[#8B7355]/5 border border-[#8B7355]/20 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 text-[#8B7355] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Job completed
          </div>
        )}

        {/* Quick info */}
        <div className="border-t border-stone-200 pt-4 space-y-3">
          {/* Due date */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Due Date</span>
            {dueDate ? (
              <span className={`text-sm font-medium ${isOverdue ? "text-red-500" : "text-stone-900"}`}>
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

          {/* Priority */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Priority</span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${p.text} ${p.bg} px-2 py-0.5 rounded-full`}>
              <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
              {priority}
            </span>
          </div>

          {/* Quoted price */}
          {quotedPrice && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Quoted</span>
              <span className="text-sm font-medium text-stone-900">{quotedPrice}</span>
            </div>
          )}

          {/* Deposit */}
          {depositAmount && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Deposit</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-stone-900">{depositAmount}</span>
                {depositPaid ? (
                  <span className="inline-flex items-center gap-1 text-xs text-[#8B7355] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]" />
                    Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Pending
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Customer */}
        {customerId && customerName && (
          <div className="border-t border-stone-200 pt-4">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Customer</p>
            <Link
              href={`/customers/${customerId}`}
              className="text-sm font-medium text-stone-900 hover:text-[#8B7355] transition-colors flex items-center gap-1"
            >
              {customerName}
              <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        )}

        {/* Archive */}
        <div className="border-t border-stone-200 pt-4">
          {showArchiveConfirm ? (
            <div className="space-y-2">
              <p className="text-xs text-stone-500">Archive this job? This cannot be undone easily.</p>
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
              Archive job…
            </button>
          )}
        </div>
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
              Moving job to{" "}
              <span className="font-semibold text-stone-900">{nextStage.label}</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-stone-900 mb-1.5">
                Notes <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this stage transition…"
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355] resize-none"
              />
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-500">{error}</p>
            )}

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
                className="flex-1 bg-[#8B7355] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-50"
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
