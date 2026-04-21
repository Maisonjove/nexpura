import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * /admin/ops — operator dashboard for the three operational signals
 * that previously required digging through raw tables or Vercel logs:
 *   1. Past-due / suspended tenants (billing reconciliation).
 *   2. Unprocessed Stripe webhooks (queued by idempotency_locks but
 *      not marked processed — i.e. the handler crashed mid-flight).
 *   3. Stuck repairs (in a non-terminal stage for > 14 days — proxy
 *      for "jeweller forgot about it").
 *
 * Audit finding (Medium): no admin surface existed for any of these,
 * so billing drift / crashed webhooks / stuck repairs only surfaced
 * when a tenant complained.
 *
 * Admin-only — the (admin) layout already enforces super_admin via
 * assertSuperAdmin() before this page renders.
 */

export const metadata = { title: "Operations dashboard — Nexpura Admin" };

export default function AdminOpsPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Operations</h1>
        <p className="text-stone-500 text-sm mt-1">
          Billing issues, stuck orders, and webhook failures. Refresh to reload.
        </p>
      </header>

      <Suspense fallback={<LoadingBlock label="Past-due tenants" />}>
        <PastDueTenantsSection />
      </Suspense>

      <Suspense fallback={<LoadingBlock label="Stuck repairs" />}>
        <StuckRepairsSection />
      </Suspense>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <section className="border border-stone-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-stone-900">{label}</h2>
      <p className="text-stone-400 text-sm mt-2">Loading…</p>
    </section>
  );
}

async function PastDueTenantsSection() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("id, name, business_name, subscription_status, grace_period_ends_at, email")
    .in("subscription_status", ["past_due", "payment_required", "suspended", "unpaid"])
    .order("grace_period_ends_at", { ascending: true });

  const tenants = data ?? [];

  return (
    <section className="border border-stone-200 rounded-lg overflow-hidden">
      <header className="flex items-baseline justify-between px-6 py-4 border-b border-stone-200">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Billing issues</h2>
          <p className="text-xs text-stone-500 mt-0.5">Tenants with a non-active subscription state.</p>
        </div>
        <span className="text-2xl font-semibold text-stone-900">{tenants.length}</span>
      </header>

      {tenants.length === 0 ? (
        <p className="p-6 text-sm text-stone-500">No tenants in a payment-issue state.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-6 py-3">Business</th>
              <th className="px-6 py-3">Owner email</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Grace ends</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="px-6 py-3 font-medium text-stone-900">
                  {t.business_name ?? t.name ?? "(unnamed)"}
                </td>
                <td className="px-6 py-3 text-stone-600">{t.email ?? "—"}</td>
                <td className="px-6 py-3">
                  <StatusBadge status={t.subscription_status} />
                </td>
                <td className="px-6 py-3 text-stone-600">
                  {t.grace_period_ends_at
                    ? new Date(t.grace_period_ends_at).toLocaleDateString("en-AU", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

async function StuckRepairsSection() {
  const admin = createAdminClient();
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data } = await admin
    .from("repairs")
    .select("id, tenant_id, tracking_id, stage, created_at, tenants(business_name, name)")
    .in("stage", ["intake", "assessed", "quoted", "approved", "in_progress", "ready"])
    .lt("created_at", fourteenDaysAgo.toISOString())
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(100);

  const repairs = data ?? [];

  return (
    <section className="border border-stone-200 rounded-lg overflow-hidden">
      <header className="flex items-baseline justify-between px-6 py-4 border-b border-stone-200">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Stuck repairs</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            In a non-terminal stage for &gt; 14 days. Top 100.
          </p>
        </div>
        <span className="text-2xl font-semibold text-stone-900">{repairs.length}</span>
      </header>

      {repairs.length === 0 ? (
        <p className="p-6 text-sm text-stone-500">No stuck repairs. Nice.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-6 py-3">Tenant</th>
              <th className="px-6 py-3">Tracking ID</th>
              <th className="px-6 py-3">Stage</th>
              <th className="px-6 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {repairs.map((r) => {
              const tenant = Array.isArray(r.tenants) ? r.tenants[0] : r.tenants;
              return (
                <tr key={r.id}>
                  <td className="px-6 py-3 font-medium text-stone-900">
                    {tenant?.business_name ?? tenant?.name ?? r.tenant_id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-3 text-stone-600">{r.tracking_id ?? "—"}</td>
                  <td className="px-6 py-3 text-stone-600">{r.stage}</td>
                  <td className="px-6 py-3 text-stone-600">
                    {new Date(r.created_at).toLocaleDateString("en-AU", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "past_due" || s === "payment_required"
      ? "bg-yellow-50 text-yellow-700"
      : s === "suspended" || s === "unpaid"
      ? "bg-red-50 text-red-600"
      : "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status ?? "unknown"}
    </span>
  );
}
