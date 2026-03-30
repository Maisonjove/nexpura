import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-stone-200/70", className)}
      {...props}
    />
  )
}

// Pre-built skeleton patterns for common UI elements
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-stone-200 p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-6 gap-4 p-4 border-b border-stone-100 bg-stone-50">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-6 gap-4 p-4 border-b border-stone-50">
          {Array.from({ length: 6 }).map((_, colIdx) => (
            <Skeleton 
              key={colIdx} 
              className={cn("h-4", colIdx === 0 ? "w-full" : "w-3/4")} 
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={cn("grid gap-4", {
      "grid-cols-2": count === 2,
      "grid-cols-3": count === 3,
      "grid-cols-2 md:grid-cols-4": count === 4,
      "grid-cols-2 md:grid-cols-5": count === 5,
      "grid-cols-2 md:grid-cols-3 lg:grid-cols-6": count === 6,
    })}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SkeletonPageHeader() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}

// Full page skeletons for common layouts
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SkeletonPageHeader />
      <SkeletonStats count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function InventorySkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SkeletonPageHeader />
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      <SkeletonTable rows={8} />
    </div>
  );
}

function POSSkeleton() {
  return (
    <div className="h-[calc(100vh-120px)] flex gap-6 animate-in fade-in duration-300">
      {/* Product grid */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-stone-200 p-4">
              <Skeleton className="h-32 w-full rounded-lg mb-3" />
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))}
        </div>
      </div>
      {/* Cart */}
      <div className="w-80 bg-white rounded-xl border border-stone-200 p-4 space-y-4 hidden lg:block">
        <Skeleton className="h-6 w-24" />
        <div className="space-y-3 flex-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <div className="pt-4 border-t border-stone-100 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

function CustomersSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SkeletonPageHeader />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 flex-1 max-w-md rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <SkeletonTable rows={10} />
    </div>
  );
}

function RepairsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SkeletonPageHeader />
      {/* Stage tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-lg flex-shrink-0" />
        ))}
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}

export { 
  Skeleton, 
  SkeletonCard, 
  SkeletonTable, 
  SkeletonStats, 
  SkeletonPageHeader,
  DashboardSkeleton,
  InventorySkeleton,
  POSSkeleton,
  CustomersSkeleton,
  RepairsSkeleton,
}
