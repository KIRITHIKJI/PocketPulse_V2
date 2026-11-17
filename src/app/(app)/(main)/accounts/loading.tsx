import { Skeleton } from "@/components/ui/skeleton";

/** Accounts' shape while it loads: header, the total, then the account rows. */
export default function AccountsLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading Accounts…</span>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-24 w-72 max-w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
