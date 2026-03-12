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
  isOverdue: boolean;
}

const PRIORITY_MAP: Record<string, { dot: string; text: string; bg: string }> = {
  low: { dot: "bg-forest/30", text: "text-forest/50", bg: "bg-forest/5" },
  normal: { dot: "bg-sage", text: "text-sage", bg: "bg-sage/10" },
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
  isOverdue,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

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
      <div className="bg-white border border-platinum rounded-xl p-5 shadow-sm space-y-5">
        <h3 className="font-fraunces text-base font-semibold text-forest">Actions</h3>

        {/* Advance Stage */}
        {nextStage && (
          <div>
            <button
              onClick={() => setShowModal(true)}
              className="w-full bg-sage text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-sage/90 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Advance to {nextStage.label}
            </button>
          </div>
        )}

        {currentStage === "completed" && (
          <div className="flex items-center gap-2 text-sm text-forest/60 bg-sage/5 border border-sage/20 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 text-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Job completed
          </div>
        )}

        {/* Quick info */}
        <div className="border-t border-platinum pt-4 space-y-3">
          {/* Due date */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-forest/40 uppercase tracking-wider">Due Date</span>
            {dueDate ? (
              <span className={`text-sm font-medium ${isOverdue ? "text-red-500" : "text-forest"}`}>
                {isOverdue && "⚠ "}
                {new Date(dueDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            ) : (
              <span className="text-sm text-forest/30">Not set</span>
            )}
          </div>

          {/* Priority */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-forest/40 uppercase tracking-wider">Priority</span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${p.text} ${p.bg} px-2 py-0.5 rounded-full`}>
              <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
              {priority}
            </span>
          </div>

          {/* Quoted price */}
          {quotedPrice && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-forest/40 uppercase tracking-wider">Quoted</span>
              <span className="text-sm font-medium text-forest">{quotedPrice}</span>
            </div>
          )}

          {/* Deposit */}
          {depositAmount && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-forest/40 uppercase tracking-wider">Deposit</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-forest">{depositAmount}</span>
                {depositPaid ? (
                  <span className="inline-flex items-center gap-1 text-xs text-sage font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-sage" />
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
          <div className="border-t border-platinum pt-4">
            <p className="text-xs font-medium text-forest/40 uppercase tracking-wider mb-1.5">Customer</p>
            <Link
              href={`/customers/${customerId}`}
              className="text-sm font-medium text-forest hover:text-sage transition-colors flex items-center gap-1"
            >
              {customerName}
              <svg className="w-3.5 h-3.5 text-forest/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        )}

        {/* Archive */}
        <div className="border-t border-platinum pt-4">
          {showArchiveConfirm ? (
            <div className="space-y-2">
              <p className="text-xs text-forest/60">Archive this job? This cannot be undone easily.</p>
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
                  className="flex-1 bg-white border border-platinum text-forest text-xs font-medium py-2 rounded-lg hover:bg-ivory transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="w-full text-xs text-forest/40 hover:text-red-500 transition-colors text-left"
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
            <h3 className="font-fraunces text-lg font-semibold text-forest mb-1">
              Advance Stage
            </h3>
            <p className="text-sm text-forest/60 mb-5">
              Moving job to{" "}
              <span className="font-semibold text-forest">{nextStage.label}</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-forest mb-1.5">
                Notes <span className="text-forest/30 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this stage transition…"
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white border border-platinum rounded-lg text-forest placeholder-forest/30 focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage resize-none"
              />
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-500">{error}</p>
            )}

            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-white border border-platinum text-forest text-sm font-medium py-2.5 rounded-lg hover:bg-ivory transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdvance}
                disabled={isPending}
                className="flex-1 bg-sage text-white text-sm font-medium py-2.5 rounded-lg hover:bg-sage/90 transition-colors disabled:opacity-50"
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
