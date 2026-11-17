import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ChevronDown, Settings, Zap } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { HubTabs } from "@/components/layout/hub-tabs";
import { EmptyHero, InfoTip, Section } from "@/components/layout/primitives";
import { PeriodPicker } from "@/components/insights/parts";
import { WhatIf } from "@/components/insights/what-if";
import { EntryCard } from "@/components/transactions/entry-list";
import { Button } from "@/components/ui/button";
import {
  type PurchaseGroup,
  type PurchaseGrouping,
  comparisonWindows,
  formatBasisPoints,
  indexById,
  leakReport,
  MIN_REPEATS,
  moneyFormatter,
  occurredAtMs,
  periodScope,
  PURCHASE_GROUPINGS,
  toLocalDate,
} from "@/domain";
import {
  getAccounts,
  getCategories,
  getLedgerSince,
  getProfile,
  getQuickAddPresets,
  hasSpending,
} from "@/lib/data/queries";
import { requestNow } from "@/lib/data/session";
import { isoInstant, startForAnyZone } from "@/lib/data/slices";
import { entryView } from "@/lib/entry-view";
import { formatDayLabel, formatTimeOf } from "@/lib/format";
import { newestFirst } from "@/lib/history";
import { historyHref, insightHref, insightWords, parseInsightSelection } from "@/lib/insights-view";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Money leaks" };

const GROUPING_LABELS: Record<PurchaseGrouping, string> = {
  description: "Similar description",
  merchant: "Merchant",
  tile: "Quick-add tile",
  category: "Category",
};

