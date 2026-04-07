import { Skeleton } from "@/components/ui/skeleton";

// Dashboard-specific skeleton that matches the real layout exactly
export default function DashboardLoading() {
  return (
    <div className="flex gap-8 items-start animate-in fade-in duration-200">
      {/* ── Main Column ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-10">
        {/* Business name + date/time header */}
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

        {/* Menu grid - matches compact view categories */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-5 bg-white border border-stone-200 rounded-2xl px-6 py-5"
            >
              {/* Icon placeholder */}
              <Skeleton className="h-7 w-7 flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-20 mb-1.5" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col gap-4 w-[280px] flex-shrink-0 pt-16">
        {/* Tasks for Today */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="py-2">
                <Skeleton className="h-4 w-12 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <Skeleton className="h-5 w-24 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Repairs */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>

        {/* Ready for Pickup */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="py-2">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
