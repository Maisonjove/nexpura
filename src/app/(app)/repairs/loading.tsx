import { Skeleton } from '@/components/ui/skeleton';

export default function RepairsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Pipeline view skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['Intake', 'In Progress', 'Ready', 'Collected'].map((stage) => (
          <div key={stage} className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border border-stone-200 rounded-xl p-3 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
