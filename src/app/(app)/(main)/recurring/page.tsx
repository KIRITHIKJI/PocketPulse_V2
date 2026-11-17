import type { Metadata } from "next";
import Link from "next/link";

import { InlineAction } from "@/components/forms/inline-action";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyHero, InfoTip, Section } from "@/components/layout/primitives";
import { BillFormDialog } from "@/components/plan/due-forms";
import { RecurringFormDialog } from "@/components/plan/recurring-form";
import { DueItemCard, RecurringTemplateCard } from "@/components/plan/recurring-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addDays, recurringSignals } from "@/domain";
import { unskipOccurrence } from "@/lib/actions/recurring";
import { loadEntryKit } from "@/lib/data/entry-kit";
import { loadPlan } from "@/lib/data/plan";
import { getSpendingLedger } from "@/lib/data/queries";
import { mergeLedger } from "@/lib/data/slices";
import { formatLocalDate } from "@/lib/format";
import { dueItems, occurredItems } from "@/lib/plan-view";

export const metadata: Metadata = { title: "Income & recurring" };

const LOOK_AHEAD_DAYS = 45;

/** Phones: jump between the two halves; both stay on the page, so nothing is hidden. */
function SectionJump() {
  const link =
    "flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 type-body font-medium text-muted-foreground transition-colors duration-(--duration-quick) hover:bg-surface-2 hover:text-foreground";
  return (
    <nav aria-label="Sections" className="lg:hidden">
      <ul className="flex gap-1 rounded-xl bg-surface-inset p-1">
        <li className="flex flex-1">
          <a href="#upcoming" className={link}>
            Upcoming
          </a>
        </li>
        <li className="flex flex-1">
          <a href="#items" className={link}>
            Items
          </a>
        </li>
      </ul>
    </nav>
  );
}

