"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, ArrowRight, Camera, Bell } from "lucide-react";
import CameraScannerModal from "@/components/CameraScannerModal";
import { ExportButtons } from "@/components/ExportButtons";
import { formatDateForExport } from "@/lib/export";
import { toast } from "sonner";
import logger from "@/lib/logger";

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
}

// ─── Stage data ───────────────────────────────────────────────────────────────

// Stages must match REPAIR_WORKFLOW_STAGES in repairs/[id]/page.tsx exactly
export const ALL_REPAIR_STAGES = [
  { key: "all", label: "All" },
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

// Sample data removed — real DB data is used exclusively

function isOverdue(due_date: string | null, stage: string) {
  if (!due_date) return false;
  if (["collected", "cancelled", "ready"].includes(stage)) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RepairsListClient({ repairs, view, q, stageFilter }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const activeTab = stageFilter || "all";
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ notified: number; skipped: number } | null>(null);

  const readyRepairs = repairs.filter(r => r.stage === "ready");

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

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (stageFilter) params.set("stage", stageFilter);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v); else params.delete(k);
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "intake": return <Badge className="bg-stone-100 text-stone-600 hover:bg-stone-100 border border-stone-200">Intake</Badge>;
      case "assessed": return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200">Assessed</Badge>;
      case "quoted": return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200">Quoted</Badge>;
      case "approved": return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200">Approved</Badge>;
      case "in_progress": return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200">In Progress</Badge>;
      case "quality_check": return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200">Quality Check</Badge>;
      case "ready": return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200">Ready</Badge>;
      case "collected": return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200">Collected</Badge>;
      case "cancelled": return <Badge className="bg-red-50 text-red-600 hover:bg-red-50 border border-red-200">Cancelled</Badge>;
      default: return <Badge variant="outline" className="text-stone-600 border-stone-200 capitalize">{status.replace(/_/g, ' ')}</Badge>;
    }
  };

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
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Repairs</h1>
          <div className="hidden sm:flex items-center gap-2">
            {repairs.length > 0 && (
              <>
                {repairs.filter(r => r.stage === "in_progress").length > 0 && (
                  <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
                    {repairs.filter(r => r.stage === "in_progress").length} In Progress
                  </Badge>
                )}
                {readyRepairs.length > 0 && (
                  <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
                    {readyRepairs.length} Ready
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
            data={repairs.map(r => ({
              repair_number: r.repair_number,
              customer: r.customers?.full_name || 'Unknown',
              item_type: r.item_type,
              description: r.item_description,
              repair_type: r.repair_type,
              stage: ALL_REPAIR_STAGES.find(s => s.key === r.stage)?.label || r.stage,
              priority: r.priority,
              due_date: formatDateForExport(r.due_date),
              created_at: formatDateForExport(r.created_at),
            }))}
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

      {/* STAGE TABS */}
      <div className="border-b border-stone-200 flex gap-6">
        {ALL_REPAIR_STAGES.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                updateParams({ stage: tab.key === "all" ? "" : tab.key });
              }}
              className={`pb-3 px-1 text-sm transition-colors ${
                isActive
                  ? "border-b-2 border-amber-600 text-stone-900 font-medium"
                  : "text-stone-400 hover:text-stone-600"
              }`}
            >
              {tab.label}
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
            {repairs.length === 0 ? (
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
            ) : repairs.map((repair) => {
                  const overdue = isOverdue(repair.due_date, repair.stage);
                  const name = repair.customers?.full_name || "Unknown";
                  return (
                    <TableRow key={repair.id} className="hover:bg-stone-50/60 border-stone-100 cursor-pointer" onClick={() => router.push(`/repairs/${repair.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-stone-100 text-stone-600 text-xs font-semibold">
                              {getInitials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-stone-900">{name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm text-stone-900">{repair.item_type}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{repair.item_description}</p>
                      </TableCell>
                      <TableCell>{getStatusBadge(repair.stage)}</TableCell>
                      <TableCell className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-stone-700'}`}>
                        {repair.due_date ? new Date(repair.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-stone-700">—</TableCell>
                      <TableCell className="text-sm font-medium text-stone-900">—</TableCell>
                      <TableCell>
                        <ArrowRight className="w-4 h-4 text-stone-300 hover:text-amber-700" />
                      </TableCell>
                    </TableRow>
                  );
                })}
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

 Claude is active in this tab group  
Open chat
 
Dismiss
