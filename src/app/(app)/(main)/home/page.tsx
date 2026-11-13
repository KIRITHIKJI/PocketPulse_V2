import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";

import { FiguresInfo } from "@/components/home/figures-info";
import { OfflineFiguresNote } from "@/components/home/offline-figures-note";
import { PlanLines } from "@/components/home/plan-snapshots";
import { PlayerChip, PlayerChipSkeleton } from "@/components/home/player-chip";
import { SafeToSpendCard, SafeToSpendCardSkeleton } from "@/components/home/safe-to-spend-card";
import { DataList, Hero, Section, Stat, StatRow } from "@/components/layout/primitives";
import { WaitingEntries } from "@/components/offline/waiting-entries";
import { StatePanel } from "@/components/states/state-panel";
import { AnimatedMoney } from "@/components/transactions/animated-money";
import { EntryCard } from "@/components/transactions/entry-list";
import { QuickAdd } from "@/components/transactions/quick-add";
import { Button } from "@/components/ui/button";
import {
  type TimeSettings,
  budgetAlert,
  evaluateBudget,
  frequentExpensesSince,
  goalProgress,
  indexById,
  moneyFormatter,
  netPositionParts,
  netSpending,
  occurredAtMs,
  resolvePeriod,
  sumPaise,
  toLocalDate,
  transactionsInPeriod,
} from "@/domain";
import { loadEntryKit } from "@/lib/data/entry-kit";
import {
  getActiveGoals,
  getBudgets,
  getGoalLedger,
  getLatestExpense,
  getLedgerSince,
  getProfile,
  getQuickAddPresets,
  getRecentEntries,
  getReminderPreferences,
  getWalletBalances,
  withBudgetPeriods,
} from "@/lib/data/queries";
import { requestNow } from "@/lib/data/session";
import { earliestStart, isoInstant, mergeLedger, startForAnyZone } from "@/lib/data/slices";
import { entryView } from "@/lib/entry-view";
import { formatDayLabel, formatLocalDate, formatTimeOf } from "@/lib/format";
import { newestFirst } from "@/lib/history";
import { HOME_TILES, mostUsedFirst, shortcutEntries, tileEntries } from "@/lib/quick-entries";

export const metadata: Metadata = { title: "Home" };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const RECENT = 5;

/**
 * Home (doc/V2_SPEC.md §8, doc/DESIGN_PLAN.md "V2 Phase 3B"). One dominant element: the net
 * tracked balance beside Safe to Spend. Then quick add, today's and this month's spending, recent
 * entries, one line per plan and one progression strip. On phones it is one column in that order;
 * on laptops quick add and recent entries sit beside a narrow column of spending, plans and progress.
 */
