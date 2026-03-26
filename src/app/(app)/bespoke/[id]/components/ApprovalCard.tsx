"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock, Send, XCircle } from "lucide-react";

interface ApprovalCardProps {
  jobId: string;
  tenantId: string;
  jobNumber: string;
  customerEmail?: string | null;
  approvalStatus?: string | null;
  approvalToken?: string | null;
  approvalRequestedAt?: string | null;
  approvedAt?: string | null;
  approvalNotes?: string | null;
  readOnly?: boolean;
  onRefresh?: () => void;
}

export default function ApprovalCard({
  jobId,
  tenantId,
  jobNumber,
  customerEmail,
  approvalStatus,
  approvalToken,
  approvalRequestedAt,
  approvedAt,
  approvalNotes,
  readOnly = false,
  onRefresh,
}: ApprovalCardProps) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function showToastMsg(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function sendApprovalRequest() {
    startTransition(async () => {
      const res = await fetch("/api/bespoke/send-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, tenantId }),
      });
      const data = await res.json();
      if (data.error) {
        showToastMsg(`Error: ${data.error}`);
      } else {
        showToastMsg("✓ Approval request sent to client");
        onRefresh?.();
      }
    });
  }

  const statusConfig = {
    pending: { label: "Pending", color: "text-stone-400", bg: "bg-stone-50", icon: <Clock className="w-4 h-4" /> },
    requested: { label: "Awaiting Client", color: "text-amber-600", bg: "bg-amber-50", icon: <Clock className="w-4 h-4" /> },
    approved: { label: "Approved", color: "text-emerald-600", bg: "bg-emerald-50", icon: <CheckCircle2 className="w-4 h-4" /> },
    changes_requested: { label: "Changes Requested", color: "text-red-600", bg: "bg-red-50", icon: <XCircle className="w-4 h-4" /> },
  };

  const status = (approvalStatus as keyof typeof statusConfig) || "pending";
  const cfg = statusConfig[status] ?? statusConfig.pending;

  const approvalUrl = approvalToken
    ? `${process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com"}/approve/${approvalToken}`
    : null;

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-stone-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-stone-900 text-sm">Client Approval</h3>
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
          {cfg.icon}
          {cfg.label}
        </span>
      </div>

      {approvedAt && (
        <div className="mb-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-sm font-medium text-emerald-700">✓ Approved</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            {new Date(approvedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          {approvalNotes && (
            <p className="text-xs text-emerald-700 mt-1 italic">&quot;{approvalNotes}&quot;</p>
          )}
        </div>
      )}

      {status === "changes_requested" && approvalNotes && (
        <div className="mb-3 p-3 bg-red-50 rounded-xl border border-red-100">
          <p className="text-sm font-medium text-red-700">Changes requested by client:</p>
          <p className="text-xs text-red-600 mt-1 italic">&quot;{approvalNotes}&quot;</p>
        </div>
      )}

      {approvalRequestedAt && status !== "approved" && (
        <p className="text-xs text-stone-400 mb-3">
          Request sent {new Date(approvalRequestedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
        </p>
      )}

      {approvalUrl && (
        <div className="mb-3 p-2.5 bg-stone-50 rounded-lg border border-stone-200">
          <p className="text-xs text-stone-500 mb-1">Approval link:</p>
          <a href={approvalUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline break-all">
            {approvalUrl}
          </a>
        </div>
      )}

      {!readOnly && status !== "approved" && (
        <button
          onClick={sendApprovalRequest}
          disabled={isPending || !customerEmail}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium bg-stone-900 text-white px-4 py-2.5 rounded-xl hover:bg-stone-700 disabled:opacity-50 transition"
        >
          <Send className="w-4 h-4" />
          {status === "requested" ? "Resend Approval Request" : "Send Approval Request"}
        </button>
      )}

      {!customerEmail && (
        <p className="text-xs text-stone-400 text-center mt-2">Customer email required to send approval request</p>
      )}
    </div>
  );
}
