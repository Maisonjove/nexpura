"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

type Customer = { id: string; full_name: string | null } | null;

interface BespokeJob {
  id: string;
  job_number: string;
  title: string;
  stage: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  customers: Customer;
}

interface Props {
  jobs: BespokeJob[];
  view: string;
  q: string;
  stageFilter: string;
}

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

export const ALL_STAGES = [
  { key: "enquiry", label: "Enquiry" },
  { key: "quote_sent", label: "Quote Sent" },
  { key: "approved", label: "Approved" },
  { key: "deposit_paid", label: "Deposit Paid" },
  { key: "stone_sourcing", label: "Stone Sourcing" },
  { key: "cad", label: "CAD" },
  { key: "cad_approved", label: "CAD Approved" },
  { key: "casting", label: "Casting" },
  { key: "setting", label: "Setting" },
  { key: "polishing", label: "Polishing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const PRIORITY_COLOURS: Record<string, string> = {
  low: "bg-forest/20 text-forest/70",
  normal: "bg-sage/20 text-sage",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-600",
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-forest/40",
  normal: "bg-sage",
  high: "bg-amber-400",
  urgent: "bg-red-500",
};

const STAGE_COLOURS: Record<string, string> = {
  enquiry: "text-blue-600",
  quote_sent: "text-purple-600",
  approved: "text-green-600",
  deposit_paid: "text-teal-600",
  stone_sourcing: "text-yellow-600",
  cad: "text-orange-500",
  cad_approved: "text-orange-600",
  casting: "text-red-500",
  setting: "text-pink-600",
  polishing: "text-indigo-500",
  ready: "text-sage",
  completed: "text-forest",
  cancelled: "text-forest/40",
};

const STAGE_DOT: Record<string, string> = {
  enquiry: "bg-blue-400",
  quote_sent: "bg-purple-400",
  approved: "bg-green-400",
  deposit_paid: "bg-teal-400",
  stone_sourcing: "bg-yellow-400",
  cad: "bg-orange-400",
  cad_approved: "bg-orange-500",
  casting: "bg-red-400",
  setting: "bg-pink-400",
  polishing: "bg-indigo-400",
  ready: "bg-sage",
  completed: "bg-forest",
  cancelled: "bg-forest/30",
};

// Pipeline column groups
const PIPELINE_COLUMNS = [
  {
    key: "enquiry_group",
    label: "Enquiry",
    stages: ["enquiry", "quote_sent"],
    accent: "border-blue-200",
    headerBg: "bg-blue-50",
    headerText: "text-blue-700",
  },
  {
    key: "approved_group",
    label: "Approved",
    stages: ["approved"],
    accent: "border-green-200",
    headerBg: "bg-green-50",
    headerText: "text-green-700",
  },
  {
    key: "in_progress_group",
    label: "In Progress",
    stages: ["deposit_paid", "stone_sourcing", "cad", "cad_approved", "casting", "setting", "polishing"],
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
    key: "completed_group",
    label: "Completed",
    stages: ["completed", "cancelled"],
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
    <span className={`inline-flex items-center gap-1 text-xs font-medium capitalize ${PRIORITY_COLOURS[priority] || PRIORITY_COLOURS.normal} px-2 py-0.5 rounded-full`}>
      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[priority] || PRIORITY_DOT.normal}`} />
      {priority}
    </span>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const label = ALL_STAGES.find((s) => s.key === stage)?.label || stage;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${STAGE_COLOURS[stage] || "text-forest/60"}`}>
      <span className={`w-2 h-2 rounded-full ${STAGE_DOT[stage] || "bg-forest/30"}`} />
      {label}
    </span>
  );
}

