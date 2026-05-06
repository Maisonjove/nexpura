"use client";

import { useState, useTransition, useMemo } from "react";
import { changeTenantPlan, changeTenantStatus, assignFreeForever, forcePaidGracePeriod, saveTenantAdminNotes, deleteTenant, extendTrial } from "@/app/(admin)/actions";
import { adminGenerateRecoveryLink } from "./actions";
import { useRouter } from "next/navigation";

interface TenantActionsProps {
  tenantId: string;
  currentPlan: string;
  currentStatus: string;
  isFreeForever?: boolean;
  gracePeriodEndsAt?: string | null;
  adminNotes?: string | null;
  ownerEmail?: string | null;
}

export default function TenantActions({
  tenantId,
  currentPlan,
  currentStatus,
  isFreeForever = false,
  gracePeriodEndsAt,
  adminNotes,
  ownerEmail,
}: TenantActionsProps) {
  const router = useRouter();
  const [plan, setPlan] = useState(currentPlan);
  const [status, setStatus] = useState(currentStatus);
  const [trialDays, setTrialDays] = useState(30);
  const [notes, setNotes] = useState(adminNotes ?? "");
  const [planPending, startPlanTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();
  const [trialPending, startTrialTransition] = useTransition();
  const [freePending, startFreeTransition] = useTransition();
  const [forcePaidPending, startForcePaidTransition] = useTransition();
  const [notesPending, startNotesPending] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [planMsg, setPlanMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [trialMsg, setTrialMsg] = useState("");
  const [freeMsg, setFreeMsg] = useState("");
  const [notesMsg, setNotesMsg] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Recovery-link hotfix state (PR #202).
  // The link itself is held in component state for copy-paste only —
  // it is intentionally NOT persisted (no localStorage / no router
  // search-params), and it clears on email-input change so the admin
  // never accidentally hands out a stale link tied to the wrong user.
  const [recoveryEmail, setRecoveryEmail] = useState(ownerEmail ?? "");
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [recoveryPending, startRecoveryTransition] = useTransition();

  const newTrialEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + trialDays);
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  }, [trialDays]);

  function handlePlanSave() {
    startPlanTransition(async () => {
      try {
        await changeTenantPlan(tenantId, plan as "boutique" | "studio" | "atelier");
        setPlanMsg("Plan updated successfully");
      } catch {
        setPlanMsg("Failed to update plan");
      }
      setTimeout(() => setPlanMsg(""), 3000);
    });
  }

  function handleStatusSave() {
    if (status === "suspended" && currentStatus !== "suspended" && pendingAction !== "confirm_suspend") {
      setPendingAction("confirm_suspend");
      return;
    }

    startStatusTransition(async () => {
      try {
        await changeTenantStatus(tenantId, status as "trialing" | "active" | "past_due" | "canceled" | "suspended" | "free");
        setStatusMsg("Status updated successfully");
        setPendingAction(null);
      } catch {
        setStatusMsg("Failed to update status");
      }
      setTimeout(() => setStatusMsg(""), 3000);
    });
  }

  function handleExtendTrial() {
    startTrialTransition(async () => {
      try {
        await extendTrial(tenantId, trialDays);
        setTrialMsg(`Trial extended by ${trialDays} days`);
      } catch {
        setTrialMsg("Failed to extend trial");
      }
      setTimeout(() => setTrialMsg(""), 3000);
    });
  }

  function handleAssignFree() {
    if (!confirm("Assign free forever access to this tenant?")) return;
    startFreeTransition(async () => {
      try {
        await assignFreeForever(tenantId);
        setFreeMsg("Free forever access assigned");
      } catch {
        setFreeMsg("Failed to assign free access");
      }
      setTimeout(() => setFreeMsg(""), 3000);
    });
  }

  function handleForcePaid() {
    if (!confirm("Force this tenant to start a 48h grace period? They will receive an email.")) return;
    startForcePaidTransition(async () => {
      try {
        await forcePaidGracePeriod(tenantId);
        setFreeMsg("48h grace period started");
      } catch {
        setFreeMsg("Failed to start grace period");
      }
      setTimeout(() => setFreeMsg(""), 3000);
    });
  }

  function handleSaveNotes() {
    startNotesPending(async () => {
      try {
        await saveTenantAdminNotes(tenantId, notes);
        setNotesMsg("Notes saved");
      } catch {
        setNotesMsg("Failed to save notes");
      }
      setTimeout(() => setNotesMsg(""), 3000);
    });
  }

  function handleGenerateRecoveryLink() {
    setRecoveryError(null);
    setRecoveryLink(null);
    setRecoveryCopied(false);
    startRecoveryTransition(async () => {
      const res = await adminGenerateRecoveryLink({
        targetEmail: recoveryEmail,
        tenantId,
      });
      if (res.error) {
        setRecoveryError(res.error);
        return;
      }
      if (res.link) {
        setRecoveryLink(res.link);
      }
    });
  }

  async function handleCopyRecoveryLink() {
    if (!recoveryLink) return;
    try {
      await navigator.clipboard.writeText(recoveryLink);
      setRecoveryCopied(true);
      setTimeout(() => setRecoveryCopied(false), 2000);
    } catch {
      // Clipboard API can fail in non-secure contexts — fall back to
      // selection so the admin can still cmd/ctrl-C manually.
      const ta = document.getElementById("recovery-link-textarea") as HTMLTextAreaElement | null;
      ta?.select();
    }
  }

  function handleDelete() {
    if (!confirm("Are you sure? This will soft-delete the tenant and cancel their subscription.")) return;
    startDeleteTransition(async () => {
      try {
        await deleteTenant(tenantId);
        router.push("/admin/tenants");
      } catch {
        setFreeMsg("Failed to delete tenant");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6 shadow-sm">
      <h2 className="text-base font-semibold text-stone-900">Actions</h2>

      {/* Free Forever badges */}
      {isFreeForever && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800 font-medium">
          ✓ Free Forever Account
        </div>
      )}
      {gracePeriodEndsAt && (() => {
        const end = new Date(gracePeriodEndsAt);
        const diffMs = end.getTime() - Date.now();
        const diffHrs = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
        const diffDays = Math.floor(diffHrs / 24);
        const remHrs = diffHrs % 24;
        const expired = diffMs <= 0;
        return (
          <div className={`rounded-lg px-3 py-2.5 text-sm border ${expired ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
            <p className="font-semibold">{expired ? "⛔ Grace period expired" : "⏳ Grace period active"}</p>
            {!expired && (
              <p className="text-xs mt-0.5">
                {diffDays > 0 ? `${diffDays}d ${remHrs}h` : `${diffHrs}h`} remaining (ends {end.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})
              </p>
            )}
            {expired && (
              <p className="text-xs mt-0.5">Ended {end.toLocaleString("en-AU")}</p>
            )}
          </div>
        );
      })()}

      {/* Change Plan */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-600">Change Plan</label>
        <div className="flex gap-2">
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
          >
            <option value="boutique">Boutique</option>
            <option value="studio">Studio</option>
            <option value="atelier">Atelier</option>
            <option value="group">Legacy Group</option>
          </select>
          <button
            onClick={handlePlanSave}
            disabled={planPending}
            className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-60"
          >
            {planPending ? "Saving…" : "Save"}
          </button>
        </div>
        {planMsg && (
          <p className={`text-xs ${planMsg.includes("Failed") ? "text-red-500" : "text-emerald-600"}`}>
            {planMsg}
          </p>
        )}
      </div>

      {/* Change Status */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-600">Change Status</label>
        {pendingAction === "confirm_suspend" ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-3">
            <p className="text-sm text-red-800">
              Suspend <strong>{ownerEmail || "this tenant"}</strong>? They&apos;ll lose access immediately.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPendingAction(null);
                  setStatus(currentStatus);
                }}
                className="flex-1 px-3 py-2 bg-white border border-stone-200 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusSave}
                disabled={statusPending}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {statusPending ? "Suspending…" : "Confirm Suspend"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            >
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
              <option value="suspended">Suspended</option>
              <option value="free">Free</option>
            </select>
            <button
              onClick={handleStatusSave}
              disabled={statusPending}
              className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-60"
            >
              {statusPending ? "Saving…" : "Save"}
            </button>
          </div>
        )}
        {statusMsg && (
          <p className={`text-xs ${statusMsg.includes("Failed") ? "text-red-500" : "text-emerald-600"}`}>
            {statusMsg}
          </p>
        )}
      </div>

      {/* Extend Trial */}
      <div className="space-y-2 p-3 bg-stone-50 rounded-lg border border-stone-100">
        <label className="text-sm font-medium text-stone-600">Extend Trial</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="relative">
              <input
                type="number"
                min="1"
                max="365"
                value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)}
                className="w-full pl-3 pr-12 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
              <span className="absolute right-3 top-2 text-xs text-stone-400">days</span>
            </div>
            <p className="text-[10px] text-stone-500 mt-1">New trial end: {newTrialEnd}</p>
          </div>
          <button
            onClick={handleExtendTrial}
            disabled={trialPending}
            className="px-4 py-2 h-fit bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-60"
          >
            {trialPending ? "…" : "Extend"}
          </button>
        </div>
        {trialMsg && (
          <p className={`text-xs ${trialMsg.includes("Failed") ? "text-red-500" : "text-emerald-600"}`}>
            {trialMsg}
          </p>
        )}
      </div>

      {/* Free Forever + Force Paid */}
      <div className="flex gap-2">
        <button
          onClick={handleAssignFree}
          disabled={freePending || isFreeForever}
          className="flex-1 px-3 py-2 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 transition-colors disabled:opacity-50"
        >
          {freePending ? "…" : "✓ Assign Free"}
        </button>
        <button
          onClick={handleForcePaid}
          disabled={forcePaidPending}
          className="flex-1 px-3 py-2 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors disabled:opacity-50"
        >
          {forcePaidPending ? "…" : "⏰ Force Paid (48h)"}
        </button>
      </div>
      {freeMsg && (
        <p className={`text-xs ${freeMsg.includes("Failed") ? "text-red-500" : "text-emerald-600"}`}>
          {freeMsg}
        </p>
      )}

      {/* Admin Notes */}
      <div className="space-y-2 pt-2 border-t border-stone-200">
        <label className="text-sm font-medium text-stone-600">Admin Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Internal notes about this tenant…"
          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/20 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSaveNotes}
            disabled={notesPending}
            className="flex-1 px-3 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-60"
          >
            {notesPending ? "Saving…" : "Save Notes"}
          </button>
          {ownerEmail && (
            <a
              href={`mailto:${ownerEmail}`}
              className="px-3 py-2 border border-stone-200 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-50 text-center"
            >
              Email →
            </a>
          )}
        </div>
        {notesMsg && (
          <p className={`text-xs ${notesMsg.includes("Failed") ? "text-red-500" : "text-emerald-600"}`}>
            {notesMsg}
          </p>
        )}
      </div>

      {/* Recovery link (PR #202 — prod hotfix while /auth/v1/recover 500s) */}
      <div className="space-y-2 pt-2 border-t border-stone-200">
        <label className="text-sm font-medium text-stone-600">Generate password reset link</label>
        <p className="text-[11px] text-stone-500 leading-snug">
          Use only when normal /forgot-password is broken. Link bypasses email delivery — share with the verified account holder via secure channel.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={recoveryEmail}
            onChange={(e) => {
              setRecoveryEmail(e.target.value);
              // Clear any previously-generated link when the target
              // email changes — never let a stale link drift onto a
              // different account.
              if (recoveryLink) setRecoveryLink(null);
              if (recoveryError) setRecoveryError(null);
            }}
            placeholder="user@example.com"
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
          />
          <button
            onClick={handleGenerateRecoveryLink}
            disabled={recoveryPending || !recoveryEmail.trim()}
            className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-60"
          >
            {recoveryPending ? "Generating…" : "Generate"}
          </button>
        </div>
        {recoveryError && (
          <p className="text-xs text-red-500">{recoveryError}</p>
        )}
        {recoveryLink && (
          <div className="space-y-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-900 leading-snug">
              ⚠️ This link bypasses email delivery. Use only when normal /forgot-password is broken. Treat the URL as a credential — only share with the verified account holder via secure channel.
            </div>
            <textarea
              id="recovery-link-textarea"
              value={recoveryLink}
              readOnly
              rows={4}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs font-mono text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/20 resize-none break-all"
            />
            <button
              onClick={handleCopyRecoveryLink}
              className="w-full px-3 py-2 border border-stone-200 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
            >
              {recoveryCopied ? "✓ Copied" : "Copy link"}
            </button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="pt-2 border-t border-red-100">
        <button
          onClick={handleDelete}
          disabled={deletePending}
          className="w-full px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {deletePending ? "Deleting…" : "🗑 Delete Tenant"}
        </button>
      </div>
    </div>
  );
}
