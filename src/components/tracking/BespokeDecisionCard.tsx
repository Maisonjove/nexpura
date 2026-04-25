"use client";

import { useState, useTransition } from "react";
import { submitBespokeDecision } from "@/lib/messaging";

interface Props {
  trackingId: string;
  approvalStatus: "pending" | "approved" | "changes_requested" | null | undefined;
  approvalNotes: string | null | undefined;
  approvedAt: string | null | undefined;
  businessName: string;
}

/**
 * Bespoke-only Approve / Decline card on the tracking page. Shown
 * once the jeweller has flipped approval_status to 'pending'
 * (or while it's null but in 'cad'/'design' stage and they want
 * client sign-off). Decline forces a non-empty reason so the
 * jeweller knows what to change.
 */
export default function BespokeDecisionCard({
  trackingId,
  approvalStatus,
  approvalNotes,
  approvedAt,
  businessName,
}: Props) {
  const [mode, setMode] = useState<"idle" | "decline">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(approvalStatus);

  if (localStatus === "approved") {
    return (
      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-emerald-900">Design approved</h3>
            <p className="text-sm text-emerald-800 mt-1">
              {businessName} can now proceed to production.
              {approvedAt && (
                <span className="block text-xs text-emerald-700 mt-1">
                  Approved on {new Date(approvedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
            </p>
            {approvalNotes && (
              <div className="mt-3 px-3 py-2 bg-white/60 rounded-lg text-sm text-emerald-900">
                Your note: <span className="italic">&ldquo;{approvalNotes}&rdquo;</span>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (localStatus === "changes_requested") {
    // Customer can still send another message via the messages thread.
    return (
      <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8">
        <h3 className="text-base font-semibold text-amber-900">Changes requested</h3>
        <p className="text-sm text-amber-800 mt-1">
          {businessName} has been notified. They&apos;ll reach out when there&apos;s an updated design to review.
        </p>
        {approvalNotes && (
          <div className="mt-3 px-3 py-2 bg-white/60 rounded-lg text-sm text-amber-900">
            Your note: <span className="italic">&ldquo;{approvalNotes}&rdquo;</span>
          </div>
        )}
      </section>
    );
  }

  function submit(decision: "approve" | "decline") {
    setError(null);
    if (decision === "decline" && message.trim().length < 5) {
      setError("Please tell the jeweller what you'd like to change.");
      return;
    }
    startTransition(async () => {
      const r = await submitBespokeDecision({
        trackingId,
        decision,
        message: message.trim() || undefined,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      setLocalStatus(decision === "approve" ? "approved" : "changes_requested");
      setMode("idle");
    });
  }

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <header className="px-5 py-4 sm:px-6 sm:py-5 border-b border-stone-100 bg-gradient-to-b from-white to-stone-50/50">
        <h2 className="text-sm font-semibold text-stone-900">Review the design</h2>
        <p className="text-xs text-stone-500 mt-1">
          Approve to let {businessName} start production, or request changes if something needs adjusting.
        </p>
      </header>

      <div className="px-5 py-5 sm:px-6 space-y-4">
        {mode === "idle" ? (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional note for the jeweller…"
              rows={2}
              maxLength={4000}
              disabled={pending}
              className="w-full px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none disabled:opacity-60"
            />
            {error && (
              <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => submit("approve")}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setMode("decline")}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-stone-900 text-sm font-medium rounded-lg border border-stone-300 hover:bg-stone-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Request changes
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-stone-700">
              Tell {businessName} what you&apos;d like changed. Be as specific as you can — this helps them
              get the next version right.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. The band looks too thick — can it be 1.5mm narrower?"
              rows={4}
              maxLength={4000}
              disabled={pending}
              autoFocus
              className="w-full px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none disabled:opacity-60"
            />
            {error && (
              <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => { setMode("idle"); setError(null); }}
                className="px-4 py-2.5 text-sm text-stone-600 hover:text-stone-900 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || message.trim().length < 5}
                onClick={() => submit("decline")}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pending ? "Sending…" : "Send changes request"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