export default async function RecurringPage() {
  // "Looks recurring" reads all purchases; the rest of the screen uses the plan's rows.
  const [plan, kit, spending] = await Promise.all([
    loadPlan(),
    loadEntryKit(),
    getSpendingLedger(),
  ]);
  const { commitments, templates, ledger, today, money, result, settings } = plan;

  const horizon = result.inputs.horizonEndDate ?? addDays(today, LOOK_AHEAD_DAYS);
  const lookAhead = addDays(today, LOOK_AHEAD_DAYS);
  const due = dueItems({
    commitments,
    templates,
    ledger,
    today,
    until: horizon > lookAhead ? horizon : lookAhead,
    countedIds: result.inputs.commitmentIds,
  });
  const occurred = occurredItems(commitments, templates, ledger, 8);
  const active = templates.filter((t) => !t.archivedAt);
  const skipped = commitments.filter(
    (c) => c.recurringTemplateId && c.cancelledAt && c.dueDate >= addDays(today, -31),
  );
  const named = new Set(active.map((t) => t.title.toLowerCase()));
  const signals = recurringSignals(mergeLedger(ledger, spending), today, settings)
    .filter((s) => s.cadence !== "regular" && !named.has(s.label.toLowerCase()))
    .slice(0, 3);
  const empty = due.length === 0 && active.length === 0 && occurred.length === 0;

  const signalSection = signals.length > 0 && (
    <Section
      title="These look regular"
      meta="From what you’ve already recorded."
      data-testid="recurring-signals"
    >
      <ul className="flex flex-col divide-y divide-(--section-divider)">
        {signals.map((signal) => (
          <li key={signal.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            <span className="min-w-0 flex-1 basis-48 type-body">
              {signal.label}: about <span className="money">{money(signal.typicalPaise)}</span>{" "}
              {signal.cadence === "weekly" ? "a week" : "a month"}{" "}
              <span className="text-text-secondary">
                (<span className="money">{signal.count}</span> times so far)
              </span>
            </span>
            <RecurringFormDialog
              kit={kit}
              template={{
                title: signal.label,
                amountPaise: signal.typicalPaise,
                cadence: signal.cadence === "weekly" ? "weekly" : "monthly",
                nextDueDate: addDays(signal.lastDate, signal.everyDays),
              }}
              trigger={
                <Button variant="outline" size="sm">
                  Make recurring
                </Button>
              }
            />
          </li>
        ))}
      </ul>
    </Section>
  );

  const [next, ...upcoming] = due.slice(0, 40);

  return (
    <>
      <PageHeader
        title="Income & recurring"
        description="What’s expected, kept apart from what actually happened."
        actions={
          empty ? undefined : (
            <>
              <BillFormDialog kit={kit} />
              <RecurringFormDialog kit={kit} />
            </>
          )
        }
        tabs="plan"
      />

      {empty ? (
        <>
          <EmptyHero
            label="Next due"
            title="Nothing recurring yet"
            description="Add income or a regular bill so Safe to Spend can plan around it."
            actions={
              <>
                <RecurringFormDialog kit={kit} />
                <BillFormDialog kit={kit} />
              </>
            }
          />
          {signalSection}
        </>
      ) : (
        <div className="grid gap-section lg:grid-cols-12 lg:items-start lg:gap-x-12">
          <div className="flex min-w-0 flex-col gap-section lg:col-span-7">
            <section
              id="upcoming"
              aria-labelledby="due-heading"
              className="flex scroll-mt-20 flex-col gap-3"
            >
              <div className="relative flex items-center gap-1">
                <p id="due-heading" className="type-label text-text-secondary">
                  {next ? "Next due" : "Due and upcoming"}
                </p>
                <InfoTip label="About scheduled items">
                  <p>
                    Scheduled and Reminder items aren’t in your balance. Expected income never
                    counts until you record it.
                  </p>
                  <p>
                    Paying something means one real entry, and it leaves the upcoming list in that
                    same save.
                  </p>
                </InfoTip>
              </div>
              {next ? (
                <DueItemCard item={next} kit={kit} money={money} lead />
              ) : (
                <div className="flex flex-col gap-0.5">
                  <h2 className="type-title">Nothing due</h2>
                  <p className="type-body text-text-secondary">
                    Nothing due in the next {LOOK_AHEAD_DAYS} days.
                  </p>
                </div>
              )}
            </section>

            <SectionJump />

            {upcoming.length > 0 && (
              <Section
                title="Upcoming"
                meta={
                  <>
                    The next <span className="money">{LOOK_AHEAD_DAYS}</span> days. Planned, not in
                    your balance yet.
                  </>
                }
              >
                <ul
                  className="flex flex-col divide-y divide-(--section-divider)"
                  data-testid="due-list"
                >
                  {upcoming.map((item) => (
                    <li key={item.key} className="min-w-0">
                      <DueItemCard item={item} kit={kit} money={money} />
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {occurred.length > 0 && (
              <Section
                title="Actually happened"
                meta="Recorded entries. Open one to see or change it."
              >
                <ul
                  className="flex flex-col divide-y divide-(--section-divider)"
                  data-testid="occurred-list"
                >
                  {occurred.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={`/transactions/${item.transactionId}`}
                        className="-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-lg px-2 type-body transition-colors duration-(--duration-quick) outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:min-h-11"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{item.title}</span>
                          <Badge variant="positive">Recorded</Badge>
                        </span>
                        <span
                          className={
                            item.kind === "income"
                              ? "shrink-0 text-money-positive money"
                              : "shrink-0 money"
                          }
                        >
                          {money(item.amountPaise)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-section lg:col-span-5">
            <Section
              id="items"
              title="Recurring items"
              meta="Scheduled, not booked. Nothing counts until you confirm it."
              className="scroll-mt-20 lg:border-t-0 lg:pt-0"
            >
              {active.length === 0 ? (
                <div className="flex flex-col gap-0.5">
                  <p className="type-body font-medium">No recurring items</p>
                  <p className="type-caption text-text-secondary">
                    Use Add recurring above for an allowance, rent or a subscription.
                  </p>
                </div>
              ) : (
                <ul className="-my-3 flex flex-col divide-y divide-(--section-divider)">
                  {active.map((t) => (
                    <li key={t.id} className="min-w-0">
                      <RecurringTemplateCard template={t} kit={kit} today={today} money={money} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {signalSection}

            {skipped.length > 0 && (
              <Section title="Skipped" meta="From the last month.">
                <ul className="flex flex-col divide-y divide-(--section-divider)">
                  {skipped.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1 type-body text-text-secondary">
                        {c.title} · {formatLocalDate(c.dueDate)}
                      </span>
                      <InlineAction
                        action={unskipOccurrence}
                        fields={{
                          templateId: c.recurringTemplateId!,
                          occurrence: c.recurringOccurrence!,
                        }}
                        pendingLabel="Restoring…"
                      >
                        Bring back
                      </InlineAction>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
