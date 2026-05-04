"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MagnifyingGlassIcon,
  InboxIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

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
      ? "nx-badge-warning"
      : status === "scheduled"
      ? "nx-badge-success"
      : status === "completed"
      ? "nx-badge-neutral"
      : "nx-badge-danger";
  return <span className={`${cls} capitalize`}>{status}</span>;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  // Initial status filter is taken from the URL (?status=new) so the
  // /admin dashboard's "Demo Requests" tile + the KPI tiles on this
  // page can deep-link into a filtered view. Defaults to "all".
  const initialStatus = (searchParams.get("status") as StatusFilter) || "all";
  const validStatuses: StatusFilter[] = ["all", "new", "scheduled", "completed", "declined"];
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    validStatuses.includes(initialStatus) ? initialStatus : "all",
  );
  const [search, setSearch] = useState("");

  // Keep URL ?status= in sync with filter clicks so a refresh / share-
  // a-link / back-button preserves the filter state.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (statusFilter === "all") params.delete("status");
    else params.set("status", statusFilter);
    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `?${next}` : "", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

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
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
            Admin
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
            Demo Requests
          </h1>
          <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
            Prospects who asked for a guided demo. Schedule, mark complete, or decline.
          </p>
        </div>

        {/* Filter pills + search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-2 overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 ${
                    active
                      ? "bg-stone-900 text-white"
                      : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex-1 sm:max-w-xs sm:ml-auto relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              placeholder="Search name, email, business…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
            />
          </div>
        </div>

        {/* Demo request list */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <InboxIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              No matching requests
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed">
              Try a different filter or clear your search to see all demo requests.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => {
              const fullName = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email;
              const detailHref = `/admin/demo-requests/${r.id}`;
              return (
                <Link
                  key={r.id}
                  href={detailHref}
                  className="group block bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2.5">
                        <StatusBadge status={r.status} />
                        <span className="text-xs text-stone-400">
                          {formatDate(r.created_at)}
                        </span>
                      </div>
                      <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                        {fullName}
                      </h3>
                      {r.business_name && (
                        <p className="text-sm text-stone-700 mt-1.5">
                          {r.business_name}
                          {r.num_stores && (
                            <span className="text-stone-400">
                              {" · "}
                              {r.num_stores} store{r.num_stores === "1" ? "" : "s"}
                            </span>
                          )}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-4 text-xs text-stone-500">
                        <span>{r.email}</span>
                        {r.country && <span>{r.country}</span>}
                        {r.plan && (
                          <span className="capitalize">Plan: {r.plan}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
                          Scheduled
                        </p>
                        <p className="text-sm text-stone-700 tabular-nums whitespace-nowrap">
                          {formatDateTime(r.scheduled_at)}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300">
                        View
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
