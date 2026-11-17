import { Skeleton } from "@/components/ui/skeleton";

/** Income & recurring while it loads: the next due item beside the item list. */
export default function RecurringLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading Income & recurring…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-section lg:grid-cols-12 lg:gap-x-12">
        <div className="flex flex-col gap-3 lg:col-span-7">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-12 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-5">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
