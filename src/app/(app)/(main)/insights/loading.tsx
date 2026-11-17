import { Skeleton } from "@/components/ui/skeleton";

/** Insights' shape while it loads: header and periods, total and trend beside categories. */
export default function InsightsLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading Insights…</span>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-12 w-full max-w-xl rounded-xl" />
      </div>
      <Skeleton className="h-12 w-full max-w-md rounded-xl" />
      <div className="grid gap-section lg:grid-cols-12 lg:gap-x-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-full max-w-sm" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-7">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
