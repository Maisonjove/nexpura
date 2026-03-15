"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, ArrowRight } from "lucide-react";

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
      case "consultation": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Consultation</Badge>;
      case "deposit_paid": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Deposit Paid</Badge>;
      case "stone_sourcing": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Stone Sourcing</Badge>;
      case "cad": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">CAD</Badge>;
      case "approval": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Approval</Badge>;
      case "setting": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Setting</Badge>;
      case "polish": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Polish</Badge>;
      case "ready": return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Ready</Badge>;
      case "collected": return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Collected</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Cancelled</Badge>;
      default: return <Badge variant="outline" className="text-stone-600 border-stone-200 capitalize">{stage.replace(/_/g, ' ')}</Badge>;
    }
  };

  return (
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
                {jobs.filter(j => j.stage === "ready").length > 0 && (
                  <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
                    {jobs.filter(j => j.stage === "ready").length} Ready
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
        <Link href="/bespoke/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-[#8B7355] hover:bg-[#7A6347] text-white h-10 px-4 py-2">
          <Plus className="w-4 h-4 mr-2" /> New Job
        </Link>
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
                  ? "border-b-2 border-[#8B7355] text-stone-900 font-medium"
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
                      <ArrowRight className="w-4 h-4 text-stone-300 hover:text-[#8B7355]" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
