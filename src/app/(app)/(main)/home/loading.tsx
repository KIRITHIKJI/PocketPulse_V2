import { Skeleton } from "@/components/ui/skeleton";

/** Home's shape while it loads: the balance beside Safe to Spend, the tiles, then the side column. */
export default function HomeLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading Home…</span>
      <Skeleton className="h-7 w-32" />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-12 w-44" />
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-x-12">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:col-span-8 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-22 rounded-xl" />
          ))}
        </div>
        <div className="flex flex-col gap-4 lg:col-span-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
