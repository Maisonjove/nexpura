"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface DemoRequestSummary {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  business_name: string | null;
  plan: string | null;
  status: "new" | "scheduled" | "completed" | "declined";
  country: string | null;
  num_stores: string | null;
  created_at: string;
  scheduled_at: string | null;
}

type StatusFilter = "all" | "new" | "scheduled" | "completed" | "declined";

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

function StatusBadge({ status }: { status: DemoRequestSummary["status"] }) {
  const cls =
    status === "new"
      ? "bg-amber-50 text-amber-700"
      : status === "scheduled"
      ? "bg-emerald-50 text-emerald-700"
      : status === "completed"
      ? "bg-stone-100 text-stone-700"
      : "bg-red-50 text-red-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function DemoRequestsClient({ rows }: { rows: DemoRequestSummary[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        r.first_name,
        r.last_name ?? "",
        r.email,
        r.business_name ?? "",
        r.plan ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, statusFilter, search]);

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
      {/* Filter bar */}
      <div className="px-4 py-3 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  active
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 sm:max-w-xs sm:ml-auto">
          <input
            type="search"
            placeholder="Search name, email, business…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                Submitted
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                Prospect
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                Business
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                Plan
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                Scheduled
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-stone-400 text-sm">
                  No requests match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const fullName = [r.first_name, r.last_name].filter(Boolean).join(" ");
                return (
                  <tr key={r.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4 text-stone-500 whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/demo-requests/${r.id}`}
                        className="font-medium text-stone-900 hover:text-stone-600"
                      >
                        {fullName || r.email}
                      </Link>
                      <p className="text-xs text-stone-500 mt-0.5">{r.email}</p>
                    </td>
                    <td className="px-6 py-4 text-stone-700">
                      {r.business_name || "—"}
                      {r.num_stores && (
                        <p className="text-xs text-stone-400 mt-0.5">
                          {r.num_stores} store{r.num_stores === "1" ? "" : "s"}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-stone-600 capitalize">{r.plan || "—"}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-6 py-4 text-stone-500 whitespace-nowrap">
                      {formatDateTime(r.scheduled_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