const FOCUS = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function MoneyLeaksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const now = requestNow();
  // Leaks compare the chosen period with the one before it; nothing older is needed.
  const since = startForAnyZone((s) => {
    const { period } = parseInsightSelection(params, now, s);
    return [
      period,
      comparisonWindows(period, toLocalDate(now, s.timeZone), 1)?.previous[0] ?? null,
    ];
  });
  const [profile, categories, accounts, ledger, presets, anySpending] = await Promise.all([
    getProfile(),
    getCategories(),
    getAccounts(),
    getLedgerSince(since === null ? null : isoInstant(since)),
    getQuickAddPresets(),
    hasSpending(),
  ]);
  const settings = { timeZone: profile.timeZone, weekStartsOn: profile.weekStartsOn };
  const tz = settings.timeZone;
  const today = toLocalDate(now, tz);
  const money = moneyFormatter(profile.currency);

  const selection = parseInsightSelection(params, now, settings);
  const { period } = selection;
  const words = insightWords(selection, today, categories, profile.currency);
  const by = (PURCHASE_GROUPINGS as readonly unknown[]).includes(params.by)
    ? (params.by as PurchaseGrouping)
    : "description";
  const previous = comparisonWindows(period, today, 1)?.previous[0] ?? null;
  const threshold = profile.smallPurchaseThresholdPaise;
  const report = leakReport({
    ledger,
    period,
    previous,
    by,
    thresholdPaise: threshold,
    labelOf: words.labelOf,
    tileLabels: new Map(presets.map((p) => [p.id, p.label])),
  });

  const ctx = {
    categoriesById: new Map(categories.map((c) => [c.id, c])),
    accountsById: new Map(accounts.map((a) => [a.id, a])),
    ledgerById: indexById(ledger),
    currency: profile.currency,
  };
  const entriesOf = (ids: readonly string[]) =>
    ids
      .map((id) => ctx.ledgerById.get(id)!)
      .sort(newestFirst)
      .map((tx) => ({
        ...entryView(tx, ctx),
        timeLabel: `${formatDayLabel(toLocalDate(occurredAtMs(tx), tz), today)}, ${formatTimeOf(tx.occurredAt, tz)}`,
      }));

  const hrefOf = (group: PurchaseGroup): Route =>
    historyHref({
      type: "spending",
      ...periodScope(period),
      underPaise: threshold,
      by,
      key: group.key,
    });
  const nameOf = (group: PurchaseGroup) => group.label.split(" › ").at(-1)!;
  const detailOf = (group: PurchaseGroup) =>
    [
      `${group.count} times`,
      `average ${money(group.averagePaise!)}`,
      group.shareBp === null ? null : `${formatBasisPoints(group.shareBp, 0)} of spending`,
      group.refundsPaise > 0 ? `${money(group.refundsPaise)} refunded` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  // Groups come biggest first: the first one leads the screen.
  const biggest = report.groups[0];

  const settingsLink = (
    <Button variant="outline" asChild>
      <Link href="/settings">
        <Settings aria-hidden="true" />
        Change the small-purchase amount
      </Link>
    </Button>
  );

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader
          title="Money leaks"
          description="Repeated small purchases, grouped so you can decide what’s worth it."
        />
        <div className="min-w-0 xl:shrink-0">
          <PeriodPicker
            kind={selection.kind}
            customFrom={selection.customFrom}
            customTo={selection.customTo}
            error={selection.error}
            extra={`&by=${by}`}
          />
        </div>
      </div>
      <HubTabs hub="insights" />
      <nav aria-label="Group by" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max items-center gap-1 rounded-xl border bg-muted/50 p-1">
          <li aria-hidden="true" className="px-2 type-caption text-muted-foreground">
            Group by
          </li>
          {PURCHASE_GROUPINGS.map((option) => (
            <li key={option}>
              <Link
                href={insightHref("/insights/leaks", selection, `&by=${option}`)}
                scroll={false}
                aria-current={option === by ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-lg px-3 type-body font-medium whitespace-nowrap text-muted-foreground transition-colors duration-(--duration-quick) hover:text-foreground pointer-coarse:min-h-11",
                  FOCUS,
                  option === by && "bg-card text-foreground shadow-sm",
                )}
              >
                {GROUPING_LABELS[option]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!biggest ? (
        <EmptyHero
          label={`Repeated small purchases · ${words.period}`}
          title="Not enough repeated purchases yet"
          description={
            <>
              No repeated small purchases {words.period}. A group needs {MIN_REPEATS} similar
              purchases under <span className="money">{money(threshold)}</span>.
            </>
          }
          actions={
            anySpending ? (
              settingsLink
            ) : (
              <>
                <Button asChild>
                  <Link href="/add">
                    <Zap aria-hidden="true" />
                    Quick add
                  </Link>
                </Button>
                {settingsLink}
              </>
            )
          }
        />
      ) : (
        <div className="grid gap-section lg:grid-cols-12 lg:items-start lg:gap-x-12">
          <section
            aria-label="Biggest repeated purchase"
            className="flex min-w-0 flex-col gap-4 lg:col-span-5"
          >
            <div className="flex flex-col gap-1">
              <div className="relative flex items-center gap-1">
                <h2 className="type-label text-text-secondary">
                  Biggest repeated purchase · {words.period}
                </h2>
                <InfoTip label="About money leaks">
                  <p>
                    Purchases under <span className="money">{money(threshold)}</span> that repeat at
                    least {MIN_REPEATS} times, grouped by {GROUPING_LABELS[by].toLowerCase()}. The
                    amount is set in Settings.
                  </p>
                  <p>What-ifs are simple estimates from the median price, not advice.</p>
                  {report.ungroupedCount > 0 && (
                    <p>
                      {report.ungroupedCount} small{" "}
                      {report.ungroupedCount === 1 ? "purchase has" : "purchases have"} nothing to
                      group by in this view.
                    </p>
                  )}
                </InfoTip>
              </div>
              <p className="type-title">{nameOf(biggest)}</p>
              <Link
                href={hrefOf(biggest)}
                className={`self-start rounded-lg hover:underline ${FOCUS}`}
              >
                <span className="type-hero money">{money(biggest.netPaise)}</span>
              </Link>
              <p className="type-body text-text-secondary money">{detailOf(biggest)}</p>
            </div>
            <WhatIf
              group={biggest}
              name={nameOf(biggest)}
              span="a period like this one"
              currency={profile.currency}
            />
          </section>

          <Section
            title={`Repeated purchases ${words.period}`}
            className="min-w-0 lg:col-span-7 lg:border-t-0 lg:pt-0"
            meta={
              <span className="money" data-testid="leak-summary">
                {report.groups.length} under {money(threshold)}, together {money(report.netPaise)}
                {report.shareBp === null
                  ? ""
                  : `, ${formatBasisPoints(report.shareBp, 0)} of your spending`}
                . Open one for its what-if and entries.
              </span>
            }
          >
            <ul className="flex flex-col divide-y divide-(--section-divider)">
              {report.groups.map((group) => {
                const c = group.comparison;
                const name = nameOf(group);
                return (
                  <li
                    key={group.key}
                    className="min-w-0"
                    data-testid="leak-group"
                    data-paise={group.netPaise}
                  >
                    <details className="group/leak">
                      <summary
                        className={`-mx-2 flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-(--duration-quick) hover:bg-accent/50 [&::-webkit-details-marker]:hidden ${FOCUS}`}
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate type-body font-medium">{name}</span>
                          <span className="truncate type-caption text-text-secondary money">
                            {detailOf(group)}
                          </span>
                        </span>
                        <span className="shrink-0 type-body font-semibold money">
                          {money(group.netPaise)}
                        </span>
                        <ChevronDown
                          className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-quick) group-open/leak:rotate-180"
                          aria-hidden="true"
                        />
                      </summary>
                      <div className="flex flex-col gap-3 pt-1 pb-4">
                        <WhatIf
                          group={group}
                          name={name}
                          span="a period like this one"
                          currency={profile.currency}
                        />
                        <p className="type-caption text-text-secondary money">
                          {c
                            ? `Compared with ${words.previous}: ${money(c.previousPaise)}, ${c.previousCount} ${c.previousCount === 1 ? "time" : "times"}. ${
                                c.deltaPaise === 0
                                  ? "The same now."
                                  : `${money(Math.abs(c.deltaPaise))} ${c.deltaPaise > 0 ? "more" : "less"} now.`
                              }`
                            : `Not enough data to compare yet. ${group.comparisonNote}`}
                        </p>
                        <details>
                          <summary
                            className={`inline-flex min-h-10 cursor-pointer items-center rounded-lg type-body font-medium text-muted-foreground hover:text-foreground pointer-coarse:min-h-11 ${FOCUS}`}
                          >
                            See the {group.transactionIds.length} entries
                          </summary>
                          <ul className="flex flex-col">
                            {entriesOf(group.transactionIds).map((entry) => (
                              <EntryCard key={entry.id} entry={entry} />
                            ))}
                          </ul>
                          <Link
                            href={hrefOf(group)}
                            className="inline-flex min-h-11 items-center type-body font-medium text-primary underline underline-offset-2"
                          >
                            Open in Transactions
                          </Link>
                        </details>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>
      )}
    </>
  );
}
