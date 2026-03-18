"use client";

import { useState } from "react";
import Link from "next/link";
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
  totalMRR: number;
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
      ? "bg-stone-100 text-amber-700"
      : s === "trialing"
      ? "bg-amber-700/10 text-amber-700"
      : s === "past_due"
      ? "bg-yellow-500/10 text-yellow-700"
      : "bg-red-500/10 text-red-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {s.replace("_", " ") || "—"}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  const p = (plan ?? "").toLowerCase();
  const cls =
    p === "studio" || p === "pro"
      ? "bg-stone-100 text-amber-700"
      : p === "group" || p === "ultimate"
      ? "bg-amber-700/15 text-amber-700"
      : "bg-stone-200 text-stone-500";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {p || "—"}
    </span>
  );
}

function SupportAccessBadge({ access }: { access?: SupportAccess }) {
  if (!access) return null;
  
  const status = access.status;
  if (status === "pending") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        Access Pending
      </span>
    );
  }
  if (status === "approved" && access.expires_at) {
    const expiresAt = new Date(access.expires_at);
    const now = new Date();
    if (expiresAt > now) {
      const hoursLeft = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          Access: {hoursLeft}h left
        </span>
      );
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

export default function TenantsClient({ 
  tenants, 
  totalMRR, 
  activeTenants, 
  trialTenants,
  query,
  planFilter,
  statusFilter
}: Props) {
  const [selectedTenant, setSelectedTenant] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Tenants</h1>
          <p className="text-sm text-stone-500 mt-1">
            {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">MRR</p>
            <p className="text-xl font-bold text-green-700">${totalMRR}/mo</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Active</p>
            <p className="text-xl font-bold text-stone-900">{activeTenants}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Trialing</p>
            <p className="text-xl font-bold text-stone-600">{trialTenants}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search by business name or email…"
          className="flex-1 min-w-[200px] px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30"
        />
        <select
          name="plan"
          defaultValue={planFilter}
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30"
        >
          <option value="">All Plans</option>
          <option value="boutique">Boutique</option>
          <option value="studio">Studio</option>
          <option value="group">Group</option>
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30"
        >
          <option value="">All Statuses</option>
          <option value="trialing">Trialing</option>
          <option value="active">Active</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Cancelled</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors"
        >
          Filter
        </button>
        {(query || planFilter || statusFilter) && (
          <Link
            href="/admin/tenants"
            className="px-4 py-2 border border-stone-200 text-stone-500 rounded-lg text-sm hover:bg-stone-50 transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Business</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Owner Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Support Access</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Signed Up</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-stone-400">
                    No tenants found
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => {
                  const hasActiveAccess = tenant.supportAccess?.status === "approved" && 
                    tenant.supportAccess.expires_at && 
                    new Date(tenant.supportAccess.expires_at) > new Date();
                  const hasPendingAccess = tenant.supportAccess?.status === "pending";
                  
                  return (
                    <tr key={tenant.id} className="hover:bg-stone-50/40 transition-colors">
                      <td className="px-6 py-4 font-medium text-stone-900">{tenant.name}</td>
                      <td className="px-6 py-4 text-stone-500">{tenant.ownerEmail}</td>
                      <td className="px-6 py-4">
                        <PlanBadge plan={tenant.sub?.plan} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={tenant.sub?.status} />
                      </td>
                      <td className="px-6 py-4">
                        <SupportAccessBadge access={tenant.supportAccess} />
                      </td>
                      <td className="px-6 py-4 text-stone-500">{formatDate(tenant.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/tenants/${tenant.id}`}
                            className="px-3 py-1.5 text-xs bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors"
                          >
                            View
                          </Link>
                          
                          {hasActiveAccess ? (
                            <Link
                              href={`/api/support-access/enter?tenantId=${tenant.id}`}
                              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              Enter Dashboard
                            </Link>
                          ) : hasPendingAccess ? (
                            <span className="px-3 py-1.5 text-xs bg-yellow-100 text-yellow-700 rounded-lg">
                              Pending...
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedTenant({ id: tenant.id, name: tenant.name })}
                              className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                            >
                              Request Access
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