function isOverdue(due_date: string | null) {
  if (!due_date) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function PipelineCard({ job }: { job: BespokeJob }) {
  const overdue = isOverdue(job.due_date);
  return (
    <Link href={`/bespoke/${job.id}`}>
      <div className="bg-white border border-platinum rounded-xl p-4 hover:border-sage/40 hover:shadow-sm transition-all cursor-pointer group">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-forest group-hover:text-sage transition-colors leading-snug">
            {job.title}
          </p>
          <PriorityBadge priority={job.priority} />
        </div>
        {job.customers && (
          <p className="text-xs text-forest/50 mb-2">
            {job.customers.full_name}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-forest/40">{job.job_number}</span>
          {job.due_date && (
            <span className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-forest/40"}`}>
              {overdue ? "⚠ " : ""}
              {new Date(job.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
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

export default function BespokeListClient({ jobs, view, q, stageFilter }: Props) {
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
        <h1 className="font-fraunces text-2xl font-semibold text-forest">Bespoke Jobs</h1>
        <Link
          href="/bespoke/new"
          className="inline-flex items-center gap-2 bg-sage text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-sage/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Job
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

        {/* Search + filter (list view only) */}
        {view === "list" && (
          <div className="flex gap-2 flex-1 max-w-lg">
            <form onSubmit={handleSearch} className="flex-1 relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search jobs…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-platinum rounded-lg text-forest placeholder-forest/40 focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </form>
            <select
              value={stageFilter}
              onChange={(e) => updateParams({ stage: e.target.value, view })}
              className="text-sm bg-white border border-platinum rounded-lg px-3 py-2 text-forest focus:outline-none focus:border-sage"
            >
              <option value="">All stages</option>
              {ALL_STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {view === "pipeline" ? (
        <PipelineView jobs={jobs} />
      ) : (
        <ListView jobs={jobs} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Pipeline View
// ────────────────────────────────────────────────────────────────

function PipelineView({ jobs }: { jobs: BespokeJob[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => col.stages.includes(j.stage));
        return (
          <div key={col.key} className={`flex-shrink-0 w-64 border ${col.accent} rounded-xl overflow-hidden`}>
            {/* Column header */}
            <div className={`${col.headerBg} px-4 py-3 flex items-center justify-between`}>
              <span className={`text-sm font-semibold ${col.headerText}`}>{col.label}</span>
              <span className={`text-xs font-bold ${col.headerText} bg-white/60 rounded-full px-2 py-0.5`}>
                {colJobs.length}
              </span>
            </div>
            {/* Cards */}
            <div className="bg-ivory p-3 space-y-2 min-h-[200px]">
              {colJobs.length === 0 ? (
                <p className="text-xs text-forest/30 text-center py-8">No jobs</p>
              ) : (
                colJobs.map((job) => <PipelineCard key={job.id} job={job} />)
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

function ListView({ jobs }: { jobs: BespokeJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="bg-white border border-platinum rounded-xl p-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sage/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <h3 className="font-fraunces text-lg font-semibold text-forest">No jobs yet</h3>
        <p className="text-forest/50 mt-1 text-sm">Create your first bespoke job to get started.</p>
        <Link
          href="/bespoke/new"
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create your first bespoke job
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-platinum rounded-xl overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-platinum">
            <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-5 py-3">Job #</th>
            <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">Customer</th>
            <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">Title</th>
            <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">Stage</th>
            <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">Due</th>
            <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">Priority</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-platinum">
          {jobs.map((job) => {
            const overdue = isOverdue(job.due_date);
            return (
              <tr key={job.id} className="hover:bg-ivory/60 transition-colors">
                <td className="px-5 py-3 text-xs font-mono text-forest/60">{job.job_number}</td>
                <td className="px-4 py-3 text-sm text-forest/70">
                  {job.customers?.full_name || <span className="text-forest/30">—</span>}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-forest">{job.title}</td>
                <td className="px-4 py-3">
                  <StageBadge stage={job.stage} />
                </td>
                <td className="px-4 py-3 text-sm">
                  {job.due_date ? (
                    <span className={overdue ? "text-red-500 font-medium" : "text-forest/60"}>
                      {overdue ? "⚠ " : ""}
                      {new Date(job.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  ) : (
                    <span className="text-forest/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={job.priority} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/bespoke/${job.id}`}
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
  );
}
