"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, ArrowRight, Camera } from "lucide-react";
import CameraScannerModal from "@/components/CameraScannerModal";

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

export const ALL_REPAIR_STAGES = [
  { key: "all", label: "All" },
  { key: "intake", label: "Received" },
  { key: "assessed", label: "Awaiting Approval" },
  { key: "in_progress", label: "In Workshop" },
  { key: "waiting_parts", label: "Waiting Parts" },
  { key: "ready", label: "Ready for Pickup" },
  { key: "collected", label: "Collected" },
];

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_REPAIRS = [
  { id: "r1", repair_number: "REP-0089", customer: "Sarah Khoury", initials: "SK", item: "Engagement Ring", issue: "Resize size 6→7", status: "In Workshop", due: "14 Mar", tech: "Ben", deposit: "$60" },
  { id: "r2", repair_number: "REP-0088", customer: "Lina Haddad", initials: "LH", item: "Diamond Pendant", issue: "Replace clasp", status: "Ready for Pickup", due: "12 Mar", tech: "Emma", deposit: "$85" },
  { id: "r3", repair_number: "REP-0087", customer: "David Moufarrej", initials: "DM", item: "Gold Bangle", issue: "Polish & clean", status: "Awaiting Approval", due: "15 Mar", tech: "Ben", deposit: "$0" },
  { id: "r4", repair_number: "REP-0086", customer: "Mia Tanaka", initials: "MT", item: "Wedding Band", issue: "Repair prong", status: "Overdue", due: "10 Mar", tech: "—", deposit: "$75" },
];

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
  const [activeTab, setActiveTab] = useState(stageFilter || "all");
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  const useSampleData = repairs.length === 0;

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
      case "In Workshop": 
      case "in_progress": return <Badge className="bg-stone-100 text-stone-700 hover:bg-stone-50 border-none">In Workshop</Badge>;
      case "Ready for Pickup":
      case "ready": return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-none">Ready</Badge>;
      case "Awaiting Approval":
      case "assessed": return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-none">Awaiting Approval</Badge>;
      case "Overdue": return <Badge className="bg-red-50 text-red-700 hover:bg-red-50 border-none">Overdue</Badge>;
      case "Received":
      case "intake": return <Badge className="bg-stone-100 text-stone-700 hover:bg-stone-100 border-none">Received</Badge>;
      case "Waiting Parts":
      case "waiting_parts": return <Badge className="bg-amber-50 text-amber-700 hover:bg-orange-50 border-none">Waiting Parts</Badge>;
      default: return <Badge variant="outline" className="text-stone-600 border-stone-200 capitalize">{status.replace('_', ' ')}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Repairs</h1>
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
              4 In Workshop
            </Badge>
            <Badge variant="outline" className="text-stone-500 font-medium border-stone-200">
              2 Ready
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCameraScanner(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50 transition-colors"
            title="Scan repair ticket barcode"
          >
            <Camera className="w-4 h-4" />
            Scan
          </button>
          <Link href="/repairs/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-[#8B7355] hover:bg-[#7A6347] text-white h-10 px-4 py-2">
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
                setActiveTab(tab.key);
                updateParams({ stage: tab.key === "all" ? "" : tab.key });
              }}
              className={`pb-3 px-1 text-sm transition-colors ${
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
            {useSampleData
              ? SAMPLE_REPAIRS.map((r) => (
                  <TableRow key={r.id} className="hover:bg-stone-50/60 border-stone-100 cursor-pointer" onClick={() => router.push(`/repairs/${r.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-stone-100 text-stone-600 text-xs font-semibold">
                            {r.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-stone-900">{r.customer}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm text-stone-900">{r.item}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{r.issue}</p>
                    </TableCell>
                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                    <TableCell className={`text-sm ${r.status === 'Overdue' ? 'text-red-600 font-medium' : 'text-stone-700'}`}>
                      {r.due}
                    </TableCell>
                    <TableCell className="text-sm text-stone-700">{r.tech}</TableCell>
                    <TableCell className="text-sm font-medium text-stone-900">{r.deposit}</TableCell>
                    <TableCell>
                      <ArrowRight className="w-4 h-4 text-stone-300 hover:text-[#8B7355]" />
                    </TableCell>
                  </TableRow>
                ))
              : repairs.map((repair) => {
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
                        <ArrowRight className="w-4 h-4 text-stone-300 hover:text-[#8B7355]" />
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
  );
}
