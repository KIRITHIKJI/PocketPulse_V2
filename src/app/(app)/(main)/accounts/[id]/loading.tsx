import { Skeleton } from "@/components/ui/skeleton";

/** An account's shape while it loads: header, balance, then the check and history. */
export default function AccountLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading account…</span>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}
