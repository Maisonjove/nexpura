import { Suspense } from "react";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import logger from "@/lib/logger";
import { CreditCardIcon } from "@heroicons/react/24/outline";

/**
 * /admin/subscriptions — CC-ready page-route (admin cluster, fourth of four).
 *
 * Same shape as the rest: sync top-level shell → Suspense → async body
 * → pure loader. No cookies/headers; admin auth is the (admin) layout's
 * job.
 *
 * and add `'use cache' + cacheLife('minutes') + cacheTag('admin-subs')`
 * to `loadSubscriptionsData()`. Revalidate via `revalidateTag` on
 * Stripe webhook writes.
 */


function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "active"
      ? "nx-badge-success"
      : s === "trialing"
      ? "nx-badge-warning"
      : s === "past_due"
      ? "nx-badge-warning"
      : s === "canceled" || s === "cancelled"
      ? "nx-badge-danger"
      : "nx-badge-neutral";
  return (
    <span className={`${cls} capitalize`}>
      {s.replace("_", " ") || "—"}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  const p = (plan ?? "").toLowerCase();
  return (
    <span className="nx-badge-neutral capitalize">
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

// Estimated MRR per plan (AUD baseline) — kept here for the stat strip.
// Matches the same pattern used in admin/revenue. Falls back to 0 when
// plan key isn't in the lookup.
const PLAN_MRR_AUD: Record<string, number> = {
  boutique: 79,
  basic: 79,
  studio: 179,
  pro: 179,
  atelier: 379,
  ultimate: 379,
  group: 379,
};

function fmtAUD(n: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function SubscriptionsPage() {
  return (
    <div className="bg-nexpura-ivory min-h-screen -m-6">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header — pure static. The "{n} subscriptions" count
            and stat strip live inside the dynamic body. */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Admin
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Subscriptions
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              All paying, trialing, and cancelled tenants across the platform.
            </p>
          </div>
        </div>

        <Suspense fallback={<SubscriptionsBodySkeleton />}>
          <SubscriptionsBody />
        </Suspense>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. DB reads only; no request-scoped access.
// ─────────────────────────────────────────────────────────────────────────
async function SubscriptionsBody() {
  // cacheComponents — see PR #130.
  await connection();
  const subs = await loadSubscriptionsData();

  const all = subs ?? [];
  const activeSubs = all.filter((s) => (s.status ?? "").toLowerCase() === "active");
  const trialingSubs = all.filter((s) => (s.status ?? "").toLowerCase() === "trialing");
  const cancelledSubs = all.filter((s) => {
    const st = (s.status ?? "").toLowerCase();
    return st === "canceled" || st === "cancelled";
  });

  const mrrAud = activeSubs.reduce((sum, sub) => {
    const key = (sub.plan ?? "").toLowerCase();
    return sum + (PLAN_MRR_AUD[key] ?? 0);
  }, 0);

  return (
    <>
      {/* Stat strip — hairline divider, serif numbers */}
      <div className="bg-white border border-stone-200 rounded-2xl mb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          <div className="p-6 lg:p-8">
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              MRR (≈ AUD)
            </p>
            <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
              {fmtAUD(mrrAud)}
            </p>
          </div>
          <div className="p-6 lg:p-8">
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Active
            </p>
            <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
              {activeSubs.length}
            </p>
          </div>
          <div className="p-6 lg:p-8">
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Trialing
            </p>
            <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
              {trialingSubs.length}
            </p>
          </div>
          <div className="p-6 lg:p-8">
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Cancelled
            </p>
            <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
              {cancelledSubs.length}
            </p>
          </div>
        </div>
      </div>

      {/* Section heading + count */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-luxury">
          All subscriptions
        </h2>
        <span className="text-xs text-stone-400 tabular-nums">
          {all.length} total
        </span>
      </div>

      {all.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
          <CreditCardIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
          <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
            No subscriptions yet
          </h3>
          <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed">
            New subscriptions will appear here once tenants begin paid plans or trials.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {all.map((sub) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tenant = (sub as any).tenants;
            const planKey = (sub.plan ?? "").toLowerCase();
            const monthly = PLAN_MRR_AUD[planKey] ?? 0;

            return (
              <div
                key={sub.id}
                className="group bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2.5">
                      <PlanBadge plan={sub.plan} />
                      <StatusBadge status={sub.status} />
                    </div>
                    {tenant ? (
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="font-serif text-xl text-stone-900 leading-tight tracking-tight hover:text-nexpura-bronze transition-colors duration-300"
                      >
                        {tenant.name}
                      </Link>
                    ) : (
                      <span className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                        Unknown tenant
                      </span>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3 mt-5 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-luxury text-stone-400 mb-1">
                          Trial ends
                        </p>
                        <p className="text-stone-700 tabular-nums">
                          {formatDate(sub.trial_ends_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-luxury text-stone-400 mb-1">
                          Period end
                        </p>
                        <p className="text-stone-700 tabular-nums">
                          {formatDate(sub.current_period_end)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-luxury text-stone-400 mb-1">
                          Stripe customer
                        </p>
                        <p className="text-stone-500 font-mono text-xs truncate">
                          {sub.stripe_customer_id ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs uppercase tracking-luxury text-stone-400 mb-1">
                      MRR
                    </p>
                    <p className="font-serif text-2xl text-stone-900 tabular-nums tracking-tight">
                      {monthly > 0 ? fmtAUD(monthly) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
      <div className="bg-white border border-stone-200 rounded-2xl mb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-6 lg:p-8">
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-stone-200 rounded-2xl p-6"
          >
            <Skeleton className="h-4 w-40 mb-3" />
            <Skeleton className="h-6 w-64 mb-5" />
            <div className="grid grid-cols-3 gap-6">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
