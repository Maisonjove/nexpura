"use client";

import type { Repair } from "./types";

interface WorkflowActionsCardProps {
  repair: Repair;
  isPending: boolean;
  onStageChange: (stage: string) => void;
}

export default function WorkflowActionsCard({
  repair,
  isPending,
  onStageChange,
}: WorkflowActionsCardProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Workflow Actions</h2>
      <div className="space-y-2">
        {repair.stage !== "ready" && (
          <button
            onClick={() => onStageChange("ready")}
            disabled={isPending}
            className="w-full text-sm font-medium bg-amber-700 text-white px-4 py-2.5 rounded-lg hover:bg-amber-700 transition-colors text-left disabled:opacity-50"
          >
            ✓ Mark Ready for Pickup
          </button>
        )}
        {repair.stage === "ready" && (
          <button
            onClick={() => onStageChange("collected")}
            disabled={isPending}
            className="w-full text-sm font-medium bg-stone-900 text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition-colors text-left disabled:opacity-50"
          >
            ✓ Mark Collected
          </button>
        )}
        {repair.stage !== "in_progress" && repair.stage !== "ready" && (
          <button
            onClick={() => onStageChange("in_progress")}
            disabled={isPending}
            className="w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors text-left disabled:opacity-50"
          >
            🔧 Mark In Progress
          </button>
        )}
      </div>
    </div>
  );
}
