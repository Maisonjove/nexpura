"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import StatusBadge from "@/components/StatusBadge";

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
  { key: "intake", label: "Received" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Workshop" },
  { key: "quality_check", label: "Quality Check" },
  { key: "ready", label: "Ready for Pickup" },
  { key: "collected", label: "Collected" },
  { key: "cancelled", label: "Cancelled" },
];

// Pipeline columns
const PIPELINE_COLUMNS = [
  {
    key: "intake_group",
    label: "Intake",
    stages: ["intake"],
    headerBg: "bg-gray-50",
    headerText: "text-gray-600",
    accent: "border-gray-200",
  },
  {
    key: "assessed_group",
    label: "Assessed / Quoted",
    stages: ["assessed", "quoted", "approved"],
    headerBg: "bg-purple-50",
    headerText: "text-purple-700",
    accent: "border-purple-200",
  },
  {
    key: "in_progress_group",
    label: "In Workshop",
    stages: ["in_progress", "quality_check"],
    headerBg: "bg-blue-50",
    headerText: "text-blue-700",
    accent: "border-blue-200",
  },
  {
    key: "ready_group",
    label: "Ready",
    stages: ["ready"],
    headerBg: "bg-green-50",
    headerText: "text-green-700",
    accent: "border-green-200",
  },
  {
    key: "collected_group",
    label: "Collected",
    stages: ["collected", "cancelled"],
    headerBg: "bg-gray-50",
    headerText: "text-gray-500",
    accent: "border-gray-200",
  },
];

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_REPAIRS = [
  { id: "r1", repair_number: "REP-0089", customer: "Sarah Khoury", item: "Engagement Ring", issue: "Resize size 6→7", quoted: "$120", due: "14 Mar", stage: "In Workshop", assigned: "Ben" },
  { id: "r2", repair_number: "REP-0088", customer: "Lina Haddad", item: "Diamond Pendant", issue: "Replace clasp", quoted: "$85", due: "12 Mar", stage: "Ready for Pickup", assigned: "Emma" },
  { id: "r3", repair_number: "REP-0087", customer: "David M.", item: "Gold Bangle", issue: "Polish & clean", quoted: "$65", due: "15 Mar", stage: "Awaiting Approval", assigned: "Ben" },
  { id: "r4", repair_number: "REP-0086", customer: "Mia Tanaka", item: "Wedding Band", issue: "Repair prong", quoted: "$150", due: "10 Mar", stage: "Overdue", assigned: "—" },
  { id: "r5", repair_number: "REP-0085", customer: "James Obeid", item: "Sapphire Ring", issue: "Reset stone", quoted: "$200", due: "13 Mar", stage: "In Workshop", assigned: "Emma" },
];

