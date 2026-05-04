"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  users: { full_name: string | null; email: string | null } | null;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Props {
  logs: AuditLog[];
  teamMembers: TeamMember[];
  page: number;
  totalPages: number;
  totalCount: number;
  userFilter: string;
  typeFilter: string;
  dateFrom: string;
  dateTo: string;
}

const ENTITY_LABELS: Record<string, string> = {
  inventory: "Inventory",
  customer: "Customer",
  invoice: "Invoice",
  repair: "Repair",
  bespoke_job: "Bespoke Job",
  settings: "Settings",
  location: "Location",
  team_member: "Team Member",
  user: "User",
};

const ENTITY_BADGE_CLASS: Record<string, string> = {
  inventory: "nx-badge-info",
  customer: "nx-badge-info",
  invoice: "nx-badge-success",
  repair: "nx-badge-warning",
  bespoke_job: "nx-badge-warning",
  settings: "nx-badge-neutral",
  location: "nx-badge-neutral",
  team_member: "nx-badge-info",
  user: "nx-badge-info",
};

const ACTION_LABELS: Record<string, string> = {
  inventory_create: "Created inventory item",
  inventory_update: "Updated inventory item",
  inventory_delete: "Deleted inventory item",
  customer_create: "Created customer",
  customer_update: "Updated customer",
  customer_delete: "Deleted customer",
  invoice_create: "Created invoice",
  invoice_update: "Updated invoice",
  invoice_status_change: "Changed invoice status",
  invoice_delete: "Deleted invoice",
  repair_create: "Created repair",
  repair_update: "Updated repair",
  repair_stage_change: "Changed repair stage",
  bespoke_create: "Created bespoke job",
  bespoke_update: "Updated bespoke job",
  bespoke_stage_change: "Changed bespoke stage",
  settings_update: "Updated settings",
  team_member_create: "Added team member",
  team_member_update: "Updated team member",
  team_member_delete: "Removed team member",
  location_create: "Created location",
  location_update: "Updated location",
  login: "Logged in",
  logout: "Logged out",
};

function formatDate(date: string) {
  return new Date(date).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getChangeSummary(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): string[] {
  if (!oldData && newData) {
    // Created - show key fields
    const keys = Object.keys(newData).slice(0, 3);
    return keys.map(k => `${k}: ${String(newData[k]).slice(0, 30)}`);
  }

  if (oldData && newData) {
    // Updated - show what changed
    const changes: string[] = [];
    for (const key of Object.keys(newData)) {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        const oldVal = oldData[key] !== undefined ? String(oldData[key]).slice(0, 20) : "(empty)";
        const newVal = String(newData[key]).slice(0, 20);
        changes.push(`${key}: ${oldVal} → ${newVal}`);
      }
    }
    return changes.slice(0, 3);
  }

  return [];
}

export default function ActivityLogClient({
  logs,
  teamMembers,
  page,
  totalPages,
  totalCount,
  userFilter,
  typeFilter,
  dateFrom,
  dateTo,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [showFilters, setShowFilters] = useState(false);
  const [localUser, setLocalUser] = useState(userFilter);
  const [localType, setLocalType] = useState(typeFilter);
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo, setLocalTo] = useState(dateTo);

  function buildUrl(params: Record<string, string | number>) {
    const url = new URLSearchParams();
    if (params.user) url.set("user", String(params.user));
    if (params.type) url.set("type", String(params.type));
    if (params.from) url.set("from", String(params.from));
    if (params.to) url.set("to", String(params.to));
    if (params.page && params.page !== 1) url.set("page", String(params.page));
    const qs = url.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function applyFilters() {
    router.push(buildUrl({ user: localUser, type: localType, from: localFrom, to: localTo, page: 1 }));
  }

  function clearFilters() {
    setLocalUser("");
    setLocalType("");
    setLocalFrom("");
    setLocalTo("");
    router.push(pathname);
  }

  const hasFilters = userFilter || typeFilter || dateFrom || dateTo;

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div className="flex items-start gap-4">
            <Link
              href="/settings"
              className="mt-2 text-stone-400 hover:text-nexpura-bronze transition-colors duration-300"
              aria-label="Back to settings"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Settings
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
                Activity Log
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed tabular-nums">
                {totalCount} event{totalCount !== 1 ? "s" : ""} recorded across your workspace.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 inline-flex items-center gap-2 shrink-0 ${
              hasFilters
                ? "bg-stone-900 text-white"
                : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
            }`}
          >
            <FunnelIcon className="w-4 h-4" />
            Filters
            {hasFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-nexpura-bronze" />
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white border border-stone-200 rounded-2xl p-7 mb-10 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">User</label>
                <select
                  value={localUser}
                  onChange={(e) => setLocalUser(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                >
                  <option value="">All users</option>
                  {teamMembers.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.full_name || tm.email || "Unknown"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Entity Type</label>
                <select
                  value={localType}
                  onChange={(e) => setLocalType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                >
                  <option value="">All types</option>
                  {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">From</label>
                <input
                  type="date"
                  value={localFrom}
                  onChange={(e) => setLocalFrom(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">To</label>
                <input
                  type="date"
                  value={localTo}
                  onChange={(e) => setLocalTo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={applyFilters}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                Apply Filters
              </button>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors duration-300 inline-flex items-center gap-1.5"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Activity List */}
        {logs.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <ClockIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              No activity found
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed">
              {hasFilters
                ? "Try adjusting your filters to see more events."
                : "Activity will appear here as you and your team use the system."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const actionLabel = ACTION_LABELS[log.action] || log.action;
              const userName = log.users?.full_name || log.users?.email || "System";
              const entityLabel = ENTITY_LABELS[log.entity_type] || log.entity_type;
              const badgeClass = ENTITY_BADGE_CLASS[log.entity_type] || "nx-badge-neutral";
              const changes = getChangeSummary(log.old_data, log.new_data);

              return (
                <div
                  key={log.id}
                  className="group bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2.5">
                        <span className="font-mono text-xs text-stone-400 tabular-nums">
                          {formatDate(log.created_at)}
                        </span>
                        <span className={badgeClass}>{entityLabel}</span>
                      </div>
                      <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                        {actionLabel}
                      </h3>
                      <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                        by <span className="text-stone-700">{userName}</span>
                      </p>
                      {(log.entity_id || log.ip_address) && (
                        <div className="flex items-center gap-3 mt-4 text-xs text-stone-400 tabular-nums">
                          {log.entity_id && (
                            <span className="font-mono">{log.entity_id.slice(0, 8)}</span>
                          )}
                          {log.entity_id && log.ip_address && <span aria-hidden="true">·</span>}
                          {log.ip_address && <span className="font-mono">{log.ip_address}</span>}
                        </div>
                      )}
                      {changes.length > 0 && (
                        <div className="mt-4 text-xs text-stone-500 font-mono bg-stone-50 border border-stone-100 rounded-lg px-4 py-3 space-y-1 leading-relaxed">
                          {changes.map((change, i) => (
                            <div key={i}>{change}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-10 mt-2">
            <p className="text-xs text-stone-500 tabular-nums">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ user: userFilter, type: typeFilter, from: dateFrom, to: dateTo, page: page - 1 })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900 transition-all duration-300"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildUrl({ user: userFilter, type: typeFilter, from: dateFrom, to: dateTo, page: page + 1 })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900 transition-all duration-300"
                >
                  Next
                  <ChevronRightIcon className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
