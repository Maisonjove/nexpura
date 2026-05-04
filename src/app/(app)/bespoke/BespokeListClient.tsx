"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  PlusIcon,
  BellIcon,
  SparklesIcon,
  XMarkIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import logger from "@/lib/logger";
import { BespokeRow } from "./BespokeRow";
import BespokeKanban from "./BespokeKanban";
import { useProgressiveRender } from "@/lib/useProgressiveRender";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  /** Precomputed tenant-wide stage counts. Null on first-ever visit. */
  precomputedStageCounts?: Record<string, number> | null;
  /** Precomputed tenant-wide overdue count (non-ready non-completed). */
  precomputedOverdueCount?: number | null;
  /** When true, skip the h1 + primary-action block (rendered by page shell). */
  hideTitleBlock?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const ALL_STAGES = [
  { key: "all", label: "All" },
  { key: "enquiry", label: "Enquiry" },
  { key: "consultation", label: "Consultation" },
  { key: "deposit_received", label: "Deposit Received" },
  { key: "stone_sourcing", label: "Stone Sourcing" },
  { key: "cad", label: "CAD" },
  { key: "approval", label: "Approval" },
  { key: "setting", label: "Setting" },
  { key: "polish", label: "Polish" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
  { key: "cancelled", label: "Cancelled" },
];

// isOverdue / getInitials now live in ./BespokeRow.tsx (used per-row).

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BespokeListClient({
  jobs,
  view: _view,
  q,
  stageFilter,
  precomputedStageCounts,
  precomputedOverdueCount,
  hideTitleBlock = false,
}: Props) {
  const _router = useRouter();
  const pathname = usePathname();

  // Stage filtering is entirely client-side — matches the /repairs pattern
  // from PR #30. Every tab click used to trigger a `router.push` + full RSC
  // round-trip; now it's local state + history.replaceState, ~0 network.
  const [activeTab, setActiveTab] = useState(stageFilter || "all");
  // View toggle: table vs pipeline kanban (5+ stages with drag).
  const [view, setView] = useState<"list" | "kanban">("list");
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ notified: number; skipped: number } | null>(null);

  const readyJobs = useMemo(() => jobs.filter(j => j.stage === "ready"), [jobs]);
  // Loaded 200 gives us the ready-set for the notify-modal payload; for
  // the header chips prefer the precomputed tenant-wide counts so they
  // don't undercount when tenant has >200 jobs.
  const readyDisplayCount = precomputedStageCounts?.ready ?? readyJobs.length;
  // 'collected' is the post-ready terminal state for bespoke (per the
  // DB CHECK constraint and advanceJobStage). Earlier this filter only
  // excluded 'completed','cancelled' so collected jobs stayed in the
  // "active" count forever and inflated the header chip + scrolled
  // through the list. Same fix in workshop/page.tsx counters.
  const TERMINAL_STAGES = ["completed", "cancelled", "collected"];
  const activeJobsCount = precomputedStageCounts
    ? Object.entries(precomputedStageCounts)
        .filter(([k]) => !TERMINAL_STAGES.includes(k))
        .reduce((s, [, n]) => s + n, 0)
    : jobs.filter(j => !TERMINAL_STAGES.includes(j.stage)).length;
  const overdueDisplayCount = precomputedOverdueCount
    ?? jobs.filter(j => j.due_date && new Date(j.due_date) < new Date(new Date().toDateString()) && !["completed","cancelled","collected","ready"].includes(j.stage)).length;
  const visibleJobs = useMemo(
    () => (activeTab === "all" ? jobs : jobs.filter(j => j.stage === activeTab)),
    [jobs, activeTab]
  );

  async function handleBulkNotify() {
    setNotifying(true);
    try {
      const res = await fetch("/api/repair/notify-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bespoke" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNotifyResult(data);
      toast.success(`${data.notified} customer${data.notified !== 1 ? "s" : ""} notified`);
    } catch (err) {
      toast.error("Failed to send notifications");
      logger.error(err);
    } finally {
      setNotifying(false);
      setShowNotifyModal(false);
    }
  }

  // Stage tab click: instant client-side filter + shallow URL sync so refresh
  // and share-links still land on the right tab. No `router.push`, no RSC fetch.
  function setStage(stage: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (stage && stage !== "all") params.set("stage", stage);
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    setActiveTab(stage || "all");
    if (typeof window !== "undefined") window.history.replaceState(null, "", nextUrl);
  }

  // Stage-badge styling + date formatting moved into BespokeRow (module-
  // level map, not rebuilt per render).

  // Progressive-render cap — initial 40 rows, remainder fills in across
  // animation frames so the initial hydration doesn't block on all rows.
  const renderCap = useProgressiveRender(visibleJobs.length, { initialCount: 40, batchSize: 40 });

  // Wrap with full Nexpura page shell when this client renders standalone
  // (hideTitleBlock=false). When the parent server page has already rendered
  // a header + container, fall through and render only filters + list.
  const Body = (
    <>
      {/* HEADER — skipped when page.tsx rendered a server shell above. */}
      {!hideTitleBlock && (
        <>
          <div className="flex items-start justify-between gap-6 mb-10">
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Workshop
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
                Bespoke Jobs
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                Track custom commissions from enquiry through to collection.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {readyJobs.length > 0 && (
                <button
                  onClick={() => setShowNotifyModal(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium border border-stone-200 text-stone-700 bg-white hover:border-stone-300 hover:text-stone-900 transition-all duration-200"
                  title={`Notify ${readyJobs.length} ready customer${readyJobs.length !== 1 ? "s" : ""}`}
                >
                  <BellIcon className="w-4 h-4" />
                  Notify Ready
                </button>
              )}
              <Link
                href="/bespoke/new"
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                New Job
              </Link>
            </div>
          </div>

          {/* Stat strip — serif numerals, tracking-luxury labels.
              More elegant than badge chips at the top of a workshop page. */}
          {jobs.length > 0 && (
            <div className="grid grid-cols-3 gap-px bg-stone-200 border border-stone-200 rounded-2xl overflow-hidden mb-12 max-w-2xl">
              <div className="bg-white px-6 py-5">
                <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
                  Active
                </p>
                <p className="font-serif text-3xl text-stone-900 leading-none tracking-tight tabular-nums">
                  {activeJobsCount}
                </p>
              </div>
              <div className="bg-white px-6 py-5">
                <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
                  Ready
                </p>
                <p
                  className={`font-serif text-3xl leading-none tracking-tight tabular-nums ${
                    readyDisplayCount > 0 ? "text-emerald-700" : "text-stone-900"
                  }`}
                >
                  {readyDisplayCount}
                </p>
              </div>
              <div className="bg-white px-6 py-5">
                <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
                  Overdue
                </p>
                <p
                  className={`font-serif text-3xl leading-none tracking-tight tabular-nums ${
                    overdueDisplayCount > 0 ? "text-red-600" : "text-stone-900"
                  }`}
                >
                  {overdueDisplayCount}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* STAGE TABS — labels include the precomputed tenant-wide count
          when available. Falls back to label-only when stats row is
          missing (first-ever visit). */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto whitespace-nowrap no-scrollbar pb-1">
        {ALL_STAGES.map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === "all"
              ? precomputedStageCounts
                ? Object.values(precomputedStageCounts).reduce((s, n) => s + n, 0)
                : null
              : precomputedStageCounts?.[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setStage(tab.key === "all" ? "" : tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
                isActive
                  ? "bg-stone-900 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
              }`}
            >
              {tab.label}
              {count !== null && count !== undefined && count > 0 && (
                <span className={`ml-1.5 text-xs tabular-nums ${isActive ? "text-white/70" : "text-stone-400"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* View toggle */}
      <div className="flex justify-end mb-5">
        <div className="inline-flex rounded-full border border-stone-200 p-0.5 bg-white">
          <button
            onClick={() => setView("list")}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
              view === "list" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
              view === "kanban" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Pipeline
          </button>
        </div>
      </div>

      {/* Bulk-notify result banner */}
      {notifyResult && (
        <div className="mb-5 px-5 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-800 flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4" />
            {notifyResult.notified} customer{notifyResult.notified !== 1 ? "s" : ""} notified
            {notifyResult.skipped > 0 ? `, ${notifyResult.skipped} skipped (no email)` : ""}.
          </span>
          <button
            onClick={() => setNotifyResult(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* LIST / KANBAN */}
      {view === "kanban" ? (
        <BespokeKanban initialJobs={visibleJobs} />
      ) : visibleJobs.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
          <SparklesIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
          <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
            {activeTab === "all" ? "No bespoke jobs yet" : `No ${ALL_STAGES.find(s => s.key === activeTab)?.label.toLowerCase() ?? "matching"} jobs`}
          </h3>
          <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
            {activeTab === "all"
              ? "Start a new commission to track every stage from enquiry through to collection."
              : "Try a different stage filter to see other custom orders."}
          </p>
          {activeTab === "all" ? (
            <Link href="/bespoke/new" className="nx-btn-primary inline-flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              New Job
            </Link>
          ) : (
            <button
              onClick={() => setStage("all")}
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              View all jobs
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleJobs.slice(0, renderCap).map((job) => (
            <BespokeRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Bulk Notify Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
              <h2 className="font-serif text-2xl text-stone-900">Notify Ready Customers?</h2>
              <button
                onClick={() => setShowNotifyModal(false)}
                disabled={notifying}
                className="text-stone-400 hover:text-stone-700 transition-colors duration-200 disabled:opacity-50"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-stone-500 leading-relaxed">
                Send a &ldquo;ready for collection&rdquo; email to{" "}
                <strong className="text-stone-900">{readyJobs.length}</strong> customer
                {readyJobs.length !== 1 ? "s" : ""} with bespoke jobs in the{" "}
                <em className="text-stone-700">Ready</em> stage.
              </p>
              <div className="flex items-center justify-end gap-2 mt-6 pt-5 border-t border-stone-200">
                <button
                  onClick={() => setShowNotifyModal(false)}
                  disabled={notifying}
                  className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkNotify}
                  disabled={notifying}
                  className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <BellIcon className="w-4 h-4" />
                  {notifying ? "Sending…" : `Notify ${readyJobs.length} Customer${readyJobs.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parent server page (page.tsx) now always provides the ivory shell
          and container, so this client only renders Body. The hideTitleBlock
          prop is preserved for callers that want to render their own header
          (e.g. dashboard slot) but otherwise the polished serif header above
          is the default. */}
      {Body}
    </>
  );
}
