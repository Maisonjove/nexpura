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
  { key: "quote_sent", label: "Quote Sent" },
  { key: "approved", label: "Approved" },
  { key: "cad", label: "CAD" },
  { key: "casting", label: "Casting" },
  { key: "setting", label: "Setting" },
  { key: "polishing", label: "Polishing" },
  { key: "ready", label: "Ready" },
];

const SAMPLE_JOBS = [
  { id: "b1", customer: "Sarah Khoury", initials: "SK", piece: "Toi et Moi Ring", material: "18k White Gold · Lab Diamond", stage: "CAD", value: "$8,500", due: "20 Mar", assigned: "Emma" },
  { id: "b2", customer: "David Moufarrej", initials: "DM", piece: "Emerald Tennis Bracelet", material: "18k Yellow Gold", stage: "Approved", value: "$12,000", due: "28 Mar", assigned: "Ben" },
  { id: "b3", customer: "Mia Tanaka", initials: "MT", piece: "Custom Bridal Set", material: "Platinum", stage: "Setting", value: "$9,200", due: "15 Mar", assigned: "Emma" },
  { id: "b4", customer: "Lina Haddad", initials: "LH", piece: "Charm Bracelet", material: "18k Rose Gold", stage: "Enquiry", value: "$3,400", due: "10 Apr", assigned: "—" },
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

  const useSampleData = jobs.length === 0;

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
      case "enquiry": return <Badge variant="outline" className="bg-stone-50 text-stone-600 border-stone-200">Enquiry</Badge>;
      case "quote sent":
      case "quote_sent": return <Badge variant="outline" className="bg-stone-100 text-stone-700 border-stone-200">Quote Sent</Badge>;
      case "approved": return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Approved</Badge>;
      case "cad": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">CAD</Badge>;
      case "casting": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-orange-200">Casting</Badge>;
      case "setting": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Setting</Badge>;
      case "polishing": return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Polishing</Badge>;
      case "ready": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ready</Badge>;
      default: return <Badge variant="outline" className="text-stone-600 border-stone-200 capitalize">{stage.replace('_', ' ')}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Bespoke Jobs</h1>
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
              8 Active
            </Badge>
          </div>
        </div>
        <Link href="/bespoke/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-[#8B7355] hover:bg-[#7A6347] text-white h-10 px-4 py-2">
          <Plus className="w-4 h-4 mr-2" /> New Job
        </Link>
      </div>

      {/* STAGE TABS */}
      <div className="border-b border-stone-200 flex gap-6 overflow-x-auto whitespace-nowrap">
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
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Value</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Due</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Assigned</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {useSampleData
              ? SAMPLE_JOBS.map((j) => (
                  <TableRow key={j.id} className="hover:bg-stone-50/60 border-stone-100 cursor-pointer" onClick={() => router.push(`/bespoke/${j.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-stone-100 text-stone-600 text-xs font-semibold">
                            {j.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-stone-900">{j.customer}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm text-stone-900">{j.piece}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{j.material}</p>
                    </TableCell>
                    <TableCell>{getStageBadge(j.stage)}</TableCell>
                    <TableCell className="text-sm font-medium text-stone-900">{j.value}</TableCell>
                    <TableCell className="text-sm text-stone-700">{j.due}</TableCell>
                    <TableCell className="text-sm text-stone-700">{j.assigned}</TableCell>
                    <TableCell>
                      <ArrowRight className="w-4 h-4 text-stone-300 hover:text-[#8B7355]" />
                    </TableCell>
                  </TableRow>
                ))
              : jobs.map((job) => {
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
                      <TableCell className="text-sm font-medium text-stone-900">—</TableCell>
                      <TableCell className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-stone-700'}`}>
                        {job.due_date ? new Date(job.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-stone-700">—</TableCell>
                      <TableCell>
                        <ArrowRight className="w-4 h-4 text-stone-300 hover:text-[#8B7355]" />
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
