import { Skeleton } from '@/components/ui/skeleton';

export default function POSLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Product grid skeleton */}
      <div className="flex-1 flex flex-col bg-stone-50 min-w-0">
        <div className="p-4 bg-white border-b border-stone-200 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="flex-1 h-12 rounded-xl" />
            <Skeleton className="w-12 h-12 rounded-xl" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white border border-stone-200 rounded-xl p-3 space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Cart skeleton */}
      <div className="w-80 bg-white border-l border-stone-200 flex flex-col">
        <div className="p-4 border-b border-stone-100">
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="flex-1 p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-stone-100 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
