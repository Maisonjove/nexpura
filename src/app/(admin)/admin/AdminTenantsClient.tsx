"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BuildingOffice2Icon,
  ClockIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
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
      ? "nx-badge-success"
      : s === "trialing"
      ? "nx-badge-warning"
      : s === "past_due"
      ? "nx-badge-warning"
      : s === ""
      ? "nx-badge-neutral"
      : "nx-badge-danger";
  return (
    <span className={`${cls} capitalize`}>{s.replace("_", " ") || "—"}</span>
  );
}

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  const p = (plan ?? "").toLowerCase();
  return <span className="nx-badge-neutral capitalize">{p || "—"}</span>;
}

function AccessBadge({ status, expiresAt }: { status: "pending" | "approved"; expiresAt?: string }) {
  if (status === "pending") {
    return (
      <span className="nx-badge-warning gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Pending
      </span>
    );
  }

  return (
    <span className="nx-badge-success gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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

  if (tenants.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
        <BuildingOffice2Icon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
        <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
          No tenants yet
        </h3>
        <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed">
          New signups will appear here as they create accounts.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {tenants.map((tenant) => {
          const sub = subMap.get(tenant.id);
          const access = accessStatuses[tenant.id];

          return (
            <div
              key={tenant.id}
              className="group bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
                    <PlanBadge plan={sub?.plan} />
                    <StatusBadge status={sub?.status} />
                  </div>
                  <Link
                    href={`/admin/tenants/${tenant.id}`}
                    className="font-serif text-xl text-stone-900 leading-tight tracking-tight hover:text-nexpura-bronze transition-colors duration-200"
                  >
                    {tenant.name}
                  </Link>

                  <div className="flex items-center gap-5 flex-wrap mt-4 text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5 text-stone-400" />
                      Signed up {formatDate(tenant.created_at)}
                    </span>
                    {(sub?.trial_ends_at || sub?.current_period_end) && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-stone-400">·</span>
                        {sub?.trial_ends_at ? "Trial ends" : "Period ends"}{" "}
                        <span className="text-stone-700">
                          {formatDate(sub?.trial_ends_at || sub?.current_period_end)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  {access ? (
                    <>
                      <AccessBadge status={access.status} expiresAt={access.expiresAt} />
                      {access.status === "approved" && (
                        <button
                          onClick={() => handleEnterDashboard(tenant.id)}
                          className="nx-btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
                        >
                          Enter
                          <ArrowRightIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleRequestAccess(tenant)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-stone-700 bg-white border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-colors duration-200"
                    >
                      <ShieldCheckIcon className="w-3.5 h-3.5" />
                      Request Access
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
