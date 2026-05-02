import { Suspense } from "react";
import { preload } from "react-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardCriticalData } from "./actions";
import DashboardWrapper from "./DashboardWrapper";

export const metadata = { title: "Dashboard — Nexpura" };

// Dynamic rendering is explicit here. Removing the top-level await on
// getDashboardCriticalData (which reads cookies via requireAuth) means
// Next.js would otherwise attempt to prerender this page at build time
// and hit "Not authenticated" inside the Suspense child. force-dynamic
// tells Next.js: skip build-time prerender, render at request time,
// keep the streaming Suspense shell.

// The page below is synchronous at the top level so the shell (Suspense
// fallback) emits in the first streamed HTML chunk on hard-nav, before
// the dynamic body (auth + critical data) resolves.

export default function DashboardPage() {
  // Emit <link rel=preload as=fetch> in the first streamed chunk so the
  // browser issues the stats GET before React hydrates. SWR's later
  // fetch() with the same URL + credentials-include consumes the in-flight
  // response. Saves 200-400ms on cold. Preloads the "all locations" URL
  // (no query string) — matches initialLocationKey="all"; a location
  // filter makes the preload a wasted request, not a broken one.
  preload("/api/dashboard/stats", {
    as: "fetch",
    crossOrigin: "use-credentials",
    fetchPriority: "high",
  });

  return (
    <Suspense fallback={<DashboardStatsFallback />}>
      {/* Server work minimised for first-paint speed: only critical data
          (15 min cache, ~5-20 ms warm / ~50-100 ms cold). The 20-query
          stats batch is fetched client-side by SWR in DashboardWrapper,
          so the shell appears immediately and widgets fill in via their
          own inline loaders via isStatsLoading. This replaces the old
          ~200-600 ms blocking server-side stats fetch + redundant
          location-cookie validation that was making first sign-in feel
          like a "big loading" moment. */}
      <DashboardStatsStream />
    </Suspense>
  );
}

async function DashboardStatsStream() {
  const criticalData = await getDashboardCriticalData();

  return (
    <DashboardWrapper
      criticalData={criticalData}
      initialStats={null}
      initialLocationKey="all"
    />
  );
}

/**
 * Server-rendered skeleton shown while the stats stream resolves. Matches
 * the real Command Centre layout exactly so there's no layout shift when
 * the streamed content replaces the fallback. Shape mirrors loading.tsx.
 */
function DashboardStatsFallback() {
  return (
    <div className="flex gap-7 items-start">
      <div className="flex-1 min-w-0 space-y-7">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-3 w-96 mt-3" />
          </div>
          <div className="text-right flex-shrink-0">
            <Skeleton className="h-5 w-44 ml-auto" />
            <Skeleton className="h-3 w-16 ml-auto mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex-1">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-10" />
              </div>
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl p-5 h-[180px]"
            >
              <Skeleton className="h-3 w-16 mb-4" />
              <Skeleton className="h-6 w-24 mb-2" />
              <Skeleton className="h-3 w-32 mb-4" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
      <aside className="hidden xl:flex flex-col gap-3 w-[320px] flex-shrink-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl overflow-hidden"
          >
            <div className="px-4 pt-4 pb-3 border-b border-nexpura-taupe-100">
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="px-4 py-3 space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-5 w-full" />
              ))}
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
