"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, ArrowRight, Bell } from "lucide-react";
import { toast } from "sonner";
import logger from "@/lib/logger";

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
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const ALL_STAGES = [
  { key: "all", label: "All" },
  { key: "enquiry", label: "Enquiry" },
  { key: "consultation", label: "Consultation" },
  { key: "deposit_paid", label: "Deposit Paid" },
  { key: "stone_sourcing", label: "Stone Sourcing" },
  { key: "cad", label: "CAD" },
  { key: "approval", label: "Approval" },
  { key: "setting", label: "Setting" },
  { key: "polish", label: "Polish" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
  { key: "cancelled", label: "Cancelled" },
];

function isOverdue(due_date: string | null) {
  if (!due_date) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BespokeListClient({ jobs, view, q, stageFilter }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState(stageFilter || "all");
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ notified: number; skipped: number } | null>(null);

  const readyJobs = jobs.filter(j => j.stage === "ready");

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

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (stageFilter) params.set("stage", stageFilter);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v); else params.delete(k);
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const getStageBadge = (stage: string) => {
    switch (stage.toLowerCase()) {
      case "enquiry": return <Badge variant="outline" className="bg-stone-100 text-stone-600 border-stone-200">Enquiry</Badge>;
      case "consultation": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Consultation</Badge>;
      case "deposit_paid": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Deposit Paid</Badge>;
      case "stone_sourcing": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Stone Sourcing</Badge>;
      case "cad": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">CAD</Badge>;
      case "approval": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Approval</Badge>;
      case "setting": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Setting</Badge>;
      case "polish": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Polish</Badge>;
      case "ready": return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Ready</Badge>;
      case "collected": return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Collected</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Cancelled</Badge>;
      default: return <Badge variant="outline" className="text-stone-600 border-stone-200 capitalize">{stage.replace(/_/g, ' ')}</Badge>;
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
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Bespoke Jobs</h1>
          <div className="hidden sm:flex items-center gap-2">
            {jobs.length > 0 && (
              <>
                {jobs.filter(j => !["collected", "cancelled"].includes(j.stage)).length > 0 && (
                  <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
                    {jobs.filter(j => !["collected", "cancelled"].includes(j.stage)).length} Active
                  </Badge>
                )}
                {readyJobs.length > 0 && (
                  <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
                    {readyJobs.length} Ready
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

      {/* STAGE TABS */}
      <div className="border-b border-stone-200 flex gap-6 overflow-x-auto whitespace-nowrap no-scrollbar">
        {ALL_STAGES.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                updateParams({ stage: tab.key === "all" ? "" : tab.key });
              }}
              className={`pb-3 px-1 text-sm transition-colors flex-shrink-0 ${
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
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Client</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Piece & Materials</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Stage</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Due</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Assigned</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-stone-500">
                  No jobs found.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => {
                const overdue = isOverdue(job.due_date);
                const name = job.customers?.full_name || "Unknown";
                return (
                  <TableRow key={job.id} className="hover:bg-stone-50/60 border-stone-100 cursor-pointer" onClick={() => router.push(`/bespoke/${job.id}`)}>
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
                      <p className="font-medium text-sm text-stone-900">{job.title}</p>
                      <p className="text-xs text-stone-400 mt-0.5">—</p>
                    </TableCell>
                    <TableCell>{getStageBadge(job.stage)}</TableCell>
                    <TableCell className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-stone-700'}`}>
                      {job.due_date ? new Date(job.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-stone-700">—</TableCell>
                    <TableCell>
                      <ArrowRight className="w-4 h-4 text-stone-300 hover:text-amber-700" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
    </>
  );
}
