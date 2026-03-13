"use client";

import { useState, useTransition } from "react";
import { changeTenantPlan, changeTenantStatus, assignFreeForever, forcePaidGracePeriod } from "@/app/(admin)/actions";

interface TenantActionsProps {
  tenantId: string;
  currentPlan: string;
  currentStatus: string;
  isFreeForever?: boolean;
  gracePeriodEndsAt?: string | null;
}

export default function TenantActions({
  tenantId,
  currentPlan,
  currentStatus,
  isFreeForever = false,
  gracePeriodEndsAt,
}: TenantActionsProps) {
  const [plan, setPlan] = useState(currentPlan);
  const [status, setStatus] = useState(currentStatus);
  const [planPending, startPlanTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();
  const [freePending, startFreeTransition] = useTransition();
  const [forcePaidPending, startForcePaidTransition] = useTransition();
  const [planMsg, setPlanMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [freeMsg, setFreeMsg] = useState("");

  function handlePlanSave() {
    startPlanTransition(async () => {
      try {
        await changeTenantPlan(tenantId, plan as "basic" | "pro" | "ultimate");
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

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">
      <h2 className="text-base font-semibold text-stone-900">Actions</h2>

      {/* Free Forever badges */}
      {isFreeForever && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800 font-medium">
          ✓ Free Forever Account
        </div>
      )}
      {gracePeriodEndsAt && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
          Grace period ends: {new Date(gracePeriodEndsAt).toLocaleString("en-AU")}
        </div>
      )}

      {/* Change Plan */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-900/70">Change Plan</label>
        <div className="flex gap-2">
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
          >
            <option value="basic">Basic ($49/mo)</option>
            <option value="pro">Pro ($99/mo)</option>
            <option value="ultimate">Ultimate ($199/mo)</option>
          </select>
          <button
            onClick={handlePlanSave}
            disabled={planPending}
            className="px-4 py-2 bg-[#8B7355] text-white rounded-lg text-sm font-medium hover:bg-[#7A6347] transition-colors disabled:opacity-60"
          >
            {planPending ? "Saving…" : "Save"}
          </button>
        </div>
        {planMsg && (
          <p className={`text-xs ${planMsg.includes("Failed") ? "text-red-500" : "text-[#8B7355]"}`}>
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
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
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
            className="px-4 py-2 bg-[#8B7355] text-white rounded-lg text-sm font-medium hover:bg-[#7A6347] transition-colors disabled:opacity-60"
          >
            {statusPending ? "Saving…" : "Save"}
          </button>
        </div>
        {statusMsg && (
          <p className={`text-xs ${statusMsg.includes("Failed") ? "text-red-500" : "text-[#8B7355]"}`}>
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
        <p className={`text-xs ${freeMsg.includes("Failed") ? "text-red-500" : "text-[#8B7355]"}`}>
          {freeMsg}
        </p>
      )}
    </div>
  );
}
