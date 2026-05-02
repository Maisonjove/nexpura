"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Users,
  FileText,
  Wrench,
  Gem,
  Settings,
  MapPin,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";

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

const ENTITY_ICONS: Record<string, typeof Package> = {
  inventory: Package,
  customer: Users,
  invoice: FileText,
  repair: Wrench,
  bespoke_job: Gem,
  settings: Settings,
  location: MapPin,
  team_member: UserCog,
  user: Users,
};

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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Activity Log</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              {totalCount} event{totalCount !== 1 ? "s" : ""} recorded
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
            hasFilters
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasFilters && (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">User</label>
              <select
                value={localUser}
                onChange={(e) => setLocalUser(e.target.value)}
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm focus:ring-nexpura-bronze focus:border-amber-500"
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
              <label className="block text-xs font-medium text-stone-500 mb-1">Entity Type</label>
              <select
                value={localType}
                onChange={(e) => setLocalType(e.target.value)}
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm focus:ring-nexpura-bronze focus:border-amber-500"
              >
                <option value="">All types</option>
                {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">From</label>
              <input
                type="date"
                value={localFrom}
                onChange={(e) => setLocalFrom(e.target.value)}
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm focus:ring-nexpura-bronze focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">To</label>
              <input
                type="date"
                value={localTo}
                onChange={(e) => setLocalTo(e.target.value)}
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm focus:ring-nexpura-bronze focus:border-amber-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors"
            >
              Apply Filters
            </button>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-stone-600 text-sm font-medium hover:text-stone-900 transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Activity List */}
      <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-stone-100 flex items-center justify-center">
              <Settings className="w-6 h-6 text-stone-400" />
            </div>
            <h3 className="font-medium text-stone-900 mb-1">No activity found</h3>
            <p className="text-sm text-stone-500">
              {hasFilters ? "Try adjusting your filters" : "Activity will appear here as you use the system"}
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const Icon = ENTITY_ICONS[log.entity_type] || Settings;
            const actionLabel = ACTION_LABELS[log.action] || log.action;
            const userName = log.users?.full_name || log.users?.email || "System";
            const changes = getChangeSummary(log.old_data, log.new_data);
            
            return (
              <div key={log.id} className="p-4 hover:bg-stone-50/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-stone-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-stone-900">{userName}</span>
                      <span className="text-sm text-stone-600">{actionLabel}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-stone-400">
                      <span>{formatDate(log.created_at)}</span>
                      {log.entity_id && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{log.entity_id.slice(0, 8)}</span>
                        </>
                      )}
                      {log.ip_address && (
                        <>
                          <span>•</span>
                          <span>{log.ip_address}</span>
                        </>
                      )}
                    </div>
                    {changes.length > 0 && (
                      <div className="mt-2 text-xs text-stone-500 font-mono bg-stone-50 rounded-lg px-3 py-2">
                        {changes.map((change, i) => (
                          <div key={i}>{change}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-stone-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildUrl({ user: userFilter, type: typeFilter, from: dateFrom, to: dateTo, page: page - 1 })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildUrl({ user: userFilter, type: typeFilter, from: dateFrom, to: dateTo, page: page + 1 })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
