import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import logger from "@/lib/logger";

/**
 * /admin/subscriptions — CC-ready page-route (admin cluster, fourth of four).
 *
 * Same shape as the rest: sync top-level shell → Suspense → async body
 * → pure loader. No cookies/headers; admin auth is the (admin) layout's
 * job.
 *
 * TODO(cacheComponents-flag): delete the `force-dynamic` export below
 * and add `'use cache' + cacheLife('minutes') + cacheTag('admin-subs')`
 * to `loadSubscriptionsData()`. Revalidate via `revalidateTag` on
 * Stripe webhook writes.
 */

// TODO(cacheComponents-flag): DELETE when the flag is flipped.
export const dynamic = "force-dynamic";

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

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SubscriptionsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Shell — static JSX. Prerenderable under CC. The "{n}
          subscriptions" count lives inside the dynamic body so it
          reflects live data. */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Subscriptions</h1>
      </div>
      <Suspense fallback={<SubscriptionsBodySkeleton />}>
        <SubscriptionsBody />
      </Suspense>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. DB reads only; no request-scoped access.
// ─────────────────────────────────────────────────────────────────────────
async function SubscriptionsBody() {
  const subs = await loadSubscriptionsData();

  return (
    <>
      <p className="text-sm text-stone-500 -mt-4">{subs?.length ?? 0} subscriptions</p>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Tenant</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Trial Ends</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Period End</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Stripe Customer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {(subs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-400">No subscriptions yet</td>
                </tr>
              ) : (
                (subs ?? []).map((sub) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const tenant = (sub as any).tenants;
                  return (
                    <tr key={sub.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-stone-900">
                        {tenant ? (
                          <Link href={`/admin/tenants/${tenant.id}`} className="hover:text-stone-600">
                            {tenant.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4"><PlanBadge plan={sub.plan} /></td>
                      <td className="px-6 py-4"><StatusBadge status={sub.status} /></td>
                      <td className="px-6 py-4 text-stone-500">{formatDate(sub.trial_ends_at)}</td>
                      <td className="px-6 py-4 text-stone-500">{formatDate(sub.current_period_end)}</td>
                      <td className="px-6 py-4 text-stone-500 font-mono text-xs">{sub.stripe_customer_id ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable data loader. No inputs; admin-wide view.
// ─────────────────────────────────────────────────────────────────────────
interface SubscriptionRow {
  id: string;
  plan: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  tenants: { id: string; name: string } | null;
}

async function loadSubscriptionsData(): Promise<SubscriptionRow[]> {
  try {
    const adminClient = createAdminClient();

    const { data } = await adminClient
      .from("subscriptions")
      .select("*, tenants(id, name)")
      .order("created_at", { ascending: false });

    return (data as SubscriptionRow[] | null) ?? [];
  } catch (error) {
    logger.error("[admin/subscriptions] loadSubscriptionsData failed", error);
    return [];
  }
}

function SubscriptionsBodySkeleton() {
  return (
    <>
      <Skeleton className="h-3 w-32 -mt-4" />
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full border-t border-stone-100" />
        ))}
      </div>
    </>
  );
}
