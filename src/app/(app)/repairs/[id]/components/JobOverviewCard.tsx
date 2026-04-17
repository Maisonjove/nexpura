"use client";

import Link from "next/link";
import type { Repair } from "./types";
import { REPAIR_STAGES, STAGE_COLORS } from "./constants";

interface JobOverviewCardProps {
  repair: Repair;
  readOnly?: boolean;
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  urgent: { bg: "bg-red-50", text: "text-red-700" },
  high: { bg: "bg-amber-50", text: "text-amber-700" },
  normal: { bg: "bg-stone-100", text: "text-stone-600" },
  low: { bg: "bg-stone-50", text: "text-stone-500" },
};

export default function JobOverviewCard({ repair, readOnly }: JobOverviewCardProps) {
  const sc = STAGE_COLORS[repair.stage] ?? STAGE_COLORS.intake;
  const priorityStyle = PRIORITY_STYLES[repair.priority] ?? PRIORITY_STYLES.normal;
  const isTerminal = ["collected", "cancelled"].includes(repair.stage);
  const isOverdue = repair.due_date && new Date(repair.due_date) < new Date(new Date().toDateString()) && !isTerminal;
  
  const intakeDate = repair.created_at 
    ? new Date(repair.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";
  
  const dueDate = repair.due_date
    ? new Date(repair.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Job Overview</h2>
        {!readOnly && (
          <Link 
            href={`/repairs/${repair.id}/edit`} 
            className="text-xs font-medium text-stone-500 hover:text-stone-700 border border-stone-200 px-2.5 py-1 rounded-lg transition-colors"
          >
            Edit
          </Link>
        )}
      </div>

      {/* Repair Number */}
      <p className="font-mono text-xl font-bold text-stone-900 mb-4">{repair.repair_number}</p>

      {/* Job Type + Priority Pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full capitalize">
          {repair.item_type}
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${priorityStyle.bg} ${priorityStyle.text}`}>
          {repair.priority}
        </span>
      </div>

      {/* Key Dates */}
      <div className="space-y-2.5 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-stone-500">Due Date</span>
          <span className={`text-sm font-medium ${isOverdue ? "text-red-600" : "text-stone-900"}`}>
            {isOverdue && "⚠ "}{dueDate}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-stone-500">Intake Date</span>
          <span className="text-sm text-stone-700">{intakeDate}</span>
        </div>
      </div>

      {/* Stage Badge */}
      <div className="pt-3 border-t border-stone-100">
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${sc.bg} ${sc.text}`}>
          <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
          {REPAIR_STAGES.find(s => s.key === repair.stage)?.label ?? repair.stage}
        </span>
      </div>
    </div>
  );
}
