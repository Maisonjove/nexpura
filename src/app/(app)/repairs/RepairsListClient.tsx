"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Camera, Bell } from "lucide-react";
import { formatDateForExport } from "@/lib/export";
import { toast } from "sonner";
import logger from "@/lib/logger";
import { RepairRow } from "./RepairRow";
import { useProgressiveRender } from "@/lib/useProgressiveRender";

// CameraScannerModal pulls in camera + barcode-detection APIs; ExportButtons
// bundles the XLSX writer. Neither renders on first paint — load on demand.
const CameraScannerModal = dynamic(() => import("@/components/CameraScannerModal"), { ssr: false });
const ExportButtons = dynamic(
  () => import("@/components/ExportButtons").then((m) => ({ default: m.ExportButtons })),
  { ssr: false, loading: () => <div className="w-[120px] h-9" /> }
);

// ─── Types ───────────────────────────────────────────────────────────────────

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
  /**
   * Precomputed tenant-wide stage counts from `tenant_dashboard_stats`.
   * Format: `{ stage_key: count }`. Covers ALL stages including the long
   * tail of `collected`/`cancelled`, so tab labels are accurate for any
   * tenant (the inline 200-row fetch would undercount once a tenant had
   * >200 total repairs). Null when no stats row exists yet — we fall
   * back to local-computed counts from the loaded rows.
   */
  precomputedStageCounts?: Record<string, number> | null;
  /** Precomputed tenant-wide count of overdue (non-ready non-collected) repairs. */
  precomputedOverdueCount?: number | null;
  /**
   * When true, skip rendering the h1 + primary-action button AND the
   * stage tabs because page.tsx rendered them synchronously as a server
   * shell above the Suspense boundary that wraps this client. Prevents
   * duplicate title / tab flashes when the list streams in. The client
   * still owns tab *interactivity* — switching tabs works via the same
   * local state + history.replaceState model as before; the server tabs
   * are non-interactive anchor-links that only serve the initial paint.
   */
  hideTitleBlock?: boolean;
}

// ─── Stage data ───────────────────────────────────────────────────────────────

