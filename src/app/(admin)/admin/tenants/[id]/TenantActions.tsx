"use client";

import { useState, useTransition } from "react";
import { changeTenantPlan, changeTenantStatus, assignFreeForever, forcePaidGracePeriod, saveTenantAdminNotes, deleteTenant } from "@/app/(admin)/actions";
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
  const [notes, setNotes] = useState(adminNotes ?? "");
  const [planPending, startPlanTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();
  const [freePending, startFreeTransition] = useTransition();
  const [forcePaidPending, startForcePaidTransition] = useTransition();
  const [notesPending, startNotesPending] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [planMsg, setPlanMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [freeMsg, setFreeMsg] = useState("");
  const [notesMsg, setNotesMsg] = useState("");

  function handlePlanSave() {
    startPlanTransition(async () => {
      try {
        await changeTenantPlan(tenantId, plan as "boutique" | "studio" | "group");
        setPlanMsg("Plan updated successfully");
      } catch {
        setPlanMsg("Failed to update plan");
      }
      setTimeout(() => setPlanMsg(""), 3000);
    });
  }

  function handleStatusSave() {
    startStatusTransition(async () => {
      try {
        await changeTenantStatus(tenantId, status as "trialing" | "active" | "past_due" | "canceled" | "suspended" | "free");
        setStatusMsg("Status updated successfully");
      } catch {
        setStatusMsg("Failed to update status");
      }
      setTimeout(() => setStatusMsg(""), 3000);
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
    <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">
      <h2 className="text-base font-semibold text-stone-900">Actions</h2>

      {/* Free Forever badges */}
      {isFreeForever && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800 font-medium">
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
        <label className="text-sm font-medium text-stone-900/70">Change Plan</label>
        <div className="flex gap-2">
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30"
          >
            <option value="boutique">Boutique ($89/mo)</option>
            <option value="studio">Studio ($179/mo)</option>
            <option value="group">Group (Custom)</option>
          </select>
          <button
            onClick={handlePlanSave}
            disabled={planPending}
            className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors disabled:opacity-60"
          >
            {planPending ? "Saving…" : "Save"}
          </button>
        </div>
        {planMsg && (
          <p className={`text-xs ${planMsg.includes("Failed") ? "text-red-500" : "text-amber-700"}`}>
            {planMsg}
          </p>
        )}
      </div>

      {/* Change Status */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-900/70">Change Status</label>
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30"
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
            className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors disabled:opacity-60"
          >
            {statusPending ? "Saving…" : "Save"}
          </button>
        </div>
        {statusMsg && (
          <p className={`text-xs ${statusMsg.includes("Failed") ? "text-red-500" : "text-amber-700"}`}>
            {statusMsg}
          </p>
        )}
      </div>

      {/* Free Forever + Force Paid */}
      <div className="flex gap-2">
        <button
          onClick={handleAssignFree}
          disabled={freePending || isFreeForever}
          className="flex-1 px-3 py-2 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          {freePending ? "…" : "✓ Assign Free"}
        </button>
        <button
          onClick={handleForcePaid}
          disabled={forcePaidPending}
          className="flex-1 px-3 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors disabled:opacity-50"
        >
          {forcePaidPending ? "…" : "⏰ Force Paid (48h)"}
        </button>
      </div>
      {freeMsg && (
        <p className={`text-xs ${freeMsg.includes("Failed") ? "text-red-500" : "text-amber-700"}`}>
          {freeMsg}
        </p>
      )}

      {/* Admin Notes */}
      <div className="space-y-2 pt-2 border-t border-stone-200">
        <label className="text-sm font-medium text-stone-900/70">Admin Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Internal notes about this tenant…"
          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSaveNotes}
            disabled={notesPending}
            className="flex-1 px-3 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-60"
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
          <p className={`text-xs ${notesMsg.includes("Failed") ? "text-red-500" : "text-amber-700"}`}>
            {notesMsg}
          </p>
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