function isOverdue(due_date: string | null, stage: string) {
  if (!due_date) return false;
  if (["collected", "cancelled"].includes(stage)) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

// ─── Pipeline card ────────────────────────────────────────────────────────────

function PipelineCard({ repair }: { repair: Repair }) {
  const overdue = isOverdue(repair.due_date, repair.stage);
  const stageLabel = ALL_REPAIR_STAGES.find((s) => s.key === repair.stage)?.label || repair.stage;
  return (
    <Link href={`/repairs/${repair.id}`}>
      <div className="bg-white border border-[#E8E6E1] rounded-xl p-4 hover:border-[#1a4731]/30 hover:shadow-sm transition-all cursor-pointer group">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-[#1C1C1E] group-hover:text-[#1a4731] transition-colors leading-snug">
            {repair.item_type}
          </p>
          <StatusBadge status={stageLabel} />
        </div>
        {repair.customers && (
          <p className="text-xs text-[#9A9A9A] mb-2">{repair.customers.full_name}</p>
        )}
        <p className="text-xs text-[#9A9A9A] mb-2 line-clamp-1">{repair.item_description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-[#C0C0C0]">{repair.repair_number}</span>
          {repair.due_date && (
            <span className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-[#9A9A9A]"}`}>
              {overdue ? "⚠ " : ""}
              {new Date(repair.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RepairsListClient({ repairs, view, q, stageFilter }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(q);
  const [activeTab, setActiveTab] = useState("all");

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (stageFilter) params.set("stage", stageFilter);
    if (view) params.set("view", view);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v); else params.delete(k);
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: search, view });
  }

  const useSampleData = repairs.length === 0;
  const filterTabs = [
    { key: "all", label: "All" },
    { key: "intake", label: "Received" },
    { key: "in_progress", label: "In Workshop" },
    { key: "ready", label: "Ready for Pickup" },
    { key: "overdue", label: "Overdue" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#1C1C1E]">Repairs</h1>
        <Link
          href="/repairs/new"
          className="inline-flex items-center gap-2 bg-[#1a4731] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1a4731]/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Repair
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active", value: useSampleData ? "12" : String(repairs.filter(r => !["collected","cancelled"].includes(r.stage)).length) },
          { label: "Ready", value: useSampleData ? "2" : String(repairs.filter(r => r.stage === "ready").length) },
          { label: "Overdue", value: useSampleData ? "3" : String(repairs.filter(r => isOverdue(r.due_date, r.stage)).length), warn: true },
          { label: "Completed this month", value: "28" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border border-[#E8E6E1] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">{stat.label}</p>
            <p className={`text-xl font-semibold mt-1 ${stat.warn ? "text-red-500" : "text-[#1C1C1E]"}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center bg-white border border-[#E8E6E1] rounded-lg p-1 gap-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                updateParams({ stage: tab.key === "all" ? "" : tab.key, view });
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === tab.key
                  ? "bg-[#1a4731] text-white shadow-sm"
                  : "text-[#6B6B6B] hover:text-[#1C1C1E]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="flex items-center bg-white border border-[#E8E6E1] rounded-lg p-1 gap-0.5">
            <button
              onClick={() => updateParams({ view: "pipeline" })}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                view === "pipeline" ? "bg-[#1a4731] text-white" : "text-[#6B6B6B] hover:text-[#1C1C1E]"
              }`}
            >
              Pipeline
            </button>
            <button
              onClick={() => updateParams({ view: "list" })}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                view !== "pipeline" ? "bg-[#1a4731] text-white" : "text-[#6B6B6B] hover:text-[#1C1C1E]"
              }`}
            >
              List
            </button>
          </div>
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repairs…"
              className="w-48 pl-8 pr-3 py-2 text-sm bg-white border border-[#E8E6E1] rounded-lg text-[#1C1C1E] placeholder-[#C0C0C0] focus:outline-none focus:border-[#1a4731] focus:ring-1 focus:ring-[#1a4731]"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C0C0C0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </form>
        </div>
      </div>

      {/* Content */}
      {view === "pipeline" ? (
        useSampleData ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_COLUMNS.map((col) => (
              <div key={col.key} className={`flex-shrink-0 w-64 border ${col.accent} rounded-xl overflow-hidden`}>
                <div className={`${col.headerBg} px-4 py-3 flex items-center justify-between`}>
                  <span className={`text-sm font-semibold ${col.headerText}`}>{col.label}</span>
                  <span className={`text-xs font-bold ${col.headerText} bg-white/60 rounded-full px-2 py-0.5`}>0</span>
                </div>
                <div className="bg-[#F8F7F5] p-3 min-h-[200px]">
                  <p className="text-xs text-[#C0C0C0] text-center py-8">No repairs</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_COLUMNS.map((col) => {
              const colRepairs = repairs.filter((r) => col.stages.includes(r.stage));
              return (
                <div key={col.key} className={`flex-shrink-0 w-64 border ${col.accent} rounded-xl overflow-hidden`}>
                  <div className={`${col.headerBg} px-4 py-3 flex items-center justify-between`}>
                    <span className={`text-sm font-semibold ${col.headerText}`}>{col.label}</span>
                    <span className={`text-xs font-bold ${col.headerText} bg-white/60 rounded-full px-2 py-0.5`}>{colRepairs.length}</span>
                  </div>
                  <div className="bg-[#F8F7F5] p-3 space-y-2 min-h-[200px]">
                    {colRepairs.length === 0 ? (
                      <p className="text-xs text-[#C0C0C0] text-center py-8">No repairs</p>
                    ) : (
                      colRepairs.map((repair) => <PipelineCard key={repair.id} repair={repair} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="bg-white border border-[#E8E6E1] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F0EDE9]">
                  {["#", "Customer", "Item", "Issue", "Quoted", "Due", "Status", "Assigned", ""].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A] px-4 py-3 bg-[#F8F7F5]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F3F0]">
                {useSampleData
                  ? SAMPLE_REPAIRS.map((r) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-[#F8F7F5] transition-colors ${
                          r.stage === "Overdue" ? "border-l-2 border-l-red-500" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-xs font-mono text-[#9A9A9A]">{r.repair_number}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[#1C1C1E]">{r.customer}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{r.item}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{r.issue}</td>
                        <td className="px-4 py-3 text-sm text-[#1C1C1E] font-medium">{r.quoted}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{r.due}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.stage} /></td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{r.assigned}</td>
                        <td className="px-4 py-3">
                          <Link href="/repairs" className="text-xs text-[#1a4731] font-semibold hover:underline">→</Link>
                        </td>
                      </tr>
                    ))
                  : repairs.map((repair) => {
                      const overdue = isOverdue(repair.due_date, repair.stage);
                      const stageLabel = ALL_REPAIR_STAGES.find((s) => s.key === repair.stage)?.label || repair.stage;
                      return (
                        <tr
                          key={repair.id}
                          className={`hover:bg-[#F8F7F5] transition-colors ${overdue ? "border-l-2 border-l-red-500" : ""}`}
                        >
                          <td className="px-4 py-3 text-xs font-mono text-[#9A9A9A]">{repair.repair_number}</td>
                          <td className="px-4 py-3 text-sm font-medium text-[#1C1C1E]">
                            {repair.customers?.full_name || <span className="text-[#C0C0C0]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#1C1C1E]">{repair.item_type}</td>
                          <td className="px-4 py-3 text-sm text-[#6B6B6B]">{repair.item_description}</td>
                          <td className="px-4 py-3 text-sm text-[#9A9A9A]">—</td>
                          <td className="px-4 py-3 text-sm">
                            {repair.due_date ? (
                              <span className={overdue ? "text-red-500 font-medium" : "text-[#6B6B6B]"}>
                                {overdue ? "⚠ " : ""}
                                {new Date(repair.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              </span>
                            ) : (
                              <span className="text-[#C0C0C0]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={stageLabel} /></td>
                          <td className="px-4 py-3 text-sm text-[#6B6B6B]">—</td>
                          <td className="px-4 py-3">
                            <Link href={`/repairs/${repair.id}`} className="text-xs text-[#1a4731] font-semibold hover:underline">→</Link>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
