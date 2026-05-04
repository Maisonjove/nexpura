"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BuildingOffice2Icon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import RequestAccessModal from "../RequestAccessModal";

interface Subscription {
  plan: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

interface SupportAccess {
  tenant_id: string;
  status: string;
  expires_at: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  sub?: Subscription;
  ownerEmail: string;
  supportAccess?: SupportAccess;
}

interface Props {
  tenants: Tenant[];
  /** Per-currency MRR formatted as "A$1,200 · US$800 · £400 · €200".
   *  Joey 2026-05-03 — replaced the legacy single-AUD-number display
   *  to stop silently mis-summing non-AUD subs. Full breakdown +
   *  ≈ AUD total lives on /admin/revenue. */
  totalMRRDisplay: string;
  /** Count of subs whose currency was inferred from tenant.currency
   *  rather than recorded by Stripe. Surfaced as a small badge. */
  fallbackSubCount: number;
  activeTenants: number;
  trialTenants: number;
  query: string;
  planFilter: string;
  statusFilter: string;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "active"
      ? "nx-badge-success"
      : s === "trialing"
      ? "nx-badge-warning"
      : s === "past_due"
      ? "nx-badge-warning"
      : s === "canceled" || s === "cancelled"
      ? "nx-badge-danger"
      : "nx-badge-neutral";
  return (
    <span className={`${cls} capitalize`}>
      {s.replace("_", " ") || "—"}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  const p = (plan ?? "").toLowerCase();
  return (
    <span className="nx-badge-neutral capitalize">
      {p || "—"}
    </span>
  );
}

function SupportAccessBadge({ access }: { access?: SupportAccess }) {
  if (!access) return null;

  const status = access.status;
  if (status === "pending") {
    return <span className="nx-badge-warning">Access Pending</span>;
  }
  if (status === "approved" && access.expires_at) {
    const expiresAt = new Date(access.expires_at);
    const now = new Date();
    if (expiresAt > now) {
      const hoursLeft = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      return <span className="nx-badge-success">Access: {hoursLeft}h left</span>;
    }
  }
  return null;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const PLAN_OPTIONS = [
  { value: "", label: "All Plans" },
  { value: "boutique", label: "Boutique" },
  { value: "studio", label: "Studio" },
  { value: "atelier", label: "Atelier" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "trialing", label: "Trialing" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past Due" },
  { value: "canceled", label: "Cancelled" },
];

export default function TenantsClient({
  tenants,
  totalMRRDisplay,
  fallbackSubCount,
  activeTenants,
  trialTenants,
  query,
  planFilter,
  statusFilter
}: Props) {
  const [selectedTenant, setSelectedTenant] = useState<{ id: string; name: string } | null>(null);

  const hasFilters = !!(query || planFilter || statusFilter);
  const totalCount = tenants.length;

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Admin
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Tenants
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              {totalCount} tenant{totalCount !== 1 ? "s" : ""} across the Nexpura network.
            </p>
          </div>
        </div>

        {/* Stat strip */}
        <div className="bg-white border border-stone-200 rounded-2xl mb-10 overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-stone-200">
            <div className="p-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Total
              </p>
              <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight leading-none">
                {totalCount}
              </p>
            </div>
            <div className="p-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Active
              </p>
              <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight leading-none">
                {activeTenants}
              </p>
            </div>
            <div className="p-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Trialing
              </p>
              <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight leading-none">
                {trialTenants}
              </p>
            </div>
            <div className="p-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                MRR
              </p>
              <p className="font-serif text-2xl text-stone-900 tracking-tight leading-tight tabular-nums">
                {totalMRRDisplay}
              </p>
              {fallbackSubCount > 0 && (
                <p className="text-[11px] text-amber-700 mt-1.5">
                  incl. {fallbackSubCount} admin-set
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <form method="GET" className="mb-8 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search by business name or email…"
              className="flex-1 min-w-[240px] px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
            />
            <button type="submit" className="nx-btn-primary">
              Filter
            </button>
            {hasFilters && (
              <Link
                href="/admin/tenants"
                className="px-4 py-2 border border-stone-200 text-stone-600 rounded-md text-sm font-medium hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200"
              >
                Clear
              </Link>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mr-1">
              Plan
            </span>
            {PLAN_OPTIONS.map((opt) => {
              const isActive = (planFilter || "") === opt.value;
              const params = new URLSearchParams();
              if (query) params.set("q", query);
              if (opt.value) params.set("plan", opt.value);
              if (statusFilter) params.set("status", statusFilter);
              const href = params.toString()
                ? `/admin/tenants?${params.toString()}`
                : "/admin/tenants";
              return (
                <Link
                  key={`plan-${opt.value || "all"}`}
                  href={href}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all duration-300 ${
                    isActive
                      ? "bg-stone-900 text-white"
                      : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                  }`}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mr-1">
              Status
            </span>
            {STATUS_OPTIONS.map((opt) => {
              const isActive = (statusFilter || "") === opt.value;
              const params = new URLSearchParams();
              if (query) params.set("q", query);
              if (planFilter) params.set("plan", planFilter);
              if (opt.value) params.set("status", opt.value);
              const href = params.toString()
                ? `/admin/tenants?${params.toString()}`
                : "/admin/tenants";
              return (
                <Link
                  key={`status-${opt.value || "all"}`}
                  href={href}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all duration-300 ${
                    isActive
                      ? "bg-stone-900 text-white"
                      : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                  }`}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>

          {/* Hidden selects to preserve form submission for the Filter button */}
          <input type="hidden" name="plan" defaultValue={planFilter} />
          <input type="hidden" name="status" defaultValue={statusFilter} />
        </form>

        {/* Tenant list */}
        {tenants.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <BuildingOffice2Icon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              {hasFilters ? "No matching tenants" : "No tenants yet"}
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
              {hasFilters
                ? "Try clearing your filters or searching with a different term."
                : "Tenants will appear here as soon as the first business signs up."}
            </p>
            {hasFilters && (
              <Link href="/admin/tenants" className="nx-btn-primary inline-flex items-center gap-2">
                Clear filters
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {tenants.map((tenant) => {
              const hasActiveAccess =
                tenant.supportAccess?.status === "approved" &&
                tenant.supportAccess.expires_at &&
                new Date(tenant.supportAccess.expires_at) > new Date();
              const hasPendingAccess = tenant.supportAccess?.status === "pending";

              return (
                <div
                  key={tenant.id}
                  className="group bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2.5">
                        <PlanBadge plan={tenant.sub?.plan} />
                        <StatusBadge status={tenant.sub?.status} />
                        <SupportAccessBadge access={tenant.supportAccess} />
                      </div>
                      <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                        {tenant.name}
                      </h3>
                      <p className="text-sm text-stone-500 mt-1.5 leading-relaxed truncate">
                        {tenant.ownerEmail}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-4 text-xs text-stone-500">
                        <span>
                          Signed up{" "}
                          <span className="text-stone-700">
                            {formatDate(tenant.created_at)}
                          </span>
                        </span>
                        <span className="font-mono text-stone-400 tabular-nums">
                          {tenant.slug}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/tenants/${tenant.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-md hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200"
                        >
                          View
                          <ArrowRightIcon className="w-3.5 h-3.5" />
                        </Link>

                        {hasActiveAccess ? (
                          <Link
                            href={`/api/support-access/enter?tenantId=${tenant.id}`}
                            className="nx-btn-primary text-xs px-3 py-1.5"
                          >
                            Enter Dashboard
                          </Link>
                        ) : hasPendingAccess ? (
                          <span className="nx-badge-warning">Pending…</span>
                        ) : (
                          <button
                            onClick={() => setSelectedTenant({ id: tenant.id, name: tenant.name })}
                            className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-md hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200"
                          >
                            Request Access
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request Access Modal */}
      <RequestAccessModal
        isOpen={!!selectedTenant}
        onClose={() => setSelectedTenant(null)}
        tenantId={selectedTenant?.id ?? ""}
        tenantName={selectedTenant?.name ?? ""}
      />
    </div>
  );
}
