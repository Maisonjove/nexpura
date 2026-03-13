"use client";

import { useState, useTransition } from "react";
import { changeTenantPlan, changeTenantStatus } from "@/app/(admin)/actions";

interface TenantActionsProps {
  tenantId: string;
  currentPlan: string;
  currentStatus: string;
}

export default function TenantActions({
  tenantId,
  currentPlan,
  currentStatus,
}: TenantActionsProps) {
  const [plan, setPlan] = useState(currentPlan);
  const [status, setStatus] = useState(currentStatus);
  const [planPending, startPlanTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();
  const [planMsg, setPlanMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

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
        await changeTenantStatus(tenantId, status as "trialing" | "active" | "past_due" | "canceled");
        setStatusMsg("Status updated successfully");
      } catch {
        setStatusMsg("Failed to update status");
      }
      setTimeout(() => setStatusMsg(""), 3000);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">
      <h2 className="text-base font-semibold text-stone-900 font-semibold">Actions</h2>

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
    </div>
  );
}
