import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic skeleton for a create/edit form page. Renders the same visual
 * structure every form in the app uses (header + card with stacked fields
 * + action row), so clicking into a /new route paints an instant shell.
 */
export function FormSkeleton({
  fieldCount = 6,
  title = true,
  maxWidth = "max-w-2xl",
}: {
  fieldCount?: number;
  title?: boolean;
  maxWidth?: string;
}) {
  return (
    <div className={`${maxWidth} mx-auto space-y-6`}>
      {title && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      )}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
        {Array.from({ length: fieldCount }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className={i % 3 === 2 ? "h-20 w-full rounded-lg" : "h-9 w-full rounded-lg"} />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
