import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import TenantActions from "./TenantActions";

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-stone-200 last:border-b-0">
      <span className="text-sm text-stone-500 font-medium">{label}</span>
      <span className="text-sm text-stone-900 text-right max-w-[60%] break-all">{value ?? "—"}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "active"
      ? "bg-stone-100 text-[#8B7355]"
      : s === "trialing"
      ? "bg-[#8B7355]/10 text-[#8B7355]"
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
    p === "pro"
      ? "bg-stone-100 text-[#8B7355]"
      : p === "ultimate"
      ? "bg-[#8B7355]/15 text-[#8B7355]"
      : "bg-stone-200 text-stone-500";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {p || "—"}
    </span>
  );
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const adminClient = createAdminClient();

  // Fetch tenant
  const { data: tenant } = await adminClient
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();

  if (!tenant) notFound();

  // Fetch subscription
  const { data: sub } = await adminClient
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", id)
    .single();

  // Fetch owner
  const { data: owner } = await adminClient
    .from("users")
    .select("full_name, email")
    .eq("tenant_id", id)
    .eq("role", "owner")
    .single();

  // Count users
  const { count: userCount } = await adminClient
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", id);

  // Count customers
  const { count: customerCount } = await adminClient
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", id);

  // Count inventory, repairs, invoices
  const [{ count: inventoryCount }, { count: repairCount }, { count: invoiceCount }] = await Promise.all([
    adminClient.from("inventory_items").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    adminClient.from("repairs").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    adminClient.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", id),
  ]);

  // Fetch last 20 activity logs
  const { data: activityLogs } = await adminClient
    .from("staff_activity_logs")
    .select("id, action, entity_type, entity_id, created_at, users(full_name)")
    .eq("tenant_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
        </svg>
        Back to Tenants
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold font-semibold text-stone-900">{tenant.name}</h1>
          <p className="text-sm text-stone-500 mt-1">/{tenant.slug} · {tenant.business_type ?? "—"}</p>
        </div>
        <div className="flex gap-2 items-center">
          <PlanBadge plan={sub?.plan} />
          <StatusBadge status={sub?.status} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left col: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Info */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-base font-semibold text-stone-900 font-semibold mb-4">Business</h2>
            <InfoRow label="Name" value={tenant.name} />
            <InfoRow label="Slug" value={tenant.slug} />
            <InfoRow label="Business Type" value={tenant.business_type} />
            <InfoRow label="Created" value={formatDate(tenant.created_at)} />
          </div>

          {/* Owner */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-base font-semibold text-stone-900 font-semibold mb-4">Owner</h2>
            <InfoRow label="Name" value={owner?.full_name} />
            <InfoRow label="Email" value={owner?.email} />
          </div>

          {/* Subscription */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-base font-semibold text-stone-900 font-semibold mb-4">Subscription</h2>
            <InfoRow label="Plan" value={<PlanBadge plan={sub?.plan} />} />
            <InfoRow label="Status" value={<StatusBadge status={sub?.status} />} />
            <InfoRow label="Trial Ends" value={formatDate(sub?.trial_ends_at)} />
            <InfoRow label="Current Period End" value={formatDate(sub?.current_period_end)} />
            <InfoRow label="Stripe Customer ID" value={sub?.stripe_customer_id} />
            <InfoRow label="Stripe Subscription ID" value={sub?.stripe_sub_id} />
          </div>

          {/* Usage */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-base font-semibold text-stone-900 font-semibold mb-4">Usage</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Team Members", count: userCount ?? 0 },
                { label: "Customers", count: customerCount ?? 0 },
                { label: "Inventory Items", count: inventoryCount ?? 0 },
                { label: "Repairs", count: repairCount ?? 0 },
                { label: "Invoices", count: invoiceCount ?? 0 },
              ].map((item) => (
                <div key={item.label} className="bg-stone-50 rounded-lg p-3">
                  <p className="text-xs text-stone-500 mb-1">{item.label}</p>
                  <p className="text-xl font-bold text-stone-900">{item.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Log */}
          {activityLogs && activityLogs.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="text-base font-semibold text-stone-900 font-semibold mb-4">Recent Activity</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-stone-100 last:border-0">
                    <span className="text-xs text-stone-400 whitespace-nowrap mt-0.5 w-24 flex-shrink-0">
                      {new Date(log.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </span>
                    <span className="text-xs text-stone-700 flex-1">
                      <span className="font-medium capitalize">{log.action?.replace(/_/g, " ")}</span>
                      {log.entity_type && <span className="text-stone-400"> · {log.entity_type}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right col: Actions */}
        <div>
          <TenantActions
            tenantId={id}
            currentPlan={sub?.plan ?? "basic"}
            currentStatus={sub?.status ?? "trialing"}
          />
        </div>
      </div>
    </div>
  );
}
