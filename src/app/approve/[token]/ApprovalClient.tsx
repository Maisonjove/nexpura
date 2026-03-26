"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, MessageSquare, XCircle } from "lucide-react";

interface ApprovalClientProps {
  token: string;
  job: {
    id: string;
    job_number: string;
    title: string;
    description?: string | null;
    quoted_price?: number | null;
    approval_status?: string | null;
    approved_at?: string | null;
    approval_notes?: string | null;
  };
  customer?: { id: string; full_name: string; email?: string | null } | null;
  tenant?: { name?: string | null; currency?: string | null } | null;
  attachments: Array<{ id: string; file_url: string; caption?: string | null; file_name: string }>;
  invoice?: { id: string; invoice_number: string; total: number; subtotal: number; tax_amount: number; tax_rate: number } | null;
}

export default function ApprovalClient({
  token,
  job,
  customer,
  tenant,
  attachments,
  invoice,
}: ApprovalClientProps) {
  const [decision, setDecision] = useState<"approve" | "changes" | null>(null);
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(job.approval_status === "approved");
  const [error, setError] = useState<string | null>(null);

  const currency = tenant?.currency || "AUD";
  const currencySymbol = currency === "AUD" || currency === "USD" ? "$" : "£";

  async function handleSubmit() {
    if (!decision) return;
    if (decision === "approve" && !signature.trim()) {
      setError("Please type your name as a digital signature.");
      return;
    }
    setIsPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/bespoke/approval-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          decision,
          notes: notes.trim() || null,
          signature: signature.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSubmitted(true);
      }
    } finally {
      setIsPending(false);
    }
  }

  if (submitted || job.approval_status === "approved") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center py-16">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">
            {decision === "changes" ? "Changes Requested" : "Design Approved!"}
          </h1>
          <p className="text-stone-500">
            {decision === "changes"
              ? "We've received your feedback and will be in touch soon."
              : `Thank you, ${customer?.full_name || ""}! We'll begin working on your piece right away.`}
          </p>
          <p className="text-stone-400 text-sm mt-6">{tenant?.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">{tenant?.name}</p>
          <h1 className="text-xl font-semibold text-stone-900">Design Approval</h1>
          <p className="text-sm text-stone-500 mt-1">Job #{job.job_number} · {job.title}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Design Images */}
        {attachments.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-3">Design Images</h2>
            <div className="grid grid-cols-2 gap-3">
              {attachments.map((att) => (
                <div key={att.id} className="bg-white rounded-xl overflow-hidden border border-stone-200">
                  <div className="aspect-square relative bg-stone-100">
                    <Image
                      src={att.file_url}
                      alt={att.caption || att.file_name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  {att.caption && (
                    <p className="text-xs text-stone-500 p-2">{att.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Job Description */}
        {job.description && (
          <div className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-semibold text-stone-700 mb-2">Brief</h2>
            <p className="text-sm text-stone-600 whitespace-pre-wrap">{job.description}</p>
          </div>
        )}

        {/* Pricing */}
        {(invoice || job.quoted_price) && (
          <div className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Quote Summary</h2>
            {invoice ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Subtotal</span>
                  <span className="text-stone-900">{currencySymbol}{invoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Tax ({(invoice.tax_rate * 100).toFixed(0)}%)</span>
                  <span className="text-stone-900">{currencySymbol}{invoice.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold border-t border-stone-100 pt-2 mt-2">
                  <span className="text-stone-900">Total</span>
                  <span className="text-stone-900">{currencySymbol}{invoice.total.toFixed(2)} {currency}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between text-base font-semibold">
                <span className="text-stone-900">Quoted Price</span>
                <span className="text-stone-900">{currencySymbol}{job.quoted_price?.toFixed(2)} {currency}</span>
              </div>
            )}
          </div>
        )}

        {/* Decision */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">Your Decision</h2>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setDecision("approve")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                decision === "approve"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-stone-200 hover:border-stone-300"
              }`}
            >
              <CheckCircle2 className={`w-7 h-7 ${decision === "approve" ? "text-emerald-500" : "text-stone-300"}`} />
              <span className={`text-sm font-medium ${decision === "approve" ? "text-emerald-700" : "text-stone-500"}`}>
                Approve Design
              </span>
            </button>
            <button
              onClick={() => setDecision("changes")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                decision === "changes"
                  ? "border-red-400 bg-red-50"
                  : "border-stone-200 hover:border-stone-300"
              }`}
            >
              <MessageSquare className={`w-7 h-7 ${decision === "changes" ? "text-red-400" : "text-stone-300"}`} />
              <span className={`text-sm font-medium ${decision === "changes" ? "text-red-600" : "text-stone-500"}`}>
                Request Changes
              </span>
            </button>
          </div>

          {decision && (
            <div className="space-y-3">
              <textarea
                placeholder={decision === "approve" ? "Any additional notes? (optional)" : "Please describe the changes you'd like..."}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full text-sm px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
              />
              {decision === "approve" && (
                <div>
                  <label className="block text-xs text-stone-500 mb-1.5">
                    Digital Signature — Type your full name to approve *
                  </label>
                  <input
                    type="text"
                    placeholder="Your full name"
                    value={signature}
                    onChange={e => setSignature(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    style={{ fontFamily: "cursive", fontSize: "16px" }}
                  />
                </div>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={isPending || (decision === "approve" && !signature.trim())}
                className={`w-full text-sm font-semibold py-3 rounded-xl transition disabled:opacity-50 ${
                  decision === "approve"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-stone-900 text-white hover:bg-stone-700"
                }`}
              >
                {isPending ? "Submitting..." : decision === "approve" ? "Approve Design" : "Submit Feedback"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
