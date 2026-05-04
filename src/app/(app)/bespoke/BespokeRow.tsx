"use client";

import { memo } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

type Customer = { id: string; full_name: string | null } | null;

export interface BespokeRowData {
  id: string;
  job_number: string;
  title: string;
  stage: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  customers: Customer;
}

// Stage label + Nexpura badge variant (success / warning / danger / neutral).
const STAGE_BADGE_PROPS: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  enquiry:           { label: "Enquiry",          variant: "neutral" },
  consultation:      { label: "Consultation",     variant: "warning" },
  deposit_received:  { label: "Deposit Received", variant: "warning" },
  stone_sourcing:    { label: "Stone Sourcing",   variant: "warning" },
  cad:               { label: "CAD",              variant: "warning" },
  approval:          { label: "Approval",         variant: "warning" },
  setting:           { label: "Setting",          variant: "warning" },
  polish:            { label: "Polish",           variant: "warning" },
  ready:             { label: "Ready",            variant: "success" },
  collected:         { label: "Collected",        variant: "success" },
  cancelled:         { label: "Cancelled",        variant: "danger"  },
};
const DEFAULT_BADGE = { label: "Unknown", variant: "neutral" as const };

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

// Loose visual progress for milestones (per-stage). Keeps it simple — no extra
// data needed; just a sense of how far along the bespoke piece is.
const STAGE_PROGRESS: Record<string, number> = {
  enquiry: 5,
  consultation: 15,
  deposit_received: 25,
  stone_sourcing: 40,
  cad: 55,
  approval: 65,
  setting: 80,
  polish: 92,
  ready: 100,
  collected: 100,
  cancelled: 0,
};

function isOverdue(due_date: string | null, stage: string): boolean {
  if (!due_date) return false;
  if (["ready", "collected", "cancelled"].includes(stage)) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function BespokeRowInner({ job }: { job: BespokeRowData }) {
  const badge = STAGE_BADGE_PROPS[job.stage] ?? DEFAULT_BADGE;
  const name = job.customers?.full_name || "Unknown customer";
  const overdue = isOverdue(job.due_date, job.stage);
  const dueText = job.due_date ? DATE_FMT.format(new Date(job.due_date)) : null;
  const progress = STAGE_PROGRESS[job.stage] ?? 0;
  const badgeClass =
    badge.variant === "success" ? "nx-badge-success" :
    badge.variant === "warning" ? "nx-badge-warning" :
    badge.variant === "danger"  ? "nx-badge-danger"  :
                                  "nx-badge-neutral";

  return (
    <Link
      href={`/bespoke/${job.id}`}
      className="group block bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2.5">
            <span className="font-mono text-xs text-stone-400 tabular-nums">
              {job.job_number || "—"}
            </span>
            <span className={badgeClass}>{badge.label}</span>
            {overdue && <span className="nx-badge-danger">Overdue</span>}
          </div>

          <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
            {job.title || "Untitled piece"}
          </h3>
          <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
            For {name}
          </p>

          {/* Milestone / progress bar — emerald fill once the piece reaches
              ready / collected, bronze otherwise. */}
          <div className="mt-5 max-w-md">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-2 tabular-nums">
              <span>Workshop progress</span>
              <span className="text-stone-700 font-medium">{progress}%</span>
            </div>
            <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  progress >= 100 ? "bg-emerald-500" : "bg-nexpura-bronze"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
              Due
            </p>
            <p
              className={`font-serif text-2xl leading-none tracking-tight tabular-nums ${
                overdue ? "text-red-600" : "text-stone-900"
              }`}
            >
              {dueText ?? "—"}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300">
            View
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export const BespokeRow = memo(BespokeRowInner);
