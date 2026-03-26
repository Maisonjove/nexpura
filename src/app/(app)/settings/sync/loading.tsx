import { Skeleton } from '@/components/ui/skeleton';

export default function SyncQueueLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Panel skeleton */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-4 py-3 border-b flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div>
            <Skeleton className="h-5 w-24 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Help skeleton */}
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
