"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

type Customer = { id: string; full_name: string | null } | null;

export interface Repair {
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

interface Props {
  repairs: Repair[];
  view: string;
  q: string;
  stageFilter: string;
}

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

export const ALL_REPAIR_STAGES = [
  { key: "intake", label: "Intake" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "quality_check", label: "Quality Check" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
  { key: "cancelled", label: "Cancelled" },
];

const PRIORITY_COLOURS: Record<string, string> = {
  low: "bg-forest/10 text-forest/50",
  normal: "bg-sage/15 text-sage",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-600",
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-forest/30",
  normal: "bg-sage",
  high: "bg-amber-400",
  urgent: "bg-red-500",
};

const STAGE_COLOURS: Record<string, string> = {
  intake: "text-blue-600",
  assessed: "text-purple-600",
  quoted: "text-indigo-600",
  approved: "text-green-600",
  in_progress: "text-amber-600",
  quality_check: "text-orange-600",
  ready: "text-sage",
  collected: "text-forest",
  cancelled: "text-forest/40",
};

const STAGE_DOT: Record<string, string> = {
  intake: "bg-blue-400",
  assessed: "bg-purple-400",
  quoted: "bg-indigo-400",
  approved: "bg-green-400",
  in_progress: "bg-amber-400",
  quality_check: "bg-orange-400",
  ready: "bg-sage",
  collected: "bg-forest",
  cancelled: "bg-forest/30",
};

// Pipeline column groups
const PIPELINE_COLUMNS = [
  {
    key: "intake_group",
    label: "Intake",
    stages: ["intake"],
    accent: "border-blue-200",
    headerBg: "bg-blue-50",
    headerText: "text-blue-700",
  },
  {
    key: "assessed_group",
    label: "Assessed / Quoted",
    stages: ["assessed", "quoted", "approved"],
    accent: "border-purple-200",
    headerBg: "bg-purple-50",
    headerText: "text-purple-700",
  },
  {
    key: "in_progress_group",
    label: "In Progress",
    stages: ["in_progress", "quality_check"],
    accent: "border-amber-200",
    headerBg: "bg-amber-50",
    headerText: "text-amber-700",
  },
  {
    key: "ready_group",
    label: "Ready",
    stages: ["ready"],
    accent: "border-sage/30",
    headerBg: "bg-sage/5",
    headerText: "text-sage",
  },
  {
    key: "collected_group",
    label: "Collected",
    stages: ["collected", "cancelled"],
    accent: "border-forest/20",
    headerBg: "bg-forest/5",
    headerText: "text-forest/70",
  },
];

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium capitalize ${
        PRIORITY_COLOURS[priority] || PRIORITY_COLOURS.normal
      } px-2 py-0.5 rounded-full`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          PRIORITY_DOT[priority] || PRIORITY_DOT.normal
        }`}
      />
      {priority}
    </span>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const label =
    ALL_REPAIR_STAGES.find((s) => s.key === stage)?.label || stage;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        STAGE_COLOURS[stage] || "text-forest/60"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${STAGE_DOT[stage] || "bg-forest/30"}`}
      />
      {label}
    </span>
  );
}

function isOverdue(due_date: string | null, stage: string) {
  if (!due_date) return false;
  if (["collected", "cancelled"].includes(stage)) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function humaniseRepairType(val: string) {
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function PipelineCard({ repair }: { repair: Repair }) {
  const overdue = isOverdue(repair.due_date, repair.stage);
  return (
    <Link href={`/repairs/${repair.id}`}>
      <div className="bg-white border border-platinum rounded-xl p-4 hover:border-sage/40 hover:shadow-sm transition-all cursor-pointer group">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-forest group-hover:text-sage transition-colors leading-snug">
            {repair.item_type} — {repair.repair_type}
          </p>
          <PriorityBadge priority={repair.priority} />
        </div>
        {repair.customers && (
          <p className="text-xs text-forest/50 mb-2">
            {repair.customers.full_name}
          </p>
        )}
        <p className="text-xs text-forest/40 mb-2 line-clamp-1">
          {repair.item_description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-forest/40">
            {repair.repair_number}
          </span>
          {repair.due_date && (
            <span
              className={`text-xs ${
                overdue ? "text-red-500 font-medium" : "text-forest/40"
              }`}
            >
              {overdue ? "⚠ " : ""}
              {new Date(repair.due_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

export default function RepairsListClient({
  repairs,
  view,
  q,
  stageFilter,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(q);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (stageFilter) params.set("stage", stageFilter);
    if (view) params.set("view", view);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: search, view });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-fraunces text-2xl font-semibold text-forest">
          Repairs
        </h1>
        <Link
          href="/repairs/new"
          className="inline-flex items-center gap-2 bg-sage text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-sage/90 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Repair
        </Link>
      </div>

      {/* View toggle + search/filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Toggle */}
        <div className="flex items-center bg-white border border-platinum rounded-lg p-1">
          <button
            onClick={() => updateParams({ view: "pipeline" })}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
              view === "pipeline"
                ? "bg-forest text-white shadow-sm"
                : "text-forest/60 hover:text-forest"
            }`}
          >
            Pipeline
          </button>
          <button
            onClick={() => updateParams({ view: "list" })}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
              view === "list"
                ? "bg-forest text-white shadow-sm"
                : "text-forest/60 hover:text-forest"
            }`}
          >
            List
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex gap-2 flex-1 max-w-lg">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repairs…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-platinum rounded-lg text-forest placeholder-forest/40 focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </form>
          <select
            value={stageFilter}
            onChange={(e) => updateParams({ stage: e.target.value, view })}
            className="text-sm bg-white border border-platinum rounded-lg px-3 py-2 text-forest focus:outline-none focus:border-sage"
          >
            <option value="">All stages</option>
            {ALL_REPAIR_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {view === "pipeline" ? (
        <PipelineView repairs={repairs} />
      ) : (
        <ListView repairs={repairs} humaniseRepairType={humaniseRepairType} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Pipeline View
// ────────────────────────────────────────────────────────────────

function PipelineView({ repairs }: { repairs: Repair[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_COLUMNS.map((col) => {
        const colRepairs = repairs.filter((r) =>
          col.stages.includes(r.stage)
        );
        return (
          <div
            key={col.key}
            className={`flex-shrink-0 w-64 border ${col.accent} rounded-xl overflow-hidden`}
          >
            {/* Column header */}
            <div
              className={`${col.headerBg} px-4 py-3 flex items-center justify-between`}
            >
              <span className={`text-sm font-semibold ${col.headerText}`}>
                {col.label}
              </span>
              <span
                className={`text-xs font-bold ${col.headerText} bg-white/60 rounded-full px-2 py-0.5`}
              >
                {colRepairs.length}
              </span>
            </div>
            {/* Cards */}
            <div className="bg-ivory p-3 space-y-2 min-h-[200px]">
              {colRepairs.length === 0 ? (
                <p className="text-xs text-forest/30 text-center py-8">
                  No repairs
                </p>
              ) : (
                colRepairs.map((repair) => (
                  <PipelineCard key={repair.id} repair={repair} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// List View
// ────────────────────────────────────────────────────────────────

function ListView({
  repairs,
  humaniseRepairType,
}: {
  repairs: Repair[];
  humaniseRepairType: (v: string) => string;
}) {
  if (repairs.length === 0) {
    return (
      <div className="bg-white border border-platinum rounded-xl p-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sage/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="font-fraunces text-lg font-semibold text-forest">No repairs yet</h3>
        <p className="text-forest/50 mt-1 text-sm">Log your first repair to start tracking work.</p>
        <Link
          href="/repairs/new"
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Log your first repair
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-platinum rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-platinum">
              <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-5 py-3">
                Repair #
              </th>
              <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                Customer
              </th>
              <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                Item
              </th>
              <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                Repair Type
              </th>
              <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                Stage
              </th>
              <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                Due
              </th>
              <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                Priority
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-platinum">
            {repairs.map((repair) => {
              const overdue = isOverdue(repair.due_date, repair.stage);
              return (
                <tr
                  key={repair.id}
                  className="hover:bg-ivory/60 transition-colors"
                >
                  <td className="px-5 py-3 text-xs font-mono text-forest/60">
                    {repair.repair_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-forest/70">
                    {repair.customers?.full_name || (
                      <span className="text-forest/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-forest">
                    {repair.item_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-forest/70">
                    {humaniseRepairType(repair.repair_type)}
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={repair.stage} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {repair.due_date ? (
                      <span
                        className={
                          overdue
                            ? "text-red-500 font-medium"
                            : "text-forest/60"
                        }
                      >
                        {overdue ? "⚠ " : ""}
                        {new Date(repair.due_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    ) : (
                      <span className="text-forest/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={repair.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/repairs/${repair.id}`}
                      className="text-xs text-sage font-medium hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
