import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import { notFound } from "next/navigation";
import Link from "next/link";
import TenantActions from "./TenantActions";

/**
 * /admin/tenants/[id] — CC-ready page-route (admin-cluster cleanup pass).
 *
 * Sync top-level → Suspense → async body. Body awaits the dynamic `params`
 * promise and then calls the pure `loadTenantDetail(id)` loader. The static
 * "Back to Tenants" link is lifted to the shell so it can prerender.
 *
 * add `'use cache' + cacheLife('minutes') + cacheTag('admin-tenant:' + id)`
 * to `loadTenantDetail`. Invalidate via `revalidateTag` whenever tenant /
 * subscription / staff data mutates on the admin side.
 */


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
      ? "bg-emerald-50 text-emerald-700"
      : s === "trialing"
      ? "bg-amber-50 text-amber-700"
      : s === "past_due"
      ? "bg-yellow-50 text-yellow-700"
      : "bg-red-50 text-red-600";
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
      ? "bg-stone-100 text-stone-700"
      : p === "atelier" || p === "group" || p === "ultimate"
      ? "bg-stone-200 text-stone-800"
      : "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {p || "—"}
    </span>
  );
}

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Shell — back link + section scaffolding are safe to prerender. */}
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
        </svg>
        Back to Tenants
      </Link>
      <Suspense fallback={<TenantDetailSkeleton />}>
        <TenantDetailBody paramsPromise={params} />
      </Suspense>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. Resolves the `params` promise, then loads tenant data.
// ─────────────────────────────────────────────────────────────────────────
async function TenantDetailBody({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = await paramsPromise;
  const data = await loadTenantDetail(id);
  if (!data.tenant) notFound();

  const { tenant, sub, owner, userCount, customerCount, inventoryCount, repairCount, invoiceCount, activityLogs } = data;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{tenant.name}</h1>
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
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900 mb-4">Business</h2>
            <InfoRow label="Name" value={tenant.name} />
            <InfoRow label="Slug" value={tenant.slug} />
            <InfoRow label="Business Type" value={tenant.business_type} />
            <InfoRow label="Created" value={formatDate(tenant.created_at)} />
          </div>

          {/* Owner */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900 mb-4">Owner</h2>
            <InfoRow label="Name" value={owner?.full_name} />
            <InfoRow label="Email" value={owner?.email} />
          </div>

          {/* Subscription */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900 mb-4">Subscription</h2>
            <InfoRow label="Plan" value={<PlanBadge plan={sub?.plan} />} />
            <InfoRow label="Status" value={<StatusBadge status={sub?.status} />} />
            <InfoRow label="Trial Ends" value={formatDate(sub?.trial_ends_at)} />
            <InfoRow label="Current Period End" value={formatDate(sub?.current_period_end)} />
            <InfoRow label="Stripe Customer ID" value={sub?.stripe_customer_id} />
            <InfoRow label="Stripe Subscription ID" value={sub?.stripe_sub_id} />
          </div>

          {/* Usage */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900 mb-4">Usage</h2>
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
            <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Recent Activity</h2>
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
            tenantId={tenant.id}
            currentPlan={sub?.plan ?? "boutique"}
            currentStatus={sub?.status ?? "trialing"}
            isFreeForever={!!tenant.is_free_forever}
            gracePeriodEndsAt={sub?.grace_period_ends_at ?? tenant.grace_period_ends_at ?? null}
            adminNotes={tenant.admin_notes as string | null}
            ownerEmail={owner?.email ?? null}
          />
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable data loader. Parameterised by tenant id — safe for per-tenant
// cacheTag under CC.
// ─────────────────────────────────────────────────────────────────────────
interface ActivityLog {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

async function loadTenantDetail(id: string) {
  const adminClient = createAdminClient();

  const { data: tenant } = await adminClient
    .from("tenants")
    .select("id, name, slug, business_type, created_at, is_free_forever, subscription_status, grace_period_ends_at, admin_notes, deleted_at")
    .eq("id", id)
    .single();

  if (!tenant) {
    return {
      tenant: null,
      sub: null,
      owner: null,
      userCount: 0,
      customerCount: 0,
      inventoryCount: 0,
      repairCount: 0,
      invoiceCount: 0,
      activityLogs: [] as ActivityLog[],
    };
  }

  const [
    { data: sub },
    { data: owner },
    { count: userCount },
    { count: customerCount },
    { count: inventoryCount },
    { count: repairCount },
    { count: invoiceCount },
    { data: activityLogs },
  ] = await Promise.all([
    adminClient.from("subscriptions").select("*").eq("tenant_id", id).single(),
    adminClient
      .from("users")
      .select("full_name, email")
      .eq("tenant_id", id)
      .eq("role", "owner")
      .single(),
    adminClient.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    adminClient.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    adminClient.from("inventory_items").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    adminClient.from("repairs").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    adminClient.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    adminClient
      .from("staff_activity_logs")
      .select("id, action, entity_type, entity_id, created_at, users(full_name)")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    tenant,
    sub,
    owner,
    userCount,
    customerCount,
    inventoryCount,
    repairCount,
    invoiceCount,
    activityLogs: (activityLogs ?? []) as ActivityLog[],
  };
}

function TenantDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
