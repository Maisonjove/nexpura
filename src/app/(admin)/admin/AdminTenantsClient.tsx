"use client";

import { useState } from "react";
import Link from "next/link";
import RequestAccessModal from "./RequestAccessModal";

interface Tenant {
  id: string;
  name: string;
  created_at: string;
}

interface Subscription {
  tenant_id: string;
  plan: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

interface AccessStatus {
  status: "pending" | "approved";
  expiresAt?: string;
}

interface Props {
  tenants: Tenant[];
  subscriptions: Subscription[];
  accessStatuses: Record<string, AccessStatus>;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTimeRemaining(expiresAt: string) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  
  if (diffMs <= 0) return "Expired";
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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
      : p === "atelier" || p === "group" || p === "ultimate"
      ? "bg-amber-700/15 text-amber-700"
      : "bg-stone-200 text-stone-500";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {p || "—"}
    </span>
  );
}

function AccessBadge({ status, expiresAt }: { status: "pending" | "approved"; expiresAt?: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
        Pending
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Access ({expiresAt ? formatTimeRemaining(expiresAt) : "24h"})
    </span>
  );
}

export default function AdminTenantsClient({ tenants, subscriptions, accessStatuses }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<{ id: string; name: string } | null>(null);

  const subMap = new Map(subscriptions.map((s) => [s.tenant_id, s]));

  const handleRequestAccess = (tenant: Tenant) => {
    setSelectedTenant({ id: tenant.id, name: tenant.name });
    setModalOpen(true);
  };

  const handleEnterDashboard = async (tenantId: string) => {
    // Open in new tab with support access session
    window.open(`/api/support-access/enter?tenant=${tenantId}`, "_blank");
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/50">
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Business</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Plan</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Trial / Period End</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Signed Up</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Support Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-platinum">
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-stone-400">
                  No tenants yet
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => {
                const sub = subMap.get(tenant.id);
                const access = accessStatuses[tenant.id];

                return (
                  <tr key={tenant.id} className="hover:bg-stone-50/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-stone-900">
                      <Link href={`/admin/tenants/${tenant.id}`} className="hover:text-amber-700">
                        {tenant.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <PlanBadge plan={sub?.plan} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={sub?.status} />
                    </td>
                    <td className="px-6 py-4 text-stone-500">
                      {formatDate(sub?.trial_ends_at || sub?.current_period_end)}
                    </td>
                    <td className="px-6 py-4 text-stone-500">{formatDate(tenant.created_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {access ? (
                          <>
                            <AccessBadge status={access.status} expiresAt={access.expiresAt} />
                            {access.status === "approved" && (
                              <button
                                onClick={() => handleEnterDashboard(tenant.id)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                              >
                                Enter →
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => handleRequestAccess(tenant)}
                            className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
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

      {selectedTenant && (
        <RequestAccessModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedTenant(null);
          }}
          tenantId={selectedTenant.id}
          tenantName={selectedTenant.name}
        />
      )}
    </>
  );
}
