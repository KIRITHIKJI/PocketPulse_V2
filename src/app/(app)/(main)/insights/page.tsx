import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";

import { TodayReviewed } from "@/components/rewards/today-reviewed";
import { PageHeader } from "@/components/layout/page-header";
import { HubTabs } from "@/components/layout/hub-tabs";
import { EmptyHero, InfoTip } from "@/components/layout/primitives";
import {
  ComparisonCard,
  ComparisonLine,
  FrequentCard,
  RecurringCard,
  StandoutCard,
  UnusualCard,
} from "@/components/insights/insight-panels";
import { PeriodPicker } from "@/components/insights/parts";
import { CategorySection, HeroStat, PeriodTrend } from "@/components/insights/sections";
import { Button } from "@/components/ui/button";
import {
  buildInsights,
  formatBasisPoints,
  moneyFormatter,
  periodScope,
  toLocalDate,
  UNCATEGORIZED,
} from "@/domain";
import { loadInsightsLedger } from "@/lib/data/insights";
import { getCategories, getProfile } from "@/lib/data/queries";
import { requestNow } from "@/lib/data/session";
import {
  historyHref,
  insightHref,
  insightWords,
  parseGranularity,
  parseInsightSelection,
} from "@/lib/insights-view";

export const metadata: Metadata = { title: "Insights" };

