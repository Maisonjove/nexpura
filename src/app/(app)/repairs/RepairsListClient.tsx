"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  PlusIcon,
  CameraIcon,
  BellIcon,
  WrenchScrewdriverIcon,
  Squares2X2Icon,
  ListBulletIcon,
  XMarkIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { formatDateForExport } from "@/lib/export";
import { toast } from "sonner";
import logger from "@/lib/logger";
import { RepairRow } from "./RepairRow";
import RepairsKanban from "./RepairsKanban";
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
   * When true, skip rendering the h1 + primary-action button because
   * page.tsx rendered them synchronously as a server shell above the
   * Suspense boundary that wraps this client. Prevents duplicate title
   * flashes when the list streams in. The client still owns tab
   * *interactivity* — switching tabs works via the same local state +
   * history.replaceState model as before.
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
  { key: "intake", label: "Booked-In" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

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

  // List | Kanban view toggle. Kanban renders the same data grouped by
  // stage with @dnd-kit drag-and-drop; dropping a card on another column
  // calls advanceRepairStage which updates the DB + invalidates caches.
  const [view, setView] = useState<"list" | "kanban">("list");

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

  // Progressive-render cap: start at 40 (about a viewport's worth), fill
  // the rest in 40-row batches across animation frames so the initial
  // hydration doesn't block on reconciling 200 rows at once.
  const renderCap = useProgressiveRender(visibleRepairs.length, { initialCount: 40, batchSize: 40 });

  // Total tenant-wide count for the stat strip "Active" cell — sum of all
  // non-terminal stages. Falls back to loaded-row count.
  const TERMINAL_STAGES = ["collected", "cancelled"];
  const activeCount = precomputedStageCounts
    ? Object.entries(precomputedStageCounts)
        .filter(([k]) => !TERMINAL_STAGES.includes(k))
        .reduce((s, [, n]) => s + n, 0)
    : repairs.filter(r => !TERMINAL_STAGES.includes(r.stage)).length;

  // ── Body content (header, stats, filters, view toggle, list/kanban) ───
  const Body = (
    <>
      {/* HEADER — owned by the client so the polished serif title hydrates
          without a flash. page.tsx may pass hideTitleBlock=true to suppress
          this when it renders its own server shell. */}
      {!hideTitleBlock && (
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Workshop
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Repairs
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Track every repair through the workshop, from booking-in to
              ready-for-collection.
            </p>
          </div>
          <Link
            href="/repairs/new"
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            New Repair
          </Link>
        </div>
      )}

      {/* Notify result banner */}
      {notifyResult && (
        <div className="mb-8 px-5 py-3 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl text-sm text-emerald-800 flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4" />
            {notifyResult.notified} customer{notifyResult.notified !== 1 ? "s" : ""} notified
            {notifyResult.skipped > 0 ? `, ${notifyResult.skipped} skipped (no email)` : ""}.
          </span>
          <button
            onClick={() => setNotifyResult(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STAT STRIP — bare typography over ivory, hairline dividers between
          cells on sm+. Mirrors InvoiceListClient's polished metric pattern.
          Only `Overdue` gets a tasteful semantic accent (oxblood) when > 0. */}
      {repairs.length > 0 && (
        <div className="mb-14 grid grid-cols-2 sm:grid-cols-4 gap-y-8 gap-x-6 sm:divide-x sm:divide-stone-200">
          <div className="sm:px-8 sm:first:pl-0">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
              Active
            </p>
            <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
              {activeCount}
            </p>
          </div>
          <div className="sm:px-8">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
              In Progress
            </p>
            <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
              {inProgressCount}
            </p>
          </div>
          <div className="sm:px-8">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
              Ready
            </p>
            <p
              className={`font-serif text-4xl leading-none tracking-tight tabular-nums ${
                readyDisplayCount > 0 ? "text-nexpura-emerald-deep" : "text-stone-900"
              }`}
            >
              {readyDisplayCount}
            </p>
          </div>
          <div className="sm:px-8">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
              Overdue
            </p>
            <p
              className={`font-serif text-4xl leading-none tracking-tight tabular-nums ${
                overdueDisplayCount > 0 ? "text-nexpura-oxblood" : "text-stone-900"
              }`}
            >
              {overdueDisplayCount}
            </p>
          </div>
        </div>
      )}

      {/* STAGE FILTER PILLS — rounded-full, charcoal active, white-with-border idle.
          Matches the bespoke / laybys filter pattern. */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto whitespace-nowrap no-scrollbar pb-1">
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
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
                isActive
                  ? "bg-stone-900 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
              }`}
            >
              {tab.label}
              {count !== null && count !== undefined && count > 0 && (
                <span
                  className={`ml-1.5 text-xs tabular-nums ${
                    isActive ? "text-white/70" : "text-stone-400"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* CONTROL BAR — quiet utility row: notify, scan, export, view toggle. */}
      <div className="flex items-center justify-end gap-2 mb-5 flex-wrap">
        {readyRepairs.length > 0 && (
          <button
            onClick={() => setShowNotifyModal(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm text-stone-600 bg-white border border-stone-200 hover:border-stone-300 hover:text-stone-900 transition-all duration-200"
            title={`Notify ${readyRepairs.length} ready customer${readyRepairs.length !== 1 ? "s" : ""}`}
          >
            <BellIcon className="w-4 h-4 text-stone-400" />
            Notify Ready
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
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm text-stone-600 bg-white border border-stone-200 hover:border-stone-300 hover:text-stone-900 transition-all duration-200"
          title="Scan repair ticket barcode"
        >
          <CameraIcon className="w-4 h-4 text-stone-400" />
          Scan
        </button>

        {/* List / Kanban view toggle */}
        <div className="inline-flex rounded-full border border-stone-200 p-0.5 bg-white">
          <button
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
              view === "list"
                ? "bg-stone-900 text-white"
                : "text-stone-500 hover:text-stone-900"
            }`}
            aria-label="List view"
          >
            <ListBulletIcon className="w-3.5 h-3.5" />
            List
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
              view === "kanban"
                ? "bg-stone-900 text-white"
                : "text-stone-500 hover:text-stone-900"
            }`}
            aria-label="Kanban view"
          >
            <Squares2X2Icon className="w-3.5 h-3.5" />
            Kanban
          </button>
        </div>
      </div>

      {/* LIST or KANBAN */}
      {view === "kanban" ? (
        <RepairsKanban initialRepairs={visibleRepairs} />
      ) : visibleRepairs.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
          <WrenchScrewdriverIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" strokeWidth={1.5} />
          <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
            {activeTab === "all" ? "No repairs yet" : "No repairs in this stage"}
          </h3>
          <p className="text-stone-500 text-sm mb-7 max-w-sm mx-auto leading-relaxed">
            {activeTab === "all"
              ? "Book in your first repair to start tracking work through the workshop."
              : "Try a different filter to see other repairs."}
          </p>
          {activeTab === "all" ? (
            <Link href="/repairs/new" className="nx-btn-primary inline-flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              New Repair
            </Link>
          ) : (
            <button
              onClick={() => setStage("")}
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              View all repairs
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Column header (desktop only) */}
          <div className="hidden md:grid grid-cols-[1.1fr_1.4fr_1.6fr_1fr_1fr_auto] gap-4 px-6 py-2 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
            <div>Repair #</div>
            <div>Customer</div>
            <div>Item &amp; Issue</div>
            <div>Status</div>
            <div>ETA</div>
            <div className="w-4" />
          </div>

          {/* Memoized row component; each row only re-renders when its
              own `repair` prop identity changes. Slicing by renderCap
              means the initial paint contains ~40 rows; the remainder
              fills in across subsequent animation frames via the
              progressive-render hook. */}
          {visibleRepairs.slice(0, renderCap).map((repair) => (
            <RepairRow key={repair.id} repair={repair} />
          ))}
        </div>
      )}
    </>
  );

  // Modals + scanner — rendered at the root regardless of layout mode.
  const overlays = (
    <>
      {showNotifyModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
              <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                Notify Ready Customers?
              </h2>
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
                <strong className="text-stone-900">{readyRepairs.length}</strong> customer
                {readyRepairs.length !== 1 ? "s" : ""} with repairs in the{" "}
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
                  {notifying
                    ? "Sending…"
                    : `Notify ${readyRepairs.length} Customer${readyRepairs.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </>
  );

  // When `hideTitleBlock` is true, page.tsx already wraps us in its own
  // server shell. Render body inline so we don't double-wrap.
  if (hideTitleBlock) {
    return (
      <>
        {overlays}
        <div className="max-w-[1400px]">{Body}</div>
      </>
    );
  }

  // Standalone mode (tests, other entry points): render the full
  // ivory-backed design-system page including container.
  return (
    <>
      {overlays}
      <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
          {Body}
        </div>
      </div>
    </>
  );
}
