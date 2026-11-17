import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { InfoTip, Section, Stat, StatRow } from "@/components/layout/primitives";
import { IncomeDatePrompt } from "@/components/plan/income-date-prompt";
import { PlanningForm } from "@/components/plan/planning-form";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { type SurvivalStatus, survivalPlan } from "@/domain";
import { loadPlan } from "@/lib/data/plan";
import { formatLocalDate } from "@/lib/format";

export const metadata: Metadata = { title: "Survival mode" };

/** The status as a label over the headline. The headline and detail say which days they mean. */
const STATUS_LOOK: Record<SurvivalStatus, { label: string; tone: string }> = {
  needs_date: { label: "Needs a date", tone: "text-text-secondary" },
  too_early: { label: "Just getting started", tone: "text-text-secondary" },
  on_track: { label: "On track", tone: "text-feedback-success" },
  watch: { label: "Keep an eye on it", tone: "text-feedback-info" },
  at_risk: { label: "At risk", tone: "text-feedback-warning" },
};

/** Things that actually change the plan, each opening the screen where it's done. */
const TIPS = [
  {
    href: "/goals",
    title: "Pause a goal or release some savings",
    detail: "Money set aside comes off your daily amount; releasing it frees it up.",
  },
  {
    href: "/recurring",
    title: "Skip or move a bill",
    detail: "Unpaid bills before your next income are subtracted from the plan.",
  },
  {
    href: "/budgets",
    title: "Check your budgets",
    detail: "See which categories are running ahead of pace this month.",
  },
] as const;

/**
 * Survival Mode (doc/DESIGN_PLAN.md, V2 Phase 3E): the current status leads, about the past 14
 * days, never a projection. The allowance figures follow in one row, then ways to make room.
 */
export default async function SurvivalPage() {
  const { profile, ledger, now, settings, today, money, result } = await loadPlan();
  const plan = survivalPlan({
    result,
    frequency: profile.incomeFrequency,
    expectedIncomePaise: profile.expectedIncomePaise,
    ledger,
    now,
    settings,
    money,
  });
  const look = STATUS_LOOK[plan.status];
  const { cycle } = plan;

  return (
    <>
      <PageHeader
        title="Survival mode"
        description="A calm look at making your money last until your next allowance."
        tabs="plan"
      />

      {plan.status === "needs_date" ? (
        <IncomeDatePrompt
          label="Survival mode · status"
          nextIncomeDate={profile.nextIncomeDate}
          frequency={profile.incomeFrequency}
          today={today}
          form={
            <PlanningForm
              nextIncomeDate={profile.nextIncomeDate}
              reservePaise={profile.safeToSpendReservePaise}
              today={today}
              dateOnly
            />
          }
        />
      ) : (
        <>
          <section
            aria-label="Status"
            className="flex max-w-3xl flex-col gap-5"
            data-testid="survival-status"
          >
            <div className="flex flex-col gap-2">
              <div className="relative flex items-center gap-1">
                <p className={`type-label ${look.tone}`}>{look.label}</p>
                <InfoTip label="About Survival mode">
                  <p>
                    These are estimates from what you’ve recorded. A bigger day doesn’t undo
                    anything: the plan simply spreads what’s left.
                  </p>
                  <p>The status looks back at the past 14 days. It doesn’t predict.</p>
                </InfoTip>
              </div>
              <h2 className="type-display text-balance">{plan.headline}</h2>
              <p className="type-body text-pretty text-text-secondary">{plan.detail}</p>
            </div>
            {cycle ? (
              <div className="flex flex-col gap-1.5">
                <Progress
                  steps={cycle.lengthDays}
                  value={cycle.dayNumber}
                  tone="neutral"
                  label={`This allowance period · started ${formatLocalDate(cycle.startDate)}`}
                  valueText={`Day ${cycle.dayNumber} of ${cycle.lengthDays}`}
                />
                <p className="type-caption text-text-secondary" data-testid="survival-cycle">
                  Spent so far this period: <span className="money">{money(cycle.spentPaise)}</span>
                  {cycle.expectedIncomePaise ? (
                    <>
                      , of a usual <span className="money">{money(cycle.expectedIncomePaise)}</span>{" "}
                      allowance.
                    </>
                  ) : (
                    "."
                  )}
                </p>
              </div>
            ) : (
              <p className="type-caption text-text-secondary">
                There’s no regular period to show, because your income isn’t set as weekly,
                fortnightly or monthly.{" "}
                <Link href="/settings#settings-income" className="underline underline-offset-4">
                  Change it in Settings
                </Link>
                .
              </p>
            )}
          </section>

          <Section
            title="Allowance"
            meta="An estimate: your flexible money over the days left."
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/safe-to-spend">
                  How it’s worked out
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            }
          >
            <StatRow className="sm:flex">
              <Stat
                label="Daily"
                value={
                  <span className="text-money-estimate" data-testid="survival-daily">
                    {money(plan.dailyAllowancePaise!)}
                  </span>
                }
              />
              <Stat
                label="Weekly"
                value={money(plan.weeklyAllowancePaise!)}
                meta="Up to seven days"
              />
              <Stat
                label="Days left"
                value={<span data-testid="survival-days">{String(plan.daysLeft)}</span>}
                meta={`Income ${formatLocalDate(result.inputs.nextIncomeDate!)}`}
              />
              <Stat label="Spent today" value={money(plan.spentTodayPaise)} />
            </StatRow>
          </Section>

          <Section title="Ways to make room" meta="Each one changes the plan above.">
            <ul className="flex flex-col divide-y divide-(--section-divider)">
              {TIPS.map((tip) => (
                <li key={tip.href}>
                  <Link
                    href={tip.href}
                    className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-(--duration-quick) outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block type-body font-medium">{tip.title}</span>
                      <span className="block type-caption text-text-secondary">{tip.detail}</span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}
