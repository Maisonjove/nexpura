import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardCriticalData, getDashboardStats } from "./actions";
import DashboardWrapper from "./DashboardWrapper";
import logger from "@/lib/logger";

// Dynamic rendering is explicit here. Removing the top-level await on
// getDashboardCriticalData (which reads cookies via requireAuth) means
// Next.js would otherwise attempt to prerender this page at build time
// and hit "Not authenticated" inside the Suspense child. force-dynamic
// tells Next.js: skip build-time prerender, render at request time,
// keep the streaming Suspense shell.
export const dynamic = "force-dynamic";

// The page below is synchronous at the top level so the shell (Suspense
// fallback) emits in the first streamed HTML chunk on hard-nav, before
// the dynamic body (auth + critical data + stats) resolves. Shaped for
// future migration to Next 16's cacheComponents / unstable_instant model.

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardStatsFallback />}>
      {/* All dynamic work lives here: requireAuth (cookies), critical data
          (15 min cache, ~5-20 ms warm / ~50-100 ms cold), and the 20-query
          stats batch (~100-500 ms cold / ~30-80 ms warm). The outer page
          renders zero async work so PPR can prerender the shell. */}
      <DashboardStatsStream />
    </Suspense>
  );
}

async function DashboardStatsStream() {
  const criticalData = await getDashboardCriticalData();
  const initialStats = await getDashboardStats(null).catch((err) => {
    logger.error("[DashboardPage] initial stats fetch failed, falling back to client-side fetch:", err);
    return null;
  });

  return <DashboardWrapper criticalData={criticalData} initialStats={initialStats} />;
}

/**
 * Server-rendered skeleton shown while the stats stream resolves. Matches
 * the real dashboard layout exactly so there's no layout shift when the
 * streamed content replaces the fallback. Shape mirrors loading.tsx.
 */
function DashboardStatsFallback() {
  return (
    <div className="flex gap-8 items-start">
      <div className="flex-1 min-w-0 space-y-10">
        <div className="flex items-start justify-between">
          <div className="flex-1 text-center">
            <Skeleton className="h-10 w-64 mx-auto" />
            <Skeleton className="h-3 w-32 mx-auto mt-2" />
          </div>
          <div className="text-right flex-shrink-0 pt-1">
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-4 w-16 ml-auto mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-5 bg-white border border-stone-200 rounded-2xl px-6 py-5">
              <Skeleton className="h-7 w-7 flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-20 mb-1.5" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <aside className="hidden lg:flex flex-col gap-4 w-[280px] flex-shrink-0 pt-16">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-2xl p-6">
            <Skeleton className="h-5 w-28 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
