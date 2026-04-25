"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { CheckCircle2, XCircle, Gem, ChevronLeft, ChevronRight, PenTool } from "lucide-react";

interface ApprovalClientProps {
  token: string;
  job: {
    id: string;
    job_number: string;
    title: string;
    description?: string | null;
    jewellery_type?: string | null;
    metal_type?: string | null;
    metal_colour?: string | null;
    metal_purity?: string | null;
    stone_type?: string | null;
    stone_carat?: number | null;
    stone_colour?: string | null;
    stone_clarity?: string | null;
    ring_size?: string | null;
    setting_style?: string | null;
    quoted_price?: number | null;
    deposit_amount?: number | null;
    approval_status?: string | null;
    approved_at?: string | null;
    approval_notes?: string | null;
  };
  customer?: { id: string; full_name: string; email: string } | null;
  tenant?: { id: string; name: string; business_name?: string; logo_url?: string } | null;
  milestones: Array<{ id: string; title: string; description?: string; due_date?: string; completed_at?: string; order_index: number }>;
  attachments: Array<{ id: string; file_url: string; file_name: string; caption?: string }>;
}

export default function ApprovalClient({
  token,
  job,
  customer,
  tenant,
  milestones,
  attachments,
}: ApprovalClientProps) {
  const [currentImage, setCurrentImage] = useState(0);
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [changeNotes, setChangeNotes] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<"approved" | "changes_requested" | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already approved/changes_requested
  if (job.approval_status === "approved" || job.approved_at) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Design Approved</h1>
          <p className="text-stone-500 text-sm">
            This design was approved on {job.approved_at ? new Date(job.approved_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "a previous date"}.
          </p>
          {job.approval_notes && (
            <p className="mt-4 text-sm text-stone-600 italic">&quot;{job.approval_notes}&quot;</p>
          )}
        </div>
      </div>
    );
  }

  if (result === "approved") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Thank You!</h1>
          <p className="text-stone-500 text-sm">
            Your design for <strong>{job.title}</strong> has been approved. We&apos;ll begin production and keep you updated.
          </p>
        </div>
      </div>
    );
  }

  if (result === "changes_requested") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Changes Requested</h1>
          <p className="text-stone-500 text-sm">
            We&apos;ve received your feedback and will update the design. You&apos;ll receive a new approval request soon.
          </p>
        </div>
      </div>
    );
  }

  async function handleApprove() {
    if (!signatureData) {
      alert("Please provide your signature to approve the design.");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/bespoke/approval-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "approve", signature: signatureData }),
      });
      const data = await res.json();
      if (data.success) {
        setResult("approved");
      } else {
        // Pre-fix swallowed every server error — the form silently
        // re-enabled and the customer thought their click did nothing.
        setError(data.error || "Could not record approval. Please try again or contact your jeweller.");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleRequestChanges() {
    if (!changeNotes.trim()) {
      alert("Please describe the changes you'd like.");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/bespoke/approval-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "changes_requested", notes: changeNotes }),
      });
      const data = await res.json();
      if (data.success) {
        setResult("changes_requested");
      } else {
        setError(data.error || "Could not send your request. Please try again.");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsPending(false);
    }
  }

  // Canvas signature handling
  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL("image/png"));
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  }

  const storeName = tenant?.business_name || tenant?.name || "Your Jeweller";

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {tenant?.logo_url ? (
            <Image src={tenant.logo_url} alt={storeName} width={40} height={40} className="rounded-lg" />
          ) : (
            <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
              <Gem className="w-5 h-5 text-stone-400" />
            </div>
          )}
          <div>
            <h1 className="font-semibold text-stone-900">{storeName}</h1>
            <p className="text-xs text-stone-500">Design Approval</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Greeting */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900 mb-1">
            Hi {customer?.full_name?.split(" ")[0] || "there"},
          </h2>
          <p className="text-sm text-stone-500">
            Your custom jewellery design for <strong>{job.title}</strong> (Job #{job.job_number}) is ready for your review and approval.
          </p>
        </div>

        {/* Design Images */}
        {attachments.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <h3 className="text-sm font-semibold text-stone-900 mb-3">Design Images</h3>
            <div className="relative">
              <div className="aspect-square bg-stone-100 rounded-xl overflow-hidden">
                <Image
                  src={attachments[currentImage].file_url}
                  alt={attachments[currentImage].caption || "Design image"}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              {attachments.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImage((currentImage - 1 + attachments.length) % attachments.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentImage((currentImage + 1) % attachments.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="flex justify-center gap-1.5 mt-3">
                    {attachments.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImage(idx)}
                        className={`w-2 h-2 rounded-full transition ${idx === currentImage ? "bg-stone-900" : "bg-stone-300"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Specifications */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
          <h3 className="text-sm font-semibold text-stone-900 mb-3">Specifications</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {job.jewellery_type && (
              <div>
                <span className="text-stone-400">Type</span>
                <p className="text-stone-900 capitalize">{job.jewellery_type.replace(/_/g, " ")}</p>
              </div>
            )}
            {job.metal_type && (
              <div>
                <span className="text-stone-400">Metal</span>
                <p className="text-stone-900">{job.metal_colour} {job.metal_purity} {job.metal_type}</p>
              </div>
            )}
            {job.stone_type && (
              <div>
                <span className="text-stone-400">Stone</span>
                <p className="text-stone-900">{job.stone_carat && `${job.stone_carat}ct `}{job.stone_colour} {job.stone_type}</p>
              </div>
            )}
            {job.ring_size && (
              <div>
                <span className="text-stone-400">Ring Size</span>
                <p className="text-stone-900">{job.ring_size}</p>
              </div>
            )}
            {job.setting_style && (
              <div>
                <span className="text-stone-400">Setting</span>
                <p className="text-stone-900 capitalize">{job.setting_style.replace(/_/g, " ")}</p>
              </div>
            )}
          </div>
          {job.description && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <span className="text-stone-400 text-sm">Notes</span>
              <p className="text-stone-900 text-sm mt-1">{job.description}</p>
            </div>
          )}
        </div>

        {/* Quote */}
        {job.quoted_price && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
            <h3 className="text-sm font-semibold text-stone-900 mb-3">Quote</h3>
            <div className="flex justify-between items-center">
              <span className="text-stone-500">Total</span>
              <span className="text-xl font-semibold text-stone-900">${job.quoted_price.toLocaleString()}</span>
            </div>
            {job.deposit_amount && (
              <div className="flex justify-between items-center mt-2 text-sm">
                <span className="text-stone-400">Deposit required</span>
                <span className="text-stone-600">${job.deposit_amount.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
            <h3 className="text-sm font-semibold text-stone-900 mb-3">Timeline</h3>
            <div className="space-y-2">
              {milestones.sort((a, b) => a.order_index - b.order_index).map((m, idx) => (
                <div key={m.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${m.completed_at ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                      {m.completed_at ? "✓" : idx + 1}
                    </div>
                    {idx < milestones.length - 1 && <div className="w-px h-4 bg-stone-200 mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className={`text-sm font-medium ${m.completed_at ? "text-stone-400 line-through" : "text-stone-900"}`}>{m.title}</p>
                    {m.due_date && !m.completed_at && (
                      <p className="text-xs text-stone-400">Target: {new Date(m.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature Pad */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              Your Signature
            </h3>
            {signatureData && (
              <button onClick={clearSignature} className="text-xs text-stone-400 hover:text-stone-600">
                Clear
              </button>
            )}
          </div>
          <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50">
            <canvas
              ref={canvasRef}
              width={500}
              height={150}
              className="w-full touch-none cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p className="text-xs text-stone-400 mt-2">
            Sign above with your mouse or finger to approve the design.
          </p>
        </div>

        {/* Action buttons */}
        {error && (
          <div role="alert" className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}
        {!showRequestChanges ? (
          <div className="space-y-3">
            <button
              onClick={handleApprove}
              disabled={isPending || !signatureData}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isPending ? "Approving..." : "Approve Design"}
            </button>
            <button
              onClick={() => setShowRequestChanges(true)}
              className="w-full py-3 border border-stone-200 text-stone-600 text-sm font-medium rounded-xl hover:bg-stone-50 transition"
            >
              Request Changes
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200 space-y-4">
            <h3 className="text-sm font-semibold text-stone-900">What changes would you like?</h3>
            <textarea
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              rows={4}
              placeholder="Please describe the changes you'd like made to the design..."
              className="w-full text-sm px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRequestChanges(false)}
                className="flex-1 py-2.5 border border-stone-200 text-stone-600 text-sm font-medium rounded-xl hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={isPending || !changeNotes.trim()}
                className="flex-1 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-500 disabled:opacity-50 transition"
              >
                {isPending ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
