"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Bell } from "lucide-react";
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
  const router = useRouter();
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

  return (
    <>
      {/* Bulk Notify Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-stone-900 text-lg mb-2">Notify Ready Customers?</h3>
            <p className="text-sm text-stone-500 mb-6">
              Send a &quot;ready for collection&quot; email to <strong>{readyJobs.length}</strong> customer{readyJobs.length !== 1 ? "s" : ""} with bespoke jobs in the <em>Ready</em> stage.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNotifyModal(false)}
                disabled={notifying}
                className="px-4 py-2 text-sm font-medium border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkNotify}
                disabled={notifying}
                className="px-4 py-2 text-sm font-medium bg-amber-700 text-white rounded-xl hover:bg-[#7a6447] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Bell className="w-4 h-4" />
                {notifying ? "Sending…" : `Notify ${readyJobs.length} Customer${readyJobs.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {notifyResult && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center justify-between">
          <span>✅ {notifyResult.notified} customer{notifyResult.notified !== 1 ? "s" : ""} notified{notifyResult.skipped > 0 ? `, ${notifyResult.skipped} skipped (no email)` : ""}.</span>
          <button onClick={() => setNotifyResult(null)} className="text-emerald-600 hover:text-emerald-800 text-xs">Dismiss</button>
        </div>
      )}
    <div className="space-y-6 max-w-[1400px]">
      {/* HEADER — skipped when page.tsx rendered a server shell above. */}
      {!hideTitleBlock && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Bespoke Jobs</h1>
            <div className="hidden sm:flex items-center gap-2">
              {jobs.length > 0 && (
                <>
                  {activeJobsCount > 0 && (
                    <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
                      {activeJobsCount} Active
                    </Badge>
                  )}
                  {readyDisplayCount > 0 && (
                    <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
                      {readyDisplayCount} Ready
                    </Badge>
                  )}
                  {overdueDisplayCount > 0 && (
                    <Badge variant="outline" className="text-red-600 font-medium border-red-200 bg-red-50">
                      {overdueDisplayCount} Overdue
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {readyJobs.length > 0 && (
              <button
                onClick={() => setShowNotifyModal(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 border border-emerald-300 bg-emerald-50 rounded-md text-sm text-emerald-700 hover:bg-emerald-100 transition-colors font-medium"
                title={`Notify ${readyJobs.length} ready customer${readyJobs.length !== 1 ? "s" : ""}`}
              >
                <Bell className="w-4 h-4" />
                Notify All Ready
              </button>
            )}
            <Link href="/bespoke/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-amber-700 hover:bg-amber-800 text-white h-10 px-4 py-2">
              <Plus className="w-4 h-4 mr-2" /> New Job
            </Link>
          </div>
        </div>
      )}

      {/* STAGE TABS — labels include the precomputed tenant-wide count
          when available. Falls back to label-only when stats row is
          missing (first-ever visit). */}
      <div className="border-b border-stone-200 flex gap-6 overflow-x-auto whitespace-nowrap no-scrollbar">
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
              className={`pb-3 px-1 text-sm transition-colors flex-shrink-0 ${
                isActive
                  ? "border-b-2 border-amber-600 text-stone-900 font-medium"
                  : "text-stone-400 hover:text-stone-600"
              }`}
            >
              {tab.label}
              {count !== null && count !== undefined && count > 0 && (
                <span className={`ml-1.5 text-xs ${isActive ? "text-amber-700" : "text-stone-400"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* View toggle */}
      <div className="flex justify-end -mt-2 mb-2">
        <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-50">
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === "list" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === "kanban" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Pipeline
          </button>
        </div>
      </div>

      {/* TABLE / KANBAN */}
      {view === "kanban" ? (
        <BespokeKanban initialJobs={visibleJobs} />
      ) : (
      <Card className="border-stone-200 shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-stone-100">
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Client</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Piece & Materials</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Stage</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Due</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Assigned</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-stone-500">
                  No jobs found.
                </TableCell>
              </TableRow>
            ) : (
              // Memoized row component + progressive render: initial
              // paint is ~40 rows, remainder fills in over animation
              // frames so hydration doesn't block for the full list.
              visibleJobs.slice(0, renderCap).map((job) => (
                <BespokeRow key={job.id} job={job} />
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      )}
    </div>
    </>
  );
}
