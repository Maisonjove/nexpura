import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function InvoicesLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SkeletonPageHeader />
      <SkeletonTable rows={8} />
    </div>
  );
}
