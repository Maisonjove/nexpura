import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  Users, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  DollarSign,
  ArrowUpRight,
  Building2,
  CreditCard,
  XCircle
} from "lucide-react";

const OWNER_EMAIL = "germanijoey@yahoo.com";

const PLAN_PRICES: Record<string, number> = {
  boutique: 89,
  basic: 89,
  studio: 179,
  pro: 179,
  atelier: 299,
  group: 299,
  ultimate: 299,
};

export const metadata = { title: "Owner Dashboard — Nexpura" };

export default async function OwnerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== OWNER_EMAIL) {
    redirect("/owner-admin");
  }

  const admin = createAdminClient();

  // Fetch all data in parallel
  const [tenantsResult, subscriptionsResult, accessRequestsResult, recentTenantsResult] = await Promise.all([
    admin.from("tenants").select("id, name, created_at").order("created_at", { ascending: false }),
    admin.from("subscriptions").select("*"),
    admin.from("owner_access_requests").select("*, tenants(name)").order("requested_at", { ascending: false }).limit(5),
    admin.from("tenants").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const tenants = tenantsResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  const accessRequests = accessRequestsResult.data ?? [];
  const recentTenants = recentTenantsResult.data ?? [];

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

  const pendingAccessCount = accessRequests.filter((r) => r.status === "pending").length;

  // Format date helper
  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatRelativeTime(dateStr: string | null | undefined) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Owner Dashboard</h1>
        <p className="text-stone-400 text-sm mt-1">Platform overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          icon={Building2} 
          label="Total Tenants" 
          value={tenants.length} 
          color="text-white"
          bgColor="bg-white/5"
        />
        <StatCard 
          icon={DollarSign} 
          label="MRR" 
          value={`$${mrr.toLocaleString()}`} 
          color="text-emerald-400"
          bgColor="bg-emerald-500/10"
          subtext={`+$${potentialMrr.toLocaleString()} potential`}
        />
        <StatCard 
          icon={Users} 
          label="Active" 
          value={activeCount} 
          color="text-emerald-400"
          bgColor="bg-emerald-500/10"
        />
        <StatCard 
          icon={Clock} 
          label="Trialing" 
          value={trialCount} 
          color="text-amber-400"
          bgColor="bg-amber-500/10"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard 
          icon={CreditCard} 
          label="Past Due" 
          value={pastDueCount} 
          color="text-yellow-400"
          bgColor="bg-yellow-500/10"
          small
        />
        <StatCard 
          icon={XCircle} 
          label="Canceled" 
          value={canceledCount} 
          color="text-red-400"
          bgColor="bg-red-500/10"
          small
        />
        <StatCard 
          icon={AlertTriangle} 
          label="Pending Access" 
          value={pendingAccessCount} 
          color="text-amber-400"
          bgColor="bg-amber-500/10"
          small
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link
          href="/owner-admin/memberships"
          className="group flex items-center justify-between p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Users size={24} className="text-amber-500" />
            </div>
            <div>
              <p className="text-white font-medium">Manage Memberships</p>
              <p className="text-stone-400 text-sm">View all tenants, plans, and subscriptions</p>
            </div>
          </div>
          <ArrowUpRight size={20} className="text-stone-500 group-hover:text-amber-500 transition-colors" />
        </Link>

        <Link
          href="/owner-admin/access-requests"
          className="group flex items-center justify-between p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock size={24} className="text-amber-500" />
            </div>
            <div>
              <p className="text-white font-medium">Access Requests</p>
              <p className="text-stone-400 text-sm">
                {pendingAccessCount > 0 
                  ? `${pendingAccessCount} pending request${pendingAccessCount !== 1 ? 's' : ''}` 
                  : 'Request dashboard access to tenants'}
              </p>
            </div>
          </div>
          <ArrowUpRight size={20} className="text-stone-500 group-hover:text-amber-500 transition-colors" />
        </Link>
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Tenants */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-white">Recent Sign-ups</h2>
            <Link href="/owner-admin/memberships" className="text-xs text-amber-500 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {recentTenants.length === 0 ? (
              <div className="px-6 py-8 text-center text-stone-500 text-sm">
                No tenants yet
              </div>
            ) : (
              recentTenants.map((tenant) => (
                <div key={tenant.id} className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-white">{tenant.name}</p>
                    <p className="text-xs text-stone-500">{formatDate(tenant.created_at)}</p>
                  </div>
                  <span className="text-xs text-stone-400">{formatRelativeTime(tenant.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Access Requests */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-white">Recent Access Requests</h2>
            <Link href="/owner-admin/access-requests" className="text-xs text-amber-500 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {accessRequests.length === 0 ? (
              <div className="px-6 py-8 text-center text-stone-500 text-sm">
                No access requests yet
              </div>
            ) : (
              accessRequests.map((request) => (
                <div key={request.id} className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {(request.tenants as { name: string } | null)?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-stone-500">{formatDate(request.requested_at)}</p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  bgColor,
  subtext,
  small = false
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number;
  color: string;
  bgColor: string;
  subtext?: string;
  small?: boolean;
}) {
  return (
    <div className={`${bgColor} border border-white/10 rounded-xl ${small ? 'p-4' : 'p-6'}`}>
      <div className="flex items-center gap-3 mb-2">
        <Icon size={small ? 16 : 20} className={color} />
        <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`${small ? 'text-xl' : 'text-3xl'} font-semibold ${color}`}>{value}</p>
      {subtext && <p className="text-xs text-stone-500 mt-1">{subtext}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    denied: "bg-red-500/20 text-red-400 border-red-500/30",
    expired: "bg-stone-500/20 text-stone-400 border-stone-500/30",
    revoked: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize border ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}
