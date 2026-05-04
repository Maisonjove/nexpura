"use client";

import { memo } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

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

// Module-level stage-badge map. Built once at module load — avoids the
// per-row recreation cost of an inline switch / object literal.
//
// Colour restraint: only two stages get a coloured badge — `ready`
// (success / emerald) and `cancelled` (danger / oxblood). Everything
// else uses the quiet neutral pill so a pipeline with mixed work doesn't
// look like a riot of amber. Status meaning still comes through clearly
// from the *label* itself.
const STAGE_BADGE_PROPS: Record<string, { label: string; className: string }> = {
  intake:        { label: "Booked-In",   className: "nx-badge-neutral" },
  assessed:      { label: "Assessed",    className: "nx-badge-neutral" },
  quoted:        { label: "Quoted",      className: "nx-badge-neutral" },
  approved:      { label: "Approved",    className: "nx-badge-neutral" },
  in_progress:   { label: "In Progress", className: "nx-badge-neutral" },
  quality_check: { label: "Quality Check", className: "nx-badge-neutral" },
  ready:         { label: "Ready",       className: "nx-badge-success" },
  collected:     { label: "Completed",   className: "nx-badge-success" },
  cancelled:     { label: "Cancelled",   className: "nx-badge-danger"  },
};
const DEFAULT_BADGE = { label: "Unknown", className: "nx-badge-neutral" };

// Cheap singleton formatter (avoid re-constructing Intl.DateTimeFormat per row).
const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function isOverdue(due_date: string | null, stage: string): boolean {
  if (!due_date) return false;
  if (stage === "collected" || stage === "cancelled" || stage === "ready") return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function RepairRowInner({ repair }: { repair: RepairRowData }) {
  const badge = STAGE_BADGE_PROPS[repair.stage] ?? DEFAULT_BADGE;
  const name = repair.customers?.full_name || "Unknown";
  const overdue = isOverdue(repair.due_date, repair.stage);
  const dueText = repair.due_date ? DATE_FMT.format(new Date(repair.due_date)) : "—";

  return (
    <Link
      href={`/repairs/${repair.id}`}
      className="group block bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1.4fr_1.6fr_1fr_1fr_auto] gap-4 md:items-center">
        {/* Repair # */}
        <div>
          <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
            Repair #
          </p>
          <span className="font-mono text-sm text-nexpura-bronze group-hover:text-nexpura-bronze-hover transition-colors duration-200 tabular-nums">
            {repair.repair_number ?? repair.id.slice(0, 8)}
          </span>
        </div>

        {/* Customer */}
        <div>
          <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
            Customer
          </p>
          <p className="text-sm font-medium text-stone-900 truncate">{name}</p>
        </div>

        {/* Item & Issue */}
        <div className="min-w-0">
          <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
            Item
          </p>
          <p className="font-serif text-base text-stone-900 leading-snug tracking-tight truncate">
            {repair.item_type}
          </p>
          <p className="text-xs text-stone-500 mt-1 truncate leading-relaxed">
            {repair.item_description}
          </p>
        </div>

        {/* Status */}
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1 w-full">
            Status
          </p>
          <span className={badge.className}>{badge.label}</span>
          {overdue && <span className="nx-badge-danger">Overdue</span>}
        </div>

        {/* Due / ETA */}
        <div>
          <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
            ETA
          </p>
          <p
            className={`text-sm tabular-nums ${
              overdue ? "text-nexpura-oxblood font-medium" : "text-stone-700"
            }`}
          >
            {dueText}
          </p>
        </div>

        {/* Arrow */}
        <div className="flex md:justify-end">
          <ArrowRightIcon className="w-4 h-4 text-stone-400 group-hover:text-nexpura-bronze group-hover:translate-x-0.5 transition-all duration-300" />
        </div>
      </div>
    </Link>
  );
}

// Memoized: a row only re-renders when its `repair` prop identity changes.
// Repair objects come straight from server-rendered props and are stable
// across re-renders (tab filter just reslices a stable array).
export const RepairRow = memo(RepairRowInner);
