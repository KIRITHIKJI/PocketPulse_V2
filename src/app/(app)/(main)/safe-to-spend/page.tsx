import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Notice } from "@/components/feedback/notice";
import { PageHeader } from "@/components/layout/page-header";
import { InfoTip, Section, Stat, StatRow } from "@/components/layout/primitives";
import { IncomeDatePrompt } from "@/components/plan/income-date-prompt";
import { FigureRow } from "@/components/plan/parts";
import { PlanningForm, PlanningFormState } from "@/components/plan/planning-form";
import { Button } from "@/components/ui/button";
import { loadPlan } from "@/lib/data/plan";
import { formatLocalDate } from "@/lib/format";
import { dueItems } from "@/lib/plan-view";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Safe to Spend" };

/**
 * Safe to Spend (doc/DESIGN_PLAN.md, V2 Phase 3E): the daily amount leads; how it's worked out
 * follows as a calm breakdown, one short explanation per line. Without a next income date there is
 * no number, only the question.
 */
export default async function SafeToSpendPage() {
  const { profile, commitments, templates, ledger, today, money, result } = await loadPlan();
  const { inputs } = result;
  const ok = result.status === "ok";
  const horizon = inputs.horizonEndDate ? formatLocalDate(inputs.horizonEndDate) : null;
  const counted = dueItems({
    commitments,
    templates,
    ledger,
    today,
    until: inputs.horizonEndDate ?? today,
    countedIds: inputs.commitmentIds,
  }).filter((item) => item.counted);

  const form = (
    <PlanningForm
      nextIncomeDate={profile.nextIncomeDate}
      reservePaise={profile.safeToSpendReservePaise}
      today={today}
    />
  );

  // What the daily figure leads to. Without a date each one is "—", and says why.
  const limits = (
    <StatRow className="sm:flex">
      {!ok && (
        <Stat
          label="Daily"
          value={<span data-testid="stp-daily">—</span>}
          meta="Not shown without a date"
        />
      )}
      <Stat
        label="Days until income"
        value={
          <span data-testid="stp-days">
            {result.daysUntilNextIncome === null ? "—" : String(result.daysUntilNextIncome)}
          </span>
        }
        meta={ok ? "Today counts; that day doesn’t" : "Needs your next income date"}
      />
      <Stat
        label="Weekly limit"
        value={
          <span data-testid="stp-weekly">
            {result.suggestedWeeklyPaise === null ? "—" : money(result.suggestedWeeklyPaise)}
          </span>
        }
        meta={ok ? "Up to seven days of the daily amount" : undefined}
      />
    </StatRow>
  );

  // The form moves between the date prompt and its own section; its result stays above both.
  return (
    <PlanningFormState>
      <PageHeader
        title="Safe to Spend"
        description="What’s flexible after savings and bills, until your next income."
        tabs="plan"
      />

      <section aria-label="Daily amount" className="flex flex-col gap-6">
        {ok ? (
          <div className="flex flex-col gap-1">
            <div className="relative flex items-center gap-1">
              <h2 className="type-label text-text-secondary">
                Safe to Spend · estimate · until {formatLocalDate(inputs.nextIncomeDate!)}
              </h2>
              <InfoTip label="About Safe to Spend">
                <p>
                  An estimate from what you’ve recorded: your flexible money shared over the days
                  until your next income. It isn’t a limit to use up.
                </p>
                <p>Budgets aren’t subtracted here: they’re targets, not reserved money.</p>
                <p>
                  How often money comes in is set in{" "}
                  <Link href="/settings#settings-income" className="underline underline-offset-4">
                    Settings
                  </Link>
                  .
                </p>
              </InfoTip>
            </div>
            <p className="type-body text-text-secondary">
              <span className="type-hero text-money-estimate money" data-testid="stp-daily">
                {result.suggestedDailyPaise === null ? "—" : money(result.suggestedDailyPaise)}
              </span>{" "}
              a day
            </p>
          </div>
        ) : (
          <IncomeDatePrompt
            nextIncomeDate={profile.nextIncomeDate}
            frequency={profile.incomeFrequency}
            today={today}
            form={form}
          />
        )}
        {limits}
        {result.warnings.length > 0 && (
          <ul className="flex max-w-3xl flex-col gap-2" data-testid="stp-warnings">
            {result.warnings.map((warning) => (
              <li key={warning}>
                <Notice tone="warning">{warning}</Notice>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-section lg:grid-cols-12 lg:gap-x-12">
        <Section
          title="How it’s worked out"
          meta="Now, from your tracked balance."
          className="min-w-0 lg:col-span-7"
        >
          <dl className="divide-y divide-(--section-divider)">
            <FigureRow
              label="Tracked balance · all accounts"
              value={money(inputs.balancePaise)}
              testId="stp-balance"
              explanation="Opening balances plus what you’ve recorded. Not a bank balance."
            />
            <FigureRow
              label="Less set aside for goals"
              value={money(inputs.earmarkedPaise)}
              testId="stp-earmarked"
              valueClassName="text-money-earmark"
              explanation="Still yours, but spoken for. Release it from the goal to free it up."
            />
            <FigureRow
              label={horizon ? `Less unpaid bills due by ${horizon}` : "Less unpaid bills"}
              value={money(inputs.commitmentsDuePaise)}
              testId="stp-commitments"
              explanation={`${counted.length} item${counted.length === 1 ? "" : "s"} not paid yet. Paid bills are already in your balance.`}
            >
              {counted.length > 0 && (
                <div className="flex flex-col pt-1 pl-3">
                  <ul
                    className="divide-y divide-(--section-divider) border-l border-(--section-divider) pl-3"
                    data-testid="stp-bills"
                  >
                    {counted.map((item) => (
                      <li
                        key={item.key}
                        className="flex min-h-12 items-center justify-between gap-3 py-1.5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate type-body">{item.title}</span>
                          <span className="type-caption text-text-secondary">
                            {item.label === "Bill" ? "Planned, not paid" : item.label} · due{" "}
                            {formatLocalDate(item.dueDate)}
                          </span>
                        </span>
                        <span className="shrink-0 type-body money">{money(item.amountPaise)}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="ghost" size="sm" asChild className="self-start">
                    <Link href="/recurring">
                      Pay or change these
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              )}
            </FigureRow>
            {inputs.reservePaise > 0 && (
              <FigureRow
                label="Less minimum reserve"
                value={money(inputs.reservePaise)}
                explanation="The amount you chose to keep untouched."
              />
            )}
            <FigureRow
              label="Flexible money"
              value={money(result.flexiblePaise)}
              strong
              testId="flexible"
              valuePaise={result.flexiblePaise}
              valueClassName={cn(result.flexiblePaise < 0 && "text-money-negative")}
              explanation={
                ok
                  ? `Balance minus everything above, shared over the ${result.daysUntilNextIncome} days until your next income.`
                  : "Balance minus everything above."
              }
            />
          </dl>
        </Section>

        {ok && (
          <Section
            title="Your planning details"
            meta="The date and reserve this uses."
            className="min-w-0 lg:col-span-5"
          >
            {form}
          </Section>
        )}
      </div>
    </PlanningFormState>
  );
}
