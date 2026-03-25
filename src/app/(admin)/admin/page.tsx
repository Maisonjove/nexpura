import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantAccessStatuses } from "@/lib/support-access";
import Link from "next/link";
import AdminTenantsClient from "./AdminTenantsClient";
import logger from "@/lib/logger";

// Force dynamic rendering - don't pre-render at build time
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const PLAN_PRICES: Record<string, number> = {
  boutique: 89,
  studio: 179,
  atelier: 299,
  // Legacy aliases
  group: 299,
  basic: 89,
  pro: 179,
  ultimate: 299,
};

export default async function AdminDashboardPage() {
  // Handle build-time or when Supabase is down
  let tenants: { id: string; name: string; created_at: string }[] | null = null;
  let subscriptions: { tenant_id: string; plan: string; status: string; trial_ends_at: string | null; current_period_end: string | null }[] | null = null;
  
  try {
    const adminClient = createAdminClient();

    // Fetch all tenants
    const tenantsRes = await adminClient
      .from("tenants")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });
    tenants = tenantsRes.data;

    // Fetch all subscriptions
    const subsRes = await adminClient
      .from("subscriptions")
      .select("tenant_id, plan, status, trial_ends_at, current_period_end");
    subscriptions = subsRes.data;
  } catch (error) {
    logger.error("Failed to fetch admin data:", error);
    // Return empty state if Supabase is unavailable
    tenants = [];
    subscriptions = [];
  }

  const subMap = new Map(
    (subscriptions ?? []).map((s) => [s.tenant_id, s])
  );

  // Fetch support access statuses
  const tenantIds = (tenants ?? []).map((t) => t.id);
  let accessStatuses: Record<string, { status: "pending" | "approved"; expiresAt?: string }> = {};
  try {
    const accessStatusMap = await getTenantAccessStatuses(tenantIds);
    accessStatusMap.forEach((value, key) => {
      accessStatuses[key] = {
        status: value.status as "pending" | "approved",
        expiresAt: value.expiresAt,
      };
    });
  } catch {
    // Ignore if support access check fails
  }

  const totalTenants = tenants?.length ?? 0;

  const activeCount = (subscriptions ?? []).filter(
    (s) => s.status === "active"
  ).length;

  const trialCount = (subscriptions ?? []).filter(
    (s) => s.status === "trialing"
  ).length;

  const suspendedCount = (subscriptions ?? []).filter(
    (s) => s.status === "suspended"
  ).length;

  const mrr = (subscriptions ?? []).reduce((sum, s) => {
    if (s.status === "active" || s.status === "trialing") {
      return sum + (PLAN_PRICES[s.plan] ?? 0);
    }
    return sum;
  }, 0);

  const recentTenants = (tenants ?? []).slice(0, 10);

  const stats = [
    { label: "Total Tenants", value: totalTenants, accent: false },
    { label: "Active (Paying)", value: activeCount, accent: true },
    { label: "Trialing", value: trialCount, accent: false },
    { label: "Suspended", value: suspendedCount, accent: false },
    { label: "Est. MRR", value: `$${mrr.toLocaleString()}`, accent: true },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Admin Dashboard</h1>
        <p className="text-sm text-stone-500 mt-1">Platform overview and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-white rounded-xl border border-stone-200 p-4 ${
              stat.accent ? "ring-1 ring-sage/30" : ""
            }`}
          >
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${stat.accent ? "text-amber-700" : "text-stone-900"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Signups */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Recent Signups</h2>
          <Link href="/admin/tenants" className="text-sm text-amber-700 hover:underline">
            View all →
          </Link>
        </div>
        <AdminTenantsClient
          tenants={recentTenants}
          subscriptions={subscriptions ?? []}
          accessStatuses={accessStatuses}
        />
      </div>
    </div>
  );
}
