"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Filter, 
  Users, 
  Calendar, 
  CreditCard, 
  Eye, 
  Clock,
  Plus,
  Pause,
  Play,
  XCircle,
  ArrowUpRight,
  ChevronDown
} from "lucide-react";
import { 
  requestAccess, 
  extendSubscription, 
  changePlan, 
  pauseSubscription, 
  cancelSubscription,
  resumeSubscription
} from "./actions";

type TenantData = {
  id: string;
  name: string;
  slug: string | null;
  businessType: string | null;
  createdAt: string | null;
  owner: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  subscription: {
    id: string;
    plan: string | null;
    status: string | null;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  } | null;
  accessRequest: {
    id: string;
    status: string;
    expiresAt: string | null;
  } | null;
};

interface MembershipsClientProps {
  tenants: TenantData[];
}

const PLAN_PRICES: Record<string, number> = {
  boutique: 89,
  basic: 89,
  studio: 179,
  pro: 179,
  atelier: 299,
  group: 299,
  ultimate: 299,
};

const PLANS = ["boutique", "studio", "atelier"];

export default function MembershipsClient({ tenants }: MembershipsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTenant, setSelectedTenant] = useState<TenantData | null>(null);
  const [modalType, setModalType] = useState<"extend" | "plan" | "pause" | "cancel" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form states
  const [extendDays, setExtendDays] = useState(30);
  const [newPlan, setNewPlan] = useState("studio");

  // Filter tenants
  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch = 
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.owner?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.slug?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const status = tenant.subscription?.status ?? "none";
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.subscription?.status === "active").length,
    trialing: tenants.filter((t) => t.subscription?.status === "trialing").length,
    pastDue: tenants.filter((t) => t.subscription?.status === "past_due").length,
    canceled: tenants.filter((t) => t.subscription?.status === "canceled" || t.subscription?.status === "cancelled").length,
    mrr: tenants.reduce((sum, t) => {
      if (t.subscription?.status === "active") {
        return sum + (PLAN_PRICES[t.subscription?.plan ?? ""] ?? 0);
      }
      return sum;
    }, 0),
  };

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function getRelativeDate(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays <= 7) return `In ${diffDays}d`;
    return null;
  }

  async function handleRequestAccess(tenantId: string) {
    setActionLoading(true);
    setActionError(null);
    try {
      await requestAccess(tenantId);
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to request access");
    }
    setActionLoading(false);
  }

  async function handleExtendSubscription() {
    if (!selectedTenant) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await extendSubscription(selectedTenant.id, extendDays);
      setModalType(null);
      setSelectedTenant(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to extend subscription");
    }
    setActionLoading(false);
  }

  async function handleChangePlan() {
    if (!selectedTenant) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await changePlan(selectedTenant.id, newPlan);
      setModalType(null);
      setSelectedTenant(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to change plan");
    }
    setActionLoading(false);
  }

  async function handlePauseSubscription() {
    if (!selectedTenant) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await pauseSubscription(selectedTenant.id);
      setModalType(null);
      setSelectedTenant(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to pause subscription");
    }
    setActionLoading(false);
  }

  async function handleCancelSubscription() {
    if (!selectedTenant) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await cancelSubscription(selectedTenant.id);
      setModalType(null);
      setSelectedTenant(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel subscription");
    }
    setActionLoading(false);
  }

  async function handleResumeSubscription(tenantId: string) {
    setActionLoading(true);
    setActionError(null);
    try {
      await resumeSubscription(tenantId);
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to resume subscription");
    }
    setActionLoading(false);
  }

  function viewTenantDashboard(tenantId: string) {
    window.open(`/dashboard?owner_view=${tenantId}`, "_blank");
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Memberships</h1>
          <p className="text-stone-400 text-sm mt-1">Manage all tenant subscriptions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-400">${stats.mrr.toLocaleString()}</p>
            <p className="text-xs text-stone-500">Monthly Recurring Revenue</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Active", value: stats.active, color: "text-emerald-400" },
          { label: "Trialing", value: stats.trialing, color: "text-amber-400" },
          { label: "Past Due", value: stats.pastDue, color: "text-yellow-400" },
          { label: "Canceled", value: stats.canceled, color: "text-red-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
            <p className="text-xs text-stone-400">{stat.label}</p>
            <p className={`text-xl font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past Due</option>
            <option value="paused">Paused</option>
            <option value="canceled">Canceled</option>
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
        </div>
      </div>

      {/* Error message */}
      {actionError && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {actionError}
        </div>
      )}

      {/* Tenants Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-6 py-4 text-xs font-medium text-stone-400 uppercase tracking-wide">Business</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-stone-400 uppercase tracking-wide">Owner</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-stone-400 uppercase tracking-wide">Plan</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-stone-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-stone-400 uppercase tracking-wide">Renewal</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-stone-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                    No tenants found
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  const hasApprovedAccess = tenant.accessRequest?.status === "approved" && 
                    (!tenant.accessRequest.expiresAt || new Date(tenant.accessRequest.expiresAt) > new Date());
                  const hasPendingAccess = tenant.accessRequest?.status === "pending";

                  return (
                    <tr key={tenant.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{tenant.name}</p>
                          <p className="text-xs text-stone-500">{tenant.slug}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {tenant.owner ? (
                          <div>
                            <p className="text-stone-300">{tenant.owner.fullName || "—"}</p>
                            <p className="text-xs text-stone-500">{tenant.owner.email}</p>
                          </div>
                        ) : (
                          <span className="text-stone-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <PlanBadge plan={tenant.subscription?.plan} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={tenant.subscription?.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-stone-300">{formatDate(tenant.subscription?.currentPeriodEnd)}</p>
                          {getRelativeDate(tenant.subscription?.currentPeriodEnd) && (
                            <p className="text-xs text-stone-500">
                              {getRelativeDate(tenant.subscription?.currentPeriodEnd)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* View Dashboard */}
                          {hasApprovedAccess ? (
                            <button
                              onClick={() => viewTenantDashboard(tenant.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                            >
                              <Eye size={14} />
                              View
                            </button>
                          ) : hasPendingAccess ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium">
                              <Clock size={14} />
                              Pending
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRequestAccess(tenant.id)}
                              disabled={actionLoading}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-stone-300 rounded-lg text-xs font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
                            >
                              <Eye size={14} />
                              Request
                            </button>
                          )}

                          {/* Actions dropdown */}
                          <div className="relative group">
                            <button className="p-1.5 rounded-lg bg-white/10 text-stone-400 hover:bg-white/20 hover:text-white transition-colors">
                              <ChevronDown size={16} />
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-48 bg-stone-800 border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                              <div className="py-1">
                                <button
                                  onClick={() => { setSelectedTenant(tenant); setModalType("extend"); }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-stone-300 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                  <Plus size={14} />
                                  Extend Subscription
                                </button>
                                <button
                                  onClick={() => { setSelectedTenant(tenant); setNewPlan(tenant.subscription?.plan ?? "studio"); setModalType("plan"); }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-stone-300 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                  <ArrowUpRight size={14} />
                                  Change Plan
                                </button>
                                {tenant.subscription?.status === "paused" ? (
                                  <button
                                    onClick={() => handleResumeSubscription(tenant.id)}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-400 hover:bg-white/10 transition-colors"
                                  >
                                    <Play size={14} />
                                    Resume Subscription
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { setSelectedTenant(tenant); setModalType("pause"); }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-400 hover:bg-white/10 transition-colors"
                                  >
                                    <Pause size={14} />
                                    Pause Subscription
                                  </button>
                                )}
                                <button
                                  onClick={() => { setSelectedTenant(tenant); setModalType("cancel"); }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-white/10 transition-colors"
                                >
                                  <XCircle size={14} />
                                  Cancel Subscription
                                </button>
                              </div>
                            </div>
                          </div>
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

      {/* Modals */}
      {modalType && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-stone-800 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            {modalType === "extend" && (
              <>
                <h2 className="text-lg font-semibold text-white mb-4">Extend Subscription</h2>
                <p className="text-sm text-stone-400 mb-4">
                  Add free days to <span className="text-white font-medium">{selectedTenant.name}</span>&apos;s subscription.
                </p>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                    Days to add
                  </label>
                  <select
                    value={extendDays}
                    onChange={(e) => setExtendDays(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days (1 month)</option>
                    <option value={60}>60 days (2 months)</option>
                    <option value={90}>90 days (3 months)</option>
                  </select>
                </div>
                {actionError && (
                  <p className="text-red-400 text-sm mb-4">{actionError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setModalType(null); setSelectedTenant(null); setActionError(null); }}
                    className="flex-1 px-4 py-2.5 bg-white/10 text-stone-300 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExtendSubscription}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Extending..." : "Extend"}
                  </button>
                </div>
              </>
            )}

            {modalType === "plan" && (
              <>
                <h2 className="text-lg font-semibold text-white mb-4">Change Plan</h2>
                <p className="text-sm text-stone-400 mb-4">
                  Change <span className="text-white font-medium">{selectedTenant.name}</span>&apos;s subscription plan.
                </p>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                    New plan
                  </label>
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    {PLANS.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan.charAt(0).toUpperCase() + plan.slice(1)} (${PLAN_PRICES[plan]}/mo)
                      </option>
                    ))}
                  </select>
                </div>
                {actionError && (
                  <p className="text-red-400 text-sm mb-4">{actionError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setModalType(null); setSelectedTenant(null); setActionError(null); }}
                    className="flex-1 px-4 py-2.5 bg-white/10 text-stone-300 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePlan}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Changing..." : "Change Plan"}
                  </button>
                </div>
              </>
            )}

            {modalType === "pause" && (
              <>
                <h2 className="text-lg font-semibold text-white mb-4">Pause Subscription</h2>
                <p className="text-sm text-stone-400 mb-4">
                  Are you sure you want to pause <span className="text-white font-medium">{selectedTenant.name}</span>&apos;s subscription?
                  They will retain access until the current period ends.
                </p>
                {actionError && (
                  <p className="text-red-400 text-sm mb-4">{actionError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setModalType(null); setSelectedTenant(null); setActionError(null); }}
                    className="flex-1 px-4 py-2.5 bg-white/10 text-stone-300 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePauseSubscription}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Pausing..." : "Pause Subscription"}
                  </button>
                </div>
              </>
            )}

            {modalType === "cancel" && (
              <>
                <h2 className="text-lg font-semibold text-red-400 mb-4">Cancel Subscription</h2>
                <p className="text-sm text-stone-400 mb-4">
                  Are you sure you want to cancel <span className="text-white font-medium">{selectedTenant.name}</span>&apos;s subscription?
                  This action cannot be undone. They will retain access until the current period ends.
                </p>
                {actionError && (
                  <p className="text-red-400 text-sm mb-4">{actionError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setModalType(null); setSelectedTenant(null); setActionError(null); }}
                    className="flex-1 px-4 py-2.5 bg-white/10 text-stone-300 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
                  >
                    Keep Active
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Canceling..." : "Cancel Subscription"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const styles: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    trialing: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    past_due: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    paused: "bg-stone-500/20 text-stone-400 border-stone-500/30",
    canceled: "bg-red-500/20 text-red-400 border-red-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${styles[s] ?? "bg-stone-500/20 text-stone-400 border-stone-500/30"}`}>
      {s.replace("_", " ") || "—"}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  const p = (plan ?? "").toLowerCase();
  const styles: Record<string, string> = {
    boutique: "bg-stone-500/20 text-stone-300 border-stone-500/30",
    basic: "bg-stone-500/20 text-stone-300 border-stone-500/30",
    studio: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    pro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    atelier: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    group: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    ultimate: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${styles[p] ?? styles.boutique}`}>
      {p || "boutique"}
    </span>
  );
}