const FOCUS = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Insights (doc/DESIGN_PLAN.md, V2 Phase 3E): the period's net spending with its comparison leads,
 * where it went beside it, then the trend and the findings as plain lists. Every figure, bar and
 * sentence opens the transactions behind it.
 */
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const now = requestNow();
  const [profile, categories, ledger] = await Promise.all([
    getProfile(),
    getCategories(),
    loadInsightsLedger(params, now),
  ]);
  const settings = { timeZone: profile.timeZone, weekStartsOn: profile.weekStartsOn };
  const today = toLocalDate(now, settings.timeZone);
  const money = moneyFormatter(profile.currency);

  const selection = parseInsightSelection(params, now, settings);
  const { period } = selection;
  const words = insightWords(selection, today, categories, profile.currency);
  const model = buildInsights({
    ledger,
    period,
    today,
    settings,
    thresholdPaise: profile.smallPurchaseThresholdPaise,
    words,
  });
  const scope = periodScope(period);
  const spending = { type: "spending", ...scope } as const;
  const incomeHref = historyHref({ type: "income", ...scope });
  const hasIncome = model.income.count > 0;

  const header = (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader title="Insights" description="Where your money went, and what changed." />
        <div className="min-w-0 xl:shrink-0">
          <PeriodPicker
            kind={selection.kind}
            customFrom={selection.customFrom}
            customTo={selection.customTo}
            error={selection.error}
          />
        </div>
      </div>
      <HubTabs hub="insights" />
      {selection.kind === "today" && <TodayReviewed today={today} />}
    </>
  );

  /** Income is never part of spending; it gets its own quiet line, still opening its entries. */
  const incomeLine = hasIncome && (
    <p className="type-body text-text-secondary">
      Income {words.period}:{" "}
      <Link
        href={incomeHref}
        className={`rounded-sm font-medium text-foreground underline-offset-4 hover:underline ${FOCUS}`}
      >
        <span className="money" data-testid="insights-income">
          {money(model.income.paise)}
        </span>
      </Link>
      , shown apart from spending.
    </p>
  );

  if (model.status !== "ready") {
    return (
      <>
        {header}
        {model.status === "no_spending" ? (
          <EmptyHero
            label={`Net spending · ${words.period}`}
            title="Not enough data for insights yet"
            description="Insights appear after a few purchases. Log 3 to see your first breakdown."
            actions={
              <Button asChild>
                <Link href="/add">
                  <Zap aria-hidden="true" />
                  Quick add
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyHero
            label={`Net spending · ${words.period}`}
            title={`Nothing recorded ${words.period}`}
            description="You have spending in other periods. Pick another one, or look at everything."
            actions={
              <Button variant="outline" asChild>
                <Link href={{ pathname: "/insights", query: { period: "all_time" } }}>
                  See all time
                </Link>
              </Button>
            }
          />
        )}
        {incomeLine}
      </>
    );
  }

  const { breakdown, small } = model;
  const unassigned = breakdown.categories.find((c) => c.key === UNCATEGORIZED);

  return (
    <>
      {header}

      <div className="grid gap-section lg:grid-cols-12 lg:items-start lg:gap-x-12">
        <div className="flex min-w-0 flex-col gap-section lg:col-span-5">
          <section aria-label="Totals" className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-1">
              <div className="relative flex items-center gap-1">
                <h2 className="type-label text-text-secondary">Net spending · {words.period}</h2>
                <InfoTip label="About these figures">
                  <p>
                    <strong className="font-semibold">Net spending</strong> is expenses minus
                    refunds. A refund reduces the category of its purchase, in the period the refund
                    happened.
                  </p>
                  <p>Income is shown separately and never offsets spending here.</p>
                  {unassigned && (
                    <p>
                      Unassigned entries are counted in every total and stay their own group, never
                      part of another category.
                    </p>
                  )}
                </InfoTip>
              </div>
              <Link
                href={historyHref(spending)}
                className={`self-start rounded-lg hover:underline ${FOCUS}`}
              >
                <span className="type-hero money" data-testid="insights-net">
                  {money(breakdown.netPaise)}
                </span>
              </Link>
              {breakdown.refundsPaise > 0 && (
                <p className="type-caption text-text-secondary">
                  <span className="money">{money(breakdown.grossPaise)}</span> spent,{" "}
                  <Link
                    href={historyHref({ type: "refund", ...scope })}
                    className={`rounded-sm underline underline-offset-2 ${FOCUS}`}
                  >
                    <span className="money">{money(breakdown.refundsPaise)}</span> refunded
                  </Link>
                </p>
              )}
            </div>
            <ComparisonLine model={model} words={words} money={money} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-(--section-divider) pt-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              <HeroStat
                href={historyHref(spending)}
                label="Purchases"
                value={breakdown.expenseCount}
                hint={
                  model.averagePaise === null
                    ? "Average needs 2 or more"
                    : `Average ${money(model.averagePaise)}${model.medianPaise === null ? "" : ` · median ${money(model.medianPaise)}`}`
                }
                testId="insights-count"
              />
              <HeroStat
                href={
                  small.count > 0
                    ? historyHref({ ...spending, underPaise: small.thresholdPaise })
                    : null
                }
                label={`Under ${money(small.thresholdPaise)}`}
                value={money(small.netPaise)}
                hint={`${small.count} ${small.count === 1 ? "purchase" : "purchases"}${small.shareBp === null ? "" : ` · ${formatBasisPoints(small.shareBp, 0)} of spending`}`}
                testId="insights-small"
              />
              <HeroStat
                href={hasIncome ? incomeHref : null}
                label="Income"
                value={hasIncome ? money(model.income.paise) : "None recorded"}
                hint="Kept apart from spending"
                testId={hasIncome ? "insights-income" : undefined}
              />
            </div>
          </section>
          <PeriodTrend
            subject="Spending"
            ledger={ledger}
            period={period}
            today={today}
            settings={settings}
            requested={parseGranularity(params.trend)}
            scope={{ type: "spending" }}
            optionHref={(g) => insightHref("/insights", selection, `&trend=${g}`)}
            currency={profile.currency}
          />
        </div>

        <CategorySection
          breakdown={breakdown}
          categories={categories}
          selection={selection}
          money={money}
          className="lg:col-span-7 lg:border-t-0 lg:pt-0"
        />
      </div>

      <StandoutCard model={model} words={words} />
      <div className="grid gap-section lg:grid-cols-2 lg:gap-x-12">
        <ComparisonCard model={model} words={words} selection={selection} money={money} />
        <FrequentCard model={model} words={words} spending={spending} money={money} />
        <UnusualCard model={model} />
        <RecurringCard model={model} money={money} />
      </div>

      <Link
        href={insightHref("/insights/leaks", selection)}
        className={`inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg type-body font-medium text-text-secondary hover:text-foreground ${FOCUS}`}
      >
        Repeated small purchases {words.period}, with a what-if, in Money leaks
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </>
  );
}
