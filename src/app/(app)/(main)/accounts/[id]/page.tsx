import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CheckBalance, LoanEndAction, TransferAction } from "@/components/accounts/account-actions";
import { PageHeader } from "@/components/layout/page-header";
import { FigureRow, PlanNote } from "@/components/plan/parts";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
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
            Wallets
          </Link>
        </Button>
      </div>
      <PageHeader
        title={account.name}
        description={`${ACCOUNT_KIND_LABELS[account.kind]}${account.archivedAt ? " · archived" : ""}`}
      />

      <Surface variant="hero" className="gap-1">
        <h2 className="type-body text-muted-foreground">Balance · now</h2>
        <p className="type-display money" data-testid="account-balance" data-paise={balance ?? ""}>
          {balance === null
            ? `Starts ${formatLocalDate(account.openingBalanceDate)}`
            : balanceWording(account, balance, money)}
        </p>
        <p className="type-body text-muted-foreground" data-testid="account-checked">
          {latest
            ? `Checked ${formatDateTime(latest.asOf, profile.timeZone)}: ${STATUS_WORDS[latest.status]}`
            : "Not checked against a real balance yet"}
        </p>
        {account.kind === "credit_card" && balance !== null && (
          <dl className="mt-2 divide-y">
            <FigureRow
              label="Owed on card"
              value={money(cardFigures(account, balance).owedPaise)}
              testId="card-owed"
            />
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
          <div className="mt-3 flex flex-wrap gap-2">
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
      </Surface>

      {balance !== null && (
        <Surface>
          <SurfaceHeader
            title="Check balance"
            meta="Compare with what your bank, UPI app or wallet really shows."
          />
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
        </Surface>
      )}

      {checks.length > 0 && (
        <Surface>
          <SurfaceHeader title="Balance checks" />
          <ul className="divide-y" data-testid="check-history">
            {checks.map((check) => (
              <li key={check.id} className="flex flex-wrap justify-between gap-2 py-2 type-body">
                <span>{formatDateTime(check.asOf, profile.timeZone)}</span>
                <span className="text-muted-foreground">
                  {check.differencePaise === 0
                    ? "matched"
                    : `off by ${money(Math.abs(check.differencePaise))}, ${STATUS_WORDS[check.status]}`}
                </span>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <Surface>
        <SurfaceHeader
          title="Recent entries"
          meta={
            <Link href={`/transactions?account=${id}`} className="underline underline-offset-4">
              See all
            </Link>
          }
        />
        {entries.length === 0 ? (
          <p className="type-body text-muted-foreground">Nothing recorded on this account yet.</p>
        ) : (
          <ul className="divide-y" data-testid="account-entries">
            {entries.slice(0, RECENT).map((tx) => {
              const view = entryView(tx, ctx);
              return (
                <li key={tx.id}>
                  <Link
                    href={`/transactions/${tx.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate type-body">{view.title}</span>
                      <span className="type-caption text-muted-foreground">
                        {formatDateTime(tx.occurredAt, profile.timeZone)}
                        {view.walletLabel ? ` · ${view.walletLabel}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 type-body money">{view.amountLabel}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>
    </>
  );
}
