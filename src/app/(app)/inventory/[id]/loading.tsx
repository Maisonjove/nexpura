import { Skeleton, SkeletonStats } from "@/components/ui/skeleton";

export default function InventoryDetailLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="aspect-square bg-white rounded-xl border border-stone-200">
          <Skeleton className="w-full h-full rounded-xl" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <SkeletonStats count={3} />
          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
      </div>
    </div>
  );
}
