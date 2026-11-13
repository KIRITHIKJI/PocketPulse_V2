import { formatDayLabel } from "@/lib/format";
import type { ProgressView } from "@/lib/rewards/view";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The last seven days, logged or not: the North Star as a plain count. Days without an entry
 * are simply empty, never red, and nothing here says "lost" or "broken".
 */
export function WeekStrip({ week, today }: Pick<ProgressView, "week" | "today">) {
  const count = week.filter((d) => d.logged).length;
  return (
    <div className="flex flex-col gap-3" data-testid="week-strip">
      <p className="type-body">
        Logged <span className="font-semibold money">{count}</span> of the last 7 days
      </p>
      <ol className="grid max-w-md grid-cols-7">
        {week.map((d) => {
          const label = formatDayLabel(d.date, today);
          return (
            <li key={d.date} className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 rotate-45",
                  d.logged ? "bg-(--emblem-mid)" : "border border-(--emblem-mid) opacity-50",
                )}
              />
              <span className="sr-only">
                {label}: {d.logged ? "logged" : "nothing logged"}
              </span>
              <span
                aria-hidden="true"
                className={cn("type-caption", d.logged ? "text-foreground" : "text-text-secondary")}
              >
                {d.date === today ? "Today" : WEEKDAYS[new Date(`${d.date}T00:00:00Z`).getUTCDay()]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
