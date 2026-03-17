import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

// The owner email that has access to this page
const OWNER_EMAIL = "germanijoey@yahoo.com";

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "active"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : s === "trialing"
      ? "bg-amber-50 text-amber-700 border border-amber-200"
      : s === "past_due"
      ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
      : s === "canceled" || s === "cancelled"
      ? "bg-red-50 text-red-600 border border-red-200"
      : s === "paused"
      ? "bg-stone-100 text-stone-600 border border-stone-200"
      : "bg-stone-100 text-stone-500 border border-stone-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${cls}`}>
      {s.replace("_", " ") || "—"}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  const p = (plan ?? "").toLowerCase();
  const cls =
    p === "studio" || p === "pro"
      ? "bg-blue-50 text-blue-700 border border-blue-200"
      : p === "atelier" || p === "group" || p === "ultimate"
      ? "bg-purple-50 text-purple-700 border border-purple-200"
      : "bg-stone-100 text-stone-600 border border-stone-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${cls}`}>
      {p || "boutique"}
    </span>
  );
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return `${Math.abs(diffDays)} days ago`;
  } else if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Tomorrow";
  } else if (diffDays <= 7) {
    return `In ${diffDays} days`;
  }
  return null;
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

export const metadata = { title: "All Memberships — Nexpura" };

export default async function MembershipsPage() {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Owner-only access check
  if (user.email !== OWNER_EMAIL) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // Fetch all tenants with their subscriptions and owner info
  const [tenantsResult, subscriptionsResult, usersResult] = await Promise.all([
    admin
      .from("tenants")
      .select("id, name, slug, business_type, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false }),
    admin
      .from("users")
      .select("id, tenant_id, email, full_name, role")
      .eq("role", "owner"),
  ]);

  const tenants = tenantsResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  const owners = usersResult.data ?? [];

  // Create lookup maps
  const subMap = new Map(subscriptions.map((s) => [s.tenant_id, s]));
  const ownerMap = new Map(owners.map((o) => [o.tenant_id, o]));

  // Calculate stats
  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const trialCount = subscriptions.filter((s) => s.status === "trialing").length;
  const pastDueCount = subscriptions.filter((s) => s.status === "past_due").length;
  const canceledCount = subscriptions.filter((s) => s.status === "canceled" || s.status === "cancelled").length;

  const mrr = subscriptions.reduce((sum, s) => {
    if (s.status === "active") {
      return sum + (PLAN_PRICES[s.plan] ?? 0);
    }
    return sum;
  }, 0);

  const potentialMrr = subscriptions.reduce((sum, s) => {
    if (s.status === "trialing") {
      return sum + (PLAN_PRICES[s.plan] ?? 0);
    }
    return sum;
  }, 0);

  const stats = [
    { label: "Total Tenants", value: tenants.length, color: "text-stone-900" },
    { label: "Active", value: activeCount, color: "text-emerald-600" },
    { label: "Trialing", value: trialCount, color: "text-amber-600" },
    { label: "Past Due", value: pastDueCount, color: "text-yellow-600" },
    { label: "Canceled", value: canceledCount, color: "text-red-600" },
    { label: "MRR", value: `$${mrr.toLocaleString()}`, color: "text-emerald-600" },
    { label: "Potential MRR", value: `$${potentialMrr.toLocaleString()}`, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-stone-400 hover:text-stone-600 transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 mt-2">All Memberships</h1>
          <p className="text-sm text-stone-500 mt-1">
            Platform-wide overview of all tenants and their subscriptions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
            🔒 Owner Only
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-stone-200 p-4"
          >
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">
              {stat.label}
            </p>
            <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Memberships Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/50">
          <h2 className="text-sm font-semibold text-stone-900">
            All Tenants ({tenants.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Business
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Owner
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Plan
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Trial Ends
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Renewal Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Stripe ID
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Signed Up
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-stone-400">
                    No tenants yet
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => {
                  const sub = subMap.get(tenant.id);
                  const owner = ownerMap.get(tenant.id);
                  const trialRelative = formatRelativeDate(sub?.trial_ends_at);
                  const renewalRelative = formatRelativeDate(sub?.current_period_end);

                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-stone-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-stone-900">
                            {tenant.name}
                          </p>
                          <p className="text-xs text-stone-400 mt-0.5">
                            {tenant.slug}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {owner ? (
                          <div>
                            <p className="text-stone-700">{owner.full_name || "—"}</p>
                            <p className="text-xs text-stone-400">{owner.email}</p>
                          </div>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <PlanBadge plan={sub?.plan} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={sub?.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-stone-600">
                            {formatDate(sub?.trial_ends_at)}
                          </p>
                          {trialRelative && sub?.status === "trialing" && (
                            <p className="text-xs text-amber-600 mt-0.5">
                              {trialRelative}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-stone-600">
                            {formatDate(sub?.current_period_end)}
                          </p>
                          {renewalRelative && sub?.status === "active" && (
                            <p className="text-xs text-stone-400 mt-0.5">
                              {renewalRelative}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {sub?.stripe_customer_id ? (
                          <code className="text-xs text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                            {sub.stripe_customer_id.slice(0, 18)}...
                          </code>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-stone-500">
                        {formatDate(tenant.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
