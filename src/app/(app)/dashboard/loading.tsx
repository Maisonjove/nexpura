import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard loading skeleton — mirrors the Command Centre layout exactly so
 * there's no layout shift when streamed content replaces the fallback.
 *
 * Shape: header (with right-side date+clock), 5-up KPI strip, 8-up module
 * grid, 320px sidebar with three sections.
 */
export default function DashboardLoading() {
  return (
    <div className="flex gap-7 items-start animate-in fade-in duration-200">
      {/* ── Main column ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-3 w-96 mt-3" />
          </div>
          <div className="text-right">
            <Skeleton className="h-5 w-44 ml-auto" />
            <Skeleton className="h-3 w-16 ml-auto mt-2" />
          </div>
        </div>

        {/* KPI strip */}
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

        {/* Module grid */}
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

      {/* ── Right sidebar ─────────────────────────────────────────────── */}
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