// Stages must match REPAIR_WORKFLOW_STAGES in repairs/[id]/page.tsx exactly
// Stages must match the DB CHECK constraint repairs_stage_valid.
// 'quality_check' isn't allowed by the constraint and never gets
// written, so the filter chip was dead UI — clicking it always
// rendered "no repairs". Removed.
export const ALL_REPAIR_STAGES = [
  { key: "all", label: "All" },
  { key: "intake", label: "Intake" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
  { key: "cancelled", label: "Cancelled" },
];

// isOverdue / getInitials now live in ./RepairRow.tsx (used per-row).

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RepairsListClient({
  repairs,
  view: _view,
  q,
  stageFilter,
  precomputedStageCounts,
  precomputedOverdueCount,
  hideTitleBlock = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  // Stage filtering is entirely client-side now. URL stays the source of truth
  // across refresh / share, but tab clicks update local state for instant
  // re-render and sync the URL via history.replaceState (no server round-trip).
  const [activeTab, setActiveTab] = useState<string>(stageFilter || "all");

  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ notified: number; skipped: number } | null>(null);

  const readyRepairs = useMemo(() => repairs.filter(r => r.stage === "ready"), [repairs]);
  // readyRepairs.length is always trustworthy for the *loaded* 200; use it
  // for the "Notify" modal payload. But for the header chips that show a
  // total "X Ready" / "X In Progress", prefer the precomputed tenant-wide
  // count so the number doesn't lie when the tenant has >200 repairs.
  const readyDisplayCount = precomputedStageCounts?.ready ?? readyRepairs.length;
  const inProgressCount = precomputedStageCounts?.in_progress
    ?? repairs.filter(r => r.stage === "in_progress").length;
  const overdueDisplayCount = precomputedOverdueCount
    ?? repairs.filter(r => r.due_date && new Date(r.due_date) < new Date(new Date().toDateString()) && !['collected','cancelled','ready'].includes(r.stage)).length;

  // Visible rows = apply current stage filter client-side. With the default
  // 200-row server cap, filtering this locally is ~1ms and feels instant.
  const visibleRepairs = useMemo(
    () => (activeTab === "all" ? repairs : repairs.filter(r => r.stage === activeTab)),
    [repairs, activeTab]
  );

  const exportRows = useMemo(() =>
    visibleRepairs.map(r => ({
      repair_number: r.repair_number,
      customer: r.customers?.full_name || 'Unknown',
      item_type: r.item_type,
      description: r.item_description,
      repair_type: r.repair_type,
      stage: ALL_REPAIR_STAGES.find(s => s.key === r.stage)?.label || r.stage,
      priority: r.priority,
      due_date: formatDateForExport(r.due_date),
      created_at: formatDateForExport(r.created_at),
    })),
    [visibleRepairs]
  );

  async function handleBulkNotify() {
    setNotifying(true);
    try {
      const res = await fetch("/api/repair/notify-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "repair" }),
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

  const useSampleData = false; // Always use real data — show empty state when no repairs

  // Stage tab click: instant client-side filter + shallow URL sync so refresh
  // and share-links still land on the right tab. No server round-trip.
  function setStage(stage: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (stage && stage !== "all") params.set("stage", stage);
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    setActiveTab(stage || "all");
    // replaceState keeps the URL in sync without Next triggering an RSC fetch.
    if (typeof window !== "undefined") window.history.replaceState(null, "", nextUrl);
  }

  // Search / other param updates still go through the router so the server
  // can apply the `q` filter (covers repairs older than the recent-200 cap —
  // used by the camera-scanner fallback).
  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (activeTab && activeTab !== "all") params.set("stage", activeTab);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v); else params.delete(k);
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  // Stage-badge lookup moved into RepairRow component (module-level map,
  // not recreated per render). Kept this comment as a signpost.

  // Progressive-render cap: start at 40 (about a viewport's worth), fill
  // the rest in 40-row batches across animation frames so the initial
  // hydration doesn't block on reconciling 200 rows at once.
  const renderCap = useProgressiveRender(visibleRepairs.length, { initialCount: 40, batchSize: 40 });

  return (
    <>
      {/* Bulk Notify Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-stone-900 text-lg mb-2">Notify Ready Customers?</h3>
            <p className="text-sm text-stone-500 mb-6">
              Send a &quot;ready for collection&quot; email to <strong>{readyRepairs.length}</strong> customer{readyRepairs.length !== 1 ? "s" : ""} with repairs in the <em>Ready</em> stage.
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
                {notifying ? "Sending…" : `Notify ${readyRepairs.length} Customer${readyRepairs.length !== 1 ? "s" : ""}`}
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
      {/* HEADER — skipped when page.tsx renders a server shell above.
          Kept inline for standalone use (tests, other entry points). */}
      {!hideTitleBlock && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Repairs</h1>
            <div className="hidden sm:flex items-center gap-2">
              {repairs.length > 0 && (
                <>
                  {inProgressCount > 0 && (
                    <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
                      {inProgressCount} In Progress
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
            {readyRepairs.length > 0 && (
              <button
                onClick={() => setShowNotifyModal(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 border border-emerald-300 bg-emerald-50 rounded-md text-sm text-emerald-700 hover:bg-emerald-100 transition-colors font-medium"
                title={`Notify ${readyRepairs.length} ready customer${readyRepairs.length !== 1 ? "s" : ""}`}
              >
                <Bell className="w-4 h-4" />
                Notify All Ready
              </button>
            )}
            <ExportButtons
              data={exportRows}
              columns={[
                { key: 'repair_number', label: 'Repair #' },
                { key: 'customer', label: 'Customer' },
                { key: 'item_type', label: 'Item Type' },
                { key: 'description', label: 'Description' },
                { key: 'repair_type', label: 'Repair Type' },
                { key: 'stage', label: 'Status' },
                { key: 'priority', label: 'Priority' },
                { key: 'due_date', label: 'Due Date' },
                { key: 'created_at', label: 'Created' },
              ]}
              filename={`repairs-export-${new Date().toISOString().split('T')[0]}`}
              sheetName="Repairs"
              size="sm"
            />
            <button
              onClick={() => setShowCameraScanner(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50 transition-colors"
              title="Scan repair ticket barcode"
            >
              <Camera className="w-4 h-4" />
              Scan
            </button>
            <Link href="/repairs/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-amber-700 hover:bg-amber-800 text-white h-10 px-4 py-2">
              <Plus className="w-4 h-4 mr-2" /> New Repair
            </Link>
          </div>
        </div>
      )}

      {/* STAGE TABS — labels now show the precomputed tenant-wide count
          next to each stage key when available. Falls back to label-only
          when the stats row is missing (first-ever visit). */}
      <div className="border-b border-stone-200 flex gap-6 overflow-x-auto">
        {ALL_REPAIR_STAGES.map((tab) => {
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
              className={`pb-3 px-1 text-sm transition-colors whitespace-nowrap ${
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

      {/* TABLE */}
      <Card className="border-stone-200 shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-stone-100">
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Customer</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Item & Issue</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Status</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Due</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Tech</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Deposit</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRepairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-stone-400">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-10 h-10 text-stone-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm font-medium text-stone-400">No repairs found</p>
                    <p className="text-xs text-stone-300">Create a new repair to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // Memoized row component; each row only re-renders when its
              // own `repair` prop identity changes. Slicing by renderCap
              // means the initial paint contains ~40 rows; the remainder
              // fills in across subsequent animation frames via the
              // progressive-render hook.
              visibleRepairs.slice(0, renderCap).map((repair) => (
                <RepairRow key={repair.id} repair={repair} />
              ))
            )}
            </TableBody>
        </Table>
      </Card>

      {/* Camera Scanner Modal */}
      {showCameraScanner && (
        <CameraScannerModal
          title="Scan Repair Ticket"
          onScan={(barcode) => {
            // Try to find repair by repair_number
            const found = repairs.find(
              (r) => r.repair_number === barcode || r.repair_number === barcode.replace(/^REP-?/i, "REP-")
            );
            if (found) {
              router.push(`/repairs/${found.id}`);
            } else {
              updateParams({ q: barcode });
            }
            setShowCameraScanner(false);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}
    </div>
    </>
  );
}
