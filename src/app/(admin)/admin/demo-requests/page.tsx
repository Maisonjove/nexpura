import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import logger from "@/lib/logger";
import DemoRequestsClient, { type DemoRequestSummary } from "./DemoRequestsClient";

export const metadata = { title: "Demo requests — Nexpura admin" };

/**
 * /admin/demo-requests — list of all demo prospects captured via
 * /contact (topic='demo' or intent='demo'/'sales'). Auth handled by
 * the (admin) layout. Filters + search live client-side: ~hundreds of
 * rows max, no server pagination needed yet.
 */

export default function DemoRequestsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Demo Requests</h1>
        <p className="text-sm text-stone-500 mt-1">
          Prospects who asked for a guided demo. Schedule, mark complete, or decline.
        </p>
      </div>
      <Suspense fallback={<DemoRequestsSkeleton />}>
        <DemoRequestsBody />
      </Suspense>
    </div>
  );
}

async function DemoRequestsBody() {
  // Same cacheComponents-stale-state concern as the [id] detail page:
  // without `connection()` the async body gets implicitly cached and
  // doesn't refresh after a server action mutates demo_requests.
  await connection();

  const rows = await loadDemoRequests();

  const counts = {
    new: rows.filter((r) => r.status === "new").length,
    scheduled: rows.filter((r) => r.status === "scheduled").length,
    completed: rows.filter((r) => r.status === "completed").length,
    declined: rows.filter((r) => r.status === "declined").length,
  };

  return (
    <>
      {/* KPI tiles double as deep-link filters — clicking "New" jumps to
          ?status=new which the client component reads on mount. Joey
          2026-05-04: prior build had these as static <div>s. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="New" value={counts.new} accent="amber" status="new" />
        <StatTile label="Scheduled" value={counts.scheduled} accent="emerald" status="scheduled" />
        <StatTile label="Completed" value={counts.completed} accent="stone" status="completed" />
        <StatTile label="Declined" value={counts.declined} accent="stone" status="declined" />
      </div>
      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <p className="text-sm text-stone-500">
            No demo requests yet. They&apos;ll appear here when prospects submit /contact?intent=demo.
          </p>
          <Link href="/contact?intent=demo" className="mt-3 inline-block text-xs text-stone-500 hover:text-stone-900 underline">
            View the demo intake form →
          </Link>
        </div>
      ) : (
        <DemoRequestsClient rows={rows} />
      )}
    </>
  );
}

function StatTile({
  label,
  value,
  accent,
  status,
}: {
  label: string;
  value: number;
  accent: "amber" | "emerald" | "stone";
  status: "new" | "scheduled" | "completed" | "declined";
}) {
  const cls =
    accent === "amber"
      ? "text-amber-700"
      : accent === "emerald"
      ? "text-emerald-600"
      : "text-stone-900";
  return (
    <Link
      href={`/admin/demo-requests?status=${status}`}
      className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm hover:bg-stone-50 transition-colors block"
    >
      <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${cls}`}>{value}</p>
    </Link>
  );
}

async function loadDemoRequests(): Promise<DemoRequestSummary[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("demo_requests")
      .select(
        "id, first_name, last_name, email, business_name, plan, status, country, num_stores, created_at, scheduled_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    return (data ?? []) as DemoRequestSummary[];
  } catch (error) {
    logger.error("[admin/demo-requests] load failed", error);
    return [];
  }
}

function DemoRequestsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full border-t border-stone-100" />
        ))}
      </div>
    </>
  );
}
