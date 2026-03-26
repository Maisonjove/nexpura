import { Skeleton } from '@/components/ui/skeleton';

export default function CustomersLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Search */}
      <Skeleton className="h-10 w-full rounded-xl" />

      {/* List */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-stone-100 last:border-b-0">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="space-y-1 text-right">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
