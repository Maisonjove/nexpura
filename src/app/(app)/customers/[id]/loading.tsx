import { Skeleton, SkeletonStats } from "@/components/ui/skeleton";

export default function CustomerDetailLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Contact card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-40" /></div>
          <div className="space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-36" /></div>
          <div className="space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-32" /></div>
        </div>
      </div>

      <SkeletonStats count={4} />

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    </div>
  );
}
