import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { CategoryBadge } from "@/components/categories/category-icon";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyHero, InfoTip, Section } from "@/components/layout/primitives";
import { GoalFormDialog } from "@/components/plan/goal-form";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  type ContributionCadence,
  type SavingsGoal,
  formatBasisPoints,
  goalProgress,
  totalEarmarked,
} from "@/domain";
import { loadPlan } from "@/lib/data/plan";
import { getGoals } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Savings goals" };

const STATUS_BADGE = {
  active: null,
  paused: { label: "Paused", variant: "outline" },
  completed: { label: "Complete", variant: "positive" },
  archived: { label: "Archived", variant: "outline" },
} as const;

const ROW =
  "-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-(--duration-quick) outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Savings goals (doc/DESIGN_PLAN.md, V2 Phase 3E): the active goal's progress leads, with the
 * suggested amount toward the date the user set; the total set aside is one line; every other goal
 * is a row.
 */
export default async function GoalsPage() {
  const [plan, goals] = await Promise.all([loadPlan(), getGoals()]);
  const { profile, ledger, today, money, result } = plan;
  const cadence: ContributionCadence = ["weekly", "biweekly"].includes(profile.incomeFrequency)
    ? "weekly"
    : "monthly";
  const setAside = totalEarmarked(ledger);
  const progressOf = (goal: SavingsGoal) => goalProgress(goal, ledger, today, cadence, money);

  /** The goal being saved toward, as the screen's hero. The whole block opens the goal. */
  const lead = (goal: SavingsGoal) => {
    const progress = progressOf(goal);
    return (
      <section aria-label="Saving for" className="flex max-w-3xl flex-col gap-1">
        <p className="type-label text-text-secondary">Saving for</p>
        <Link
          href={`/goals/${goal.id}`}
          data-testid="goal-card"
          className="-mx-3 flex flex-col gap-3 rounded-xl px-3 py-2 transition-colors duration-(--duration-quick) outline-none hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="flex items-center gap-3">
            <CategoryBadge icon={goal.icon ?? "piggy-bank"} color={null} size="sm" />
            <span className="min-w-0 truncate type-title">{goal.title}</span>
            <ChevronRight
              className="ml-auto size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
          <span className="type-body text-text-secondary">
            <span className="type-hero text-money-earmark money">{money(progress.savedPaise)}</span>{" "}
            of <span className="money">{money(goal.targetPaise)}</span> set aside ·{" "}
            <span className="money">{formatBasisPoints(progress.progressBp, 0)}</span>
          </span>
          <Progress
            bp={progress.progressBp}
            aria-label={`${goal.title}: saved of target`}
            valueText={formatBasisPoints(progress.progressBp, 0)}
          />
          <span className="type-body text-pretty text-text-secondary">{progress.explanation}</span>
        </Link>
      </section>
    );
  };

  /** Any other goal: one row, its progress as a thin bar when it's being saved toward. */
  const row = (goal: SavingsGoal) => {
    const progress = progressOf(goal);
    const badge = STATUS_BADGE[goal.status];
    const bp = goal.status === "completed" ? 10_000 : progress.progressBp;
    return (
      <li key={goal.id}>
        <Link href={`/goals/${goal.id}`} data-testid="goal-card" className={ROW}>
          <CategoryBadge icon={goal.icon ?? "piggy-bank"} color={null} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate type-body font-medium">{goal.title}</span>
              {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
            </span>
            {goal.status === "active" ? (
              <Progress
                bp={bp}
                aria-label={`${goal.title}: saved of target`}
                valueText={formatBasisPoints(bp, 0)}
              />
            ) : null}
            <span className="type-caption text-text-secondary">
              <span className="money">{money(goal.targetPaise)}</span> target
              {goal.status === "active" ? (
                <>
                  {" "}
                  · <span className="money">{formatBasisPoints(bp, 0)}</span>
                </>
              ) : null}
            </span>
          </span>
          <span className="shrink-0 type-body text-money-earmark money">
            {money(progress.savedPaise)}
            <span className="sr-only"> set aside</span>
          </span>
        </Link>
      </li>
    );
  };

  const rows = (title: string, list: SavingsGoal[]) =>
    list.length > 0 && (
      <Section
        title={title}
        meta={`${list.length} ${list.length === 1 ? "goal" : "goals"}`}
        className="min-w-0"
      >
        <ul className="flex flex-col divide-y divide-(--section-divider)">{list.map(row)}</ul>
      </Section>
    );

  const active = goals.filter((g) => g.status === "active");
  const paused = goals.filter((g) => g.status === "paused");
  const completed = goals.filter((g) => g.status === "completed");
  const archived = goals.filter((g) => g.status === "archived");
  const resting = paused.length + completed.length;
  const [first, ...otherActive] = active;

  return (
    <>
      <PageHeader
        title="Savings goals"
        description="Pockets inside your tracked money: setting money aside isn’t spending."
        actions={goals.length > 0 ? <GoalFormDialog today={today} /> : undefined}
        tabs="plan"
      />

      {goals.length === 0 ? (
        <EmptyHero
          label="Saving for"
          title="Save toward something specific"
          description="Money you set aside stays in your balance. It comes off Safe to Spend, and it never counts as spending."
          actions={<GoalFormDialog today={today} />}
        />
      ) : (
        <>
          {first ? (
            lead(first)
          ) : (
            <EmptyHero
              label="Saving for"
              title="No active goals"
              description="Add a goal, or resume one below, to keep setting money aside."
              actions={<GoalFormDialog today={today} />}
            />
          )}

          <div className="relative flex flex-wrap items-center gap-x-1">
            <p className="type-body text-text-secondary">
              Set aside across all goals:{" "}
              <span className="font-medium text-money-earmark money" data-testid="total-saved">
                {money(setAside)}
              </span>
              , still in your tracked balance of{" "}
              <span className="money">{money(result.inputs.balancePaise)}</span>.
            </p>
            <InfoTip label="About money set aside">
              <p>
                Money set aside is still yours and still part of your tracked balance. It’s only
                earmarked, so it comes off Safe to Spend.
              </p>
              <p>
                Money in paused, complete or archived goals stays set aside until you release it.
              </p>
            </InfoTip>
          </div>

          {rows("Other active goals", otherActive)}
          {resting > 0 && (
            <div className="grid gap-section lg:grid-cols-2 lg:gap-x-12">
              {rows("Paused", paused)}
              {rows("Complete", completed)}
            </div>
          )}
          {rows("Archived", archived)}
        </>
      )}
    </>
  );
}
