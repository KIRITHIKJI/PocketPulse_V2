import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CheckBalance, LoanEndAction, TransferAction } from "@/components/accounts/account-actions";
import { PageHeader } from "@/components/layout/page-header";
import { DataList, DataRow, Section } from "@/components/layout/primitives";
import { FigureRow, PlanNote } from "@/components/plan/parts";
import { Button } from "@/components/ui/button";
import {
  balanceWording,
  cardFigures,
  enteredBalanceLabel,
  holdsDebt,
  isSpendingAccount,
  maxPaise,
  moneyFormatter,
  subtractPaise,
  toLocalDate,
  toLocalTime,
} from "@/domain";
import {
  getAccountEntries,
  getAccounts,
  getCategories,
  getProfile,
  getReconciliations,
  readWalletBalances,
} from "@/lib/data/queries";
import { requestNow } from "@/lib/data/session";
import { isoInstant } from "@/lib/data/slices";
import { entryView } from "@/lib/entry-view";
import { formatDateTime, formatLocalDate } from "@/lib/format";
import { ACCOUNT_KIND_LABELS } from "@/lib/validation/accounts";

export const metadata: Metadata = { title: "Account" };

const RECENT = 20;
const STATUS_WORDS = { matched: "matched", corrected: "corrected", open: "not resolved" } as const;

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = requestNow();
  const [profile, accounts] = await Promise.all([getProfile(), getAccounts()]);
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();
  const [balances, checks, entries, categories] = await Promise.all([
    readWalletBalances(isoInstant(now)),
    getReconciliations(id),
    getAccountEntries(id, null, isoInstant(now + 1)),
    getCategories(),
  ]);
  const money = moneyFormatter(profile.currency);
  const balance = balances.closing.accounts.find((b) => b.accountId === id)?.balancePaise ?? null;
  const today = toLocalDate(now, profile.timeZone);
  const who = account.counterparty ?? account.name;
  // Wallets money comes from or goes to: everything that isn't a loan, active only.
  const wallets = accounts
    .filter((a) => a.id !== id && !a.archivedAt && isSpendingAccount(a))
    .map((a) => ({ id: a.id, name: a.name }));
  const defaultWalletId = accounts.find((a) => a.isDefault)?.id ?? wallets[0]?.id ?? "";
  const owedByYou = balance === null ? 0 : maxPaise(0, subtractPaise(0, balance));
  const owedToYou = balance === null ? 0 : maxPaise(0, balance);
  const topLevel = (name: string, kind: "expense" | "income") =>
    categories.find((c) => c.name === name && c.kind === kind && !c.parentId && !c.archivedAt)
      ?.id ?? null;
  const ctx = {
    categoriesById: new Map(categories.map((c) => [c.id, c])),
    accountsById: new Map(accounts.map((a) => [a.id, a])),
    currency: profile.currency,
  };
  const latest = checks[0] ?? null;
  const transfer = { accountId: id, wallets, defaultWalletId, currency: profile.currency };

  return (
    <>
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/accounts">
            <ArrowLeft aria-hidden="true" />
            Accounts
          </Link>
        </Button>
      </div>
      <PageHeader
        title={account.name}
        description={`${ACCOUNT_KIND_LABELS[account.kind]}${account.archivedAt ? " · archived" : ""}`}
      />

      <section aria-labelledby="account-balance-label" className="flex flex-col gap-1">
        <h2 id="account-balance-label" className="type-label text-text-secondary">
          Balance · now
        </h2>
        <p className="type-hero money" data-testid="account-balance" data-paise={balance ?? ""}>
          {balance === null
            ? `Starts ${formatLocalDate(account.openingBalanceDate)}`
            : balanceWording(account, balance, money)}
        </p>
        <p className="type-body text-text-secondary" data-testid="account-checked">
          {latest
            ? `Checked ${formatDateTime(latest.asOf, profile.timeZone)}: ${STATUS_WORDS[latest.status]}`
            : "Not checked against a real balance yet"}
        </p>
        {/* What's owed is the balance above, in words; these are the card's other figures. */}
        {account.kind === "credit_card" &&
          balance !== null &&
          (account.creditLimitPaise !== null ||
            account.statementDay !== null ||
            account.dueDay !== null) && (
            <dl className="mt-3 max-w-xl divide-y divide-(--section-divider) border-y border-(--section-divider)">
              {account.creditLimitPaise !== null && (
                <FigureRow
                  label="Available credit"
                  value={money(cardFigures(account, balance).availablePaise!)}
                  explanation={`Limit ${money(account.creditLimitPaise)} minus what’s owed.`}
                />
              )}
              {(account.statementDay !== null || account.dueDay !== null) && (
                <FigureRow
                  label="Statement day · payment due day"
                  value={`${account.statementDay ?? "—"} · ${account.dueDay ?? "—"}`}
                  explanation="Days of the month."
                />
              )}
            </dl>
          )}
        {!account.archivedAt && balance !== null && (
          <div className="mt-4 flex flex-wrap gap-2">
            {account.kind === "credit_card" && (
              <TransferAction
                {...transfer}
                label="Pay card bill"
                title={`Pay ${account.name}`}
                description="Paying the bill moves money to the card. The purchases were already spending, so this isn’t counted again."
                into
                variant="default"
                defaultAmountPaise={owedByYou}
                success={`Paid {amount} to ${account.name} from {wallet}.`}
              />
            )}
            {account.kind === "loan_borrowed" && (
              <>
                <TransferAction
                  {...transfer}
                  label="Repay"
                  title={`Repay ${who}`}
                  description="A repayment isn’t spending: it lowers what you owe."
                  into
                  variant="default"
                  defaultAmountPaise={owedByYou}
                  success={`Repaid {amount} to ${who}.`}
                  after={
                    <PlanNote>
                      Paid interest too? Record it separately as an expense in the{" "}
                      <Link href="/transactions/new" className="underline underline-offset-4">
                        full form
                      </Link>
                      .
                    </PlanNote>
                  }
                />
                <TransferAction
                  {...transfer}
                  label="Borrow more"
                  title={`Borrow more from ${who}`}
                  description="Borrowed money isn’t income: you owe it back."
                  into={false}
                  defaultAmountPaise={null}
                  success={`Borrowed {amount} into {wallet}.`}
                />
                {owedByYou > 0 && (
                  <LoanEndAction
                    accountId={id}
                    counterparty={who}
                    ending="forgiven"
                    outstandingPaise={owedByYou}
                    categoryId={topLevel("Gifts", "income")}
                    currency={profile.currency}
                  />
                )}
              </>
            )}
            {account.kind === "loan_lent" && (
              <>
                <TransferAction
                  {...transfer}
                  label="Got money back"
                  title={`Money back from ${who}`}
                  description="Getting it back isn’t income: it was already yours."
                  into={false}
                  variant="default"
                  defaultAmountPaise={owedToYou}
                  success={`Got {amount} back into {wallet}.`}
                  after={
                    <PlanNote>
                      Got interest too? Record it separately as income in the{" "}
                      <Link
                        href="/transactions/new?type=income"
                        className="underline underline-offset-4"
                      >
                        full form
                      </Link>
                      .
                    </PlanNote>
                  }
                />
                <TransferAction
                  {...transfer}
                  label="Lend more"
                  title={`Lend more to ${who}`}
                  description="Lending isn’t spending: it’s still your money, owed to you."
                  into
                  defaultAmountPaise={null}
                  success={`Lent {amount} to ${who}.`}
                />
                {owedToYou > 0 && (
                  <LoanEndAction
                    accountId={id}
                    counterparty={who}
                    ending="write_off"
                    outstandingPaise={owedToYou}
                    categoryId={topLevel("Other", "expense")}
                    currency={profile.currency}
                  />
                )}
              </>
            )}
          </div>
        )}
      </section>

      {balance !== null && (
        <Section
          title="Check balance"
          meta="Compare with what your bank, UPI app or wallet really shows."
          className="max-w-3xl"
        >
          <CheckBalance
            accountId={id}
            accountName={account.name}
            amountLabel={
              holdsDebt(account.kind) ? enteredBalanceLabel(account.kind) : "Real balance"
            }
            currency={profile.currency}
            today={today}
            nowTime={toLocalTime(now, profile.timeZone)}
          />
        </Section>
      )}

      {checks.length > 0 && (
        <Section title="Balance checks" className="max-w-3xl">
          <ul className="divide-y divide-(--section-divider)" data-testid="check-history">
            {checks.map((check) => (
              <li
                key={check.id}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2 type-body"
              >
                <span>{formatDateTime(check.asOf, profile.timeZone)}</span>
                <span className="text-text-secondary">
                  {check.differencePaise === 0
                    ? "matched"
                    : `off by ${money(Math.abs(check.differencePaise))}, ${STATUS_WORDS[check.status]}`}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Recent entries"
        className="max-w-3xl"
        action={
          <Button variant="ghost" size="sm" asChild className="-mr-2">
            <Link href={`/transactions?account=${id}`}>See all</Link>
          </Button>
        }
      >
        {entries.length === 0 ? (
          <p className="type-body text-text-secondary">Nothing recorded on this account yet.</p>
        ) : (
          <DataList data-testid="account-entries">
            {entries.slice(0, RECENT).map((tx) => {
              const view = entryView(tx, ctx);
              return (
                <DataRow
                  key={tx.id}
                  href={`/transactions/${tx.id}`}
                  title={view.title}
                  detail={`${formatDateTime(tx.occurredAt, profile.timeZone)}${view.walletLabel ? ` · ${view.walletLabel}` : ""}`}
                  value={view.amountLabel}
                />
              );
            })}
          </DataList>
        )}
      </Section>
    </>
  );
}
