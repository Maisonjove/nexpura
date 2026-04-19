"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight } from "lucide-react";

type Customer = { id: string; full_name: string | null } | null;

export interface RepairRowData {
  id: string;
  repair_number: string;
  item_type: string;
  item_description: string;
  repair_type: string;
  stage: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  customers: Customer;
}

// Module-level stage-badge map. Previously `getStatusBadge` was a nested
// function inside the main client — recreated on every render + running
// through a 10-case switch per row. The map is built once at module load.
const STAGE_BADGE_PROPS: Record<string, { label: string; className: string }> = {
  intake: { label: "Intake", className: "bg-stone-100 text-stone-600 hover:bg-stone-100 border border-stone-200" },
  assessed: { label: "Assessed", className: "bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200" },
  quoted: { label: "Quoted", className: "bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200" },
  approved: { label: "Approved", className: "bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200" },
  in_progress: { label: "In Progress", className: "bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200" },
  quality_check: { label: "Quality Check", className: "bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200" },
  ready: { label: "Ready", className: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200" },
  collected: { label: "Collected", className: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-700 hover:bg-red-50 border border-red-200" },
};
const DEFAULT_BADGE = { label: "Unknown", className: "bg-stone-100 text-stone-600 border border-stone-200" };

// Cheap singleton formatter (avoid re-constructing Intl.DateTimeFormat per row).
const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function formatInitials(name: string): string {
  const parts = name.split(" ");
  let result = "";
  for (const p of parts) if (p) result += p[0];
  return result.toUpperCase().slice(0, 2);
}

function isOverdue(due_date: string | null, stage: string): boolean {
  if (!due_date) return false;
  if (stage === "collected" || stage === "cancelled" || stage === "ready") return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function RepairRowInner({ repair }: { repair: RepairRowData }) {
  const router = useRouter();
  const badge = STAGE_BADGE_PROPS[repair.stage] ?? DEFAULT_BADGE;
  const name = repair.customers?.full_name || "Unknown";
  const overdue = isOverdue(repair.due_date, repair.stage);
  const dueText = repair.due_date ? DATE_FMT.format(new Date(repair.due_date)) : "—";

  return (
    <TableRow
      className="hover:bg-stone-50/60 border-stone-100 cursor-pointer"
      onClick={() => router.push(`/repairs/${repair.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-stone-100 text-stone-600 text-xs font-semibold">
              {formatInitials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-stone-900">{name}</span>
        </div>
      </TableCell>
      <TableCell>
        <p className="font-medium text-sm text-stone-900">{repair.item_type}</p>
        <p className="text-xs text-stone-400 mt-0.5">{repair.item_description}</p>
      </TableCell>
      <TableCell>
        <Badge className={badge.className}>{badge.label}</Badge>
      </TableCell>
      <TableCell className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-stone-700"}`}>
        {dueText}
      </TableCell>
      <TableCell className="text-sm text-stone-700">—</TableCell>
      <TableCell className="text-sm font-medium text-stone-900">—</TableCell>
      <TableCell>
        <ArrowRight className="w-4 h-4 text-stone-300 hover:text-amber-700" />
      </TableCell>
    </TableRow>
  );
}

// Memoized: a row only re-renders when its `repair` prop identity changes.
// Repair objects come straight from the server-rendered props and are
// stable across re-renders (tab filter just reslices a stable array).
export const RepairRow = memo(RepairRowInner);
