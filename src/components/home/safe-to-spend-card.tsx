import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { loadPlan } from "@/lib/data/plan";
import { formatLocalDate } from "@/lib/format";

const LINK =
  "group flex min-w-0 flex-col gap-1 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:items-end sm:text-right";

/**
 * Safe to Spend beside the balance on Home: the suggested daily amount from the existing domain
 * result, labelled an estimate and drawn in the estimate colour, linking to the page that shows
 * its inputs. It streams in after the money figures, so Home's own figures never wait for the
 * plan's reads. Without an income date it says so and shows no number; if its reads fail, it
 * stays a plain link.
 */
export async function SafeToSpendCard() {
  let plan;
  try {
    plan = await loadPlan();
  } catch {
    return (
      <Link href="/safe-to-spend" className={LINK} data-testid="safe-to-spend-link">
        <span className="type-label text-text-secondary">Safe to Spend · estimate</span>
        <span className="type-body text-text-secondary group-hover:text-foreground">
          Couldn’t load it here. Open Safe to Spend
        </span>
      </Link>
    );
  }
  const { result, money } = plan;
  const daily = result.status === "ok" ? result.suggestedDailyPaise : null;
  const until = result.inputs.horizonEndDate ?? result.inputs.nextIncomeDate;

  return (
    <Link href="/safe-to-spend" className={LINK} data-testid="safe-to-spend-card">
      <span className="type-label text-text-secondary">Safe to Spend · estimate</span>
      {daily !== null && until ? (
        <>
          <span className="type-display">
            <span
              className="text-money-estimate money"
              data-testid="home-safe-daily"
              data-paise={daily}
            >
              {money(daily)}
            </span>
            <span className="type-body text-text-secondary"> a day</span>
          </span>
          <span className="flex items-center gap-1 type-body text-text-secondary group-hover:text-foreground">
            until {formatLocalDate(until)}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </>
      ) : (
        <span className="max-w-64 type-body text-text-secondary group-hover:text-foreground">
          No daily amount without your next income date.{" "}
          <span className="whitespace-nowrap">
            Add it
            <ArrowRight className="ml-1 inline size-3.5 align-[-0.125em]" aria-hidden="true" />
          </span>
        </span>
      )}
    </Link>
  );
}

export function SafeToSpendCardSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-1.5 sm:items-end">
      <span className="sr-only">Loading the Safe to Spend estimate…</span>
      <Skeleton className="h-3 w-36" />
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}