export default async function HomePage() {
  const now = requestNow();
  // The rows this screen's periods can need, whatever the profile's zone: today, this week and
  // this month (budgets), and the "frequent" look-back. Read alongside everything else.
  const periodsFor = (s: TimeSettings) =>
    (["today", "this_week", "this_month"] as const).map((kind) => resolvePeriod({ kind }, now, s));
  const since = earliestStart(startForAnyZone(periodsFor), frequentExpensesSince(now));
  const [
    kit,
    profile,
    window,
    latestExpense,
    goalLedger,
    balances,
    presets,
    budgets,
    goals,
    reminders,
  ] = await Promise.all([
    loadEntryKit(),
    getProfile(),
    getLedgerSince(isoInstant(since!)),
    getLatestExpense(),
    getGoalLedger(),
    getWalletBalances(isoInstant(now)),
    getQuickAddPresets(),
    getBudgets(),
    getActiveGoals(),
    getReminderPreferences(),
  ]);
  const ledger = await withBudgetPeriods(window, since!, budgets, now);
  const tz = profile.timeZone;
  const settings = { timeZone: tz, weekStartsOn: profile.weekStartsOn };
  const money = moneyFormatter(profile.currency);

  // Every figure below comes from the ledger through the domain layer; nothing is stored.
  const balance = balances.closing;
  const position = netPositionParts(kit.accounts, balance.accounts);
  const today = resolvePeriod({ kind: "today" }, now, settings);
  const month = resolvePeriod({ kind: "this_month" }, now, settings);
  const spentToday = netSpending(ledger, today);
  const spentMonth = netSpending(ledger, month);
  const incomeMonth = sumPaise(
    transactionsInPeriod(ledger, month)
      .filter((tx) => tx.type === "income")
      .map((tx) => tx.amountPaise),
  );
  const monthName = MONTHS[Number(month.startDate!.slice(5, 7)) - 1];

  // The newest entries are in the window, unless it holds fewer than five: only then read them.
  const inWindow = window.filter((tx) => occurredAtMs(tx) >= since!).length;
  const seen = inWindow >= RECENT ? ledger : mergeLedger(ledger, await getRecentEntries(RECENT));
  const ctx = {
    categoriesById: new Map(kit.categories.map((c) => [c.id, c])),
    accountsById: new Map(kit.accounts.map((a) => [a.id, a])),
    ledgerById: indexById(seen),
    currency: profile.currency,
  };
  const recent = [...seen].sort(newestFirst).slice(0, RECENT);

  const evaluate = (budget: (typeof budgets)[number]) =>
    evaluateBudget(budget, ledger, now, settings, undefined, money);
  const totalBudget = budgets.find((b) => b.period === "monthly" && b.categoryId === null);
  const alertsOn = !reminders.allDisabled && reminders.budgetAlerts;
  const alertCount = alertsOn
    ? budgets.filter((budget) => budgetAlert(evaluate(budget)) !== null).length
    : 0;
  const goalCards = goals.map((goal) => ({
    goal,
    progress: goalProgress(goal, goalLedger, kit.today, "weekly", money),
  }));
  const tiles = mostUsedFirst(tileEntries(presets, kit.categories), ledger, now);

  return (
    <>
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="type-title">Home</h1>
        <p className="type-caption text-text-secondary">{formatLocalDate(today.startDate!)}</p>
      </header>
      <OfflineFiguresNote />
      <WaitingEntries currency={profile.currency} />

      <Hero
        aria-label="Balance and Safe to Spend"
        className="relative"
        label={
          <span className="flex items-center gap-2">
            Tracked balance · all accounts · now
            <FiguresInfo untracked={balance.untrackedAccountIds.length} />
          </span>
        }
        value={
          <AnimatedMoney
            paise={balance.balancePaise}
            currency={profile.currency}
            data-testid="home-balance"
          />
        }
        meta={
          position ? (
            // Each part stays whole; a narrow screen breaks the line between them.
            <span className="money" data-testid="home-net-position">
              <span className="whitespace-nowrap">In wallets {money(position.inWalletsPaise)}</span>
              {" · "}
              <span className="whitespace-nowrap">You owe {money(position.youOwePaise)}</span>
              {" · "}
              <span className="whitespace-nowrap">
                Owed to you {money(position.owedToYouPaise)}
              </span>
            </span>
          ) : null
        }
        aside={
          // Streams after the money, like the progress strip: its reads never hold up Home.
          <Suspense fallback={<SafeToSpendCardSkeleton />}>
            <SafeToSpendCard />
          </Suspense>
        }
      />
      {!profile.onboardingCompletedAt && (
        <div
          className="-mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-(--finance-inset) p-3"
          data-testid="finish-setup"
        >
          <p className="min-w-0 flex-1 type-body">
            Add your starting balance so this figure starts from the right number.
          </p>
          <Button size="sm" asChild>
            <Link href="/onboarding">Add starting balance</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-section lg:grid-cols-12 lg:gap-x-12">
        {/* On phones both columns dissolve into one ordered list: tiles, spending, recent entries,
            plans, then progress. */}
        <div className="contents lg:col-span-8 lg:flex lg:min-w-0 lg:flex-col lg:gap-section">
          <Section divided={false} className="order-1" aria-labelledby="quick-add-heading">
            {tiles.length > 0 ? (
              <QuickAdd
                kit={kit}
                tiles={tiles}
                visible={HOME_TILES}
                title={{ text: "Quick add", id: "quick-add-heading" }}
                shortcuts={shortcutEntries(mergeLedger(ledger, latestExpense), kit.categories, now)}
                showRoutes
              />
            ) : (
              <StatePanel
                size="section"
                title="All tiles are hidden"
                description="Show a tile again, or add your own."
                actions={
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/add?tab=edit">Edit tiles</Link>
                  </Button>
                }
              />
            )}
          </Section>

          <Section
            title="Recent"
            className="order-3 min-w-0"
            action={
              recent.length > 0 && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/transactions">
                    All transactions
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              )
            }
          >
            {recent.length === 0 ? (
              <StatePanel
                size="section"
                icon={Receipt}
                title="Nothing recorded yet"
                description="Tap a tile above, or type what you spent. Your first entry shows up here, and every figure on this page follows it."
              />
            ) : (
              <DataList className="-mx-2" data-testid="recent-entries">
                {recent.map((tx) => (
                  <EntryCard
                    key={tx.id}
                    entry={{
                      ...entryView(tx, ctx),
                      timeLabel: `${formatDayLabel(toLocalDate(occurredAtMs(tx), tz), kit.today)}, ${formatTimeOf(tx.occurredAt, tz)}`,
                    }}
                  />
                ))}
              </DataList>
            )}
          </Section>
        </div>

        <div className="contents lg:col-span-4 lg:flex lg:min-w-0 lg:flex-col lg:gap-section">
          <Section title="Spending" className="order-2 lg:border-t-0 lg:pt-0">
            <StatRow className="sm:grid [&_dt]:whitespace-nowrap [&>div]:sm:px-4">
              <Stat
                label="Spent today"
                value={
                  <AnimatedMoney
                    paise={spentToday}
                    currency={profile.currency}
                    data-testid="home-spent-today"
                  />
                }
                meta={formatLocalDate(today.startDate!)}
              />
              <Stat
                label="Spent this month"
                value={
                  <AnimatedMoney
                    paise={spentMonth}
                    currency={profile.currency}
                    data-testid="home-spent-month"
                  />
                }
                meta={
                  incomeMonth > 0 ? (
                    <>
                      {monthName} so far · income{" "}
                      <span className="money">{money(incomeMonth)}</span>
                    </>
                  ) : (
                    `${monthName} so far`
                  )
                }
              />
            </StatRow>
          </Section>

          <Section title="Plans" className="order-4">
            <PlanLines
              alertCount={alertCount}
              budgetEval={totalBudget ? evaluate(totalBudget) : null}
              hasBudgets={budgets.length > 0}
              goalCards={goalCards}
              money={money}
            />
          </Section>

          {profile.showProgress && (
            <div className="order-5">
              <Suspense fallback={<PlayerChipSkeleton />}>
                <PlayerChip />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
