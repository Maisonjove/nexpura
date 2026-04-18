import { Skeleton, SkeletonStats } from "@/components/ui/skeleton";

export default function InvoiceDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      <SkeletonStats count={4} />

      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-4">
              <Skeleton className="h-4 col-span-3" />
              <Skeleton className="h-4 col-span-1" />
              <Skeleton className="h-4 col-span-1" />
              <Skeleton className="h-4 col-span-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
