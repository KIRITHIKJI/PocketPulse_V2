import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArchiveRestore, ChevronRight, Star } from "lucide-react";

import { AccountFormDialog } from "@/components/accounts/account-form";
import { ConfirmAction, InlineAction } from "@/components/forms/inline-action";
import { Notice } from "@/components/feedback/notice";
import { PageHeader } from "@/components/layout/page-header";
import { Hero, InfoTip, Section } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type AccountBalance,
  balanceWording,
  enteredBalanceLabel,
  enteredFromBalance,
  holdsDebt,
  isLoanKind,
  moneyFormatter,
  netPositionParts,
  toLocalDate,
} from "@/domain";
import { makeDefaultAccount, setAccountArchived } from "@/lib/actions/accounts";
import {
  type AccountRecord,
  getAccountsWithDefault,
  getProfile,
  getWalletBalances,
  readWalletBalances,
} from "@/lib/data/queries";
import { requestNow } from "@/lib/data/session";
import { isoInstant } from "@/lib/data/slices";
import { formatLocalDate } from "@/lib/format";
import { entriesBeforeOpeningText } from "@/lib/opening-note";
import { ACCOUNT_KIND_LABELS } from "@/lib/validation/accounts";

export const metadata: Metadata = { title: "Accounts" };

/** Wallets, then cards, then loans: each kind of account reads differently. */
function groupOf(account: AccountRecord) {
  if (account.kind === "credit_card") return "cards";
  return isLoanKind(account.kind) ? "loans" : "wallets";
}

const GROUPS = [
  { key: "wallets", title: "Wallets" },
  { key: "cards", title: "Cards" },
  { key: "loans", title: "Loans" },
] as const;

/**
 * Accounts (doc/DESIGN_PLAN.md, V2 Phase 3F): the net tracked total leads, with what is in
 * wallets, what you owe and what is owed to you under it. Wallets, cards and loans follow as
 * grouped rows; archived accounts fold away at the end.
 */
export default async function AccountsPage() {
  // Every user has a default wallet to preselect, even one who skipped onboarding.
  const now = requestNow();
  const [profile, { accounts }, read] = await Promise.all([
    getProfile(),
    getAccountsWithDefault(),
    getWalletBalances(isoInstant(now)),
  ]);
  // Only when the default wallet was created just now can the balances have missed it.
  const balances = accounts.every((a) => read.closing.accounts.some((b) => b.accountId === a.id))
    ? read
    : await readWalletBalances(isoInstant(now));
  const today = toLocalDate(now, profile.timeZone);
  // Archived wallets still count: their money and history are still in the ledger.
  const total = balances.closing;
  const position = netPositionParts(accounts, total.accounts);
  const balanceOf = new Map(total.accounts.map((b) => [b.accountId, b]));
  const active = accounts.filter((a) => !a.archivedAt);
  const archived = accounts.filter((a) => a.archivedAt);
  const money = moneyFormatter(profile.currency);
  const untracked = total.untrackedAccountIds.length;

  const row = (account: AccountRecord) => (
    <AccountRow
      key={account.id}
      account={account}
      balance={balanceOf.get(account.id)}
      beforeOpening={balances.entriesBeforeOpening.get(account.id) ?? 0}
      money={money}
      today={today}
    />
  );

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Where your money is, and what you owe or are owed."
        actions={<AccountFormDialog today={today} />}
        tabs="manage"
      />

      <Hero
        aria-label="Net tracked total"
        className="relative"
        label={
          <span className="flex items-center gap-2">
            Net tracked total · all accounts · now
            <InfoTip label="About this total">
              <p>
                Opening balances plus the entries you’ve recorded. It isn’t a bank balance and isn’t
                verified with any bank.
              </p>
              <p>Archived accounts still count: their money and history are still yours.</p>
            </InfoTip>
          </span>
        }
        value={<span data-testid="accounts-total">{money(total.balancePaise)}</span>}
        meta={
          <>
            {position ? (
              // Each part stays whole; a narrow screen breaks the line between them.
              <span className="money" data-testid="accounts-net-position">
                <span className="whitespace-nowrap">
                  In wallets {money(position.inWalletsPaise)}
                </span>
                {" · "}
                <span className="whitespace-nowrap">You owe {money(position.youOwePaise)}</span>
                {" · "}
                <span className="whitespace-nowrap">
                  Owed to you {money(position.owedToYouPaise)}
                </span>
              </span>
            ) : null}
            {untracked > 0 ? (
              <span className="block">
                {untracked} account{untracked === 1 ? " starts" : "s start"} tracking on a later
                date and isn’t counted yet.
              </span>
            ) : null}
          </>
        }
      />

      {GROUPS.map(({ key, title }) => {
        const members = active.filter((a) => groupOf(a) === key);
        if (key !== "wallets" && members.length === 0) return null;
        return (
          <Section
            key={key}
            title={title}
            meta={
              key === "wallets" && members.length <= 1
                ? "Add one for each place you keep money: UPI, bank, cash."
                : undefined
            }
          >
            <ul className="flex flex-col divide-y divide-(--section-divider)">
              {members.map(row)}
            </ul>
          </Section>
        );
      })}

      {archived.length > 0 && (
        <section aria-label="Archived" className="border-t border-(--section-divider) pt-section">
          <details className="group">
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-lg type-heading outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                className="size-4 text-text-secondary transition-transform duration-(--duration-quick) group-open:rotate-90"
                aria-hidden="true"
              />
              Archived ({archived.length})
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <p className="type-caption text-text-secondary">
                Hidden from entry forms. They still count toward your total.
              </p>
              <ul className="flex flex-col divide-y divide-(--section-divider)">
                {archived.map(row)}
              </ul>
            </div>
          </details>
        </section>
      )}
    </>
  );
}

/** One account as a row: name and kind, its balance in words, then its few actions. */
function AccountRow({
  account,
  balance,
  beforeOpening,
  money,
  today,
}: {
  account: AccountRecord;
  balance: AccountBalance | undefined;
  beforeOpening: number;
  money: (paise: number) => string;
  today: string;
}) {
  const tracked = balance?.tracked && balance.balancePaise !== null;
  return (
    <li
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-4"
      data-testid={`wallet-${account.name}`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 truncate type-body font-medium">
            <Link
              href={`/accounts/${account.id}`}
              className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {account.name}
            </Link>
          </h3>
          {account.isDefault && (
            <Badge variant="outline">
              <Star aria-hidden="true" />
              Default
            </Badge>
          )}
          {account.archivedAt && <Badge variant="outline">Archived</Badge>}
        </div>
        <p className="type-caption text-text-secondary">
          {ACCOUNT_KIND_LABELS[account.kind]} ·{" "}
          {holdsDebt(account.kind)
            ? `${enteredBalanceLabel(account.kind).toLowerCase()} at the start`
            : "opening balance"}{" "}
          <span className="money">
            {money(enteredFromBalance(account.kind, account.openingBalancePaise))}
          </span>{" "}
          on {formatLocalDate(account.openingBalanceDate)}
        </p>
      </div>
      <div className="text-right">
        {tracked ? (
          <p className="type-heading money">
            {holdsDebt(account.kind)
              ? balanceWording(account, balance!.balancePaise!, money)
              : money(balance!.balancePaise!)}
          </p>
        ) : (
          <p className="type-body text-text-secondary">
            Starts {formatLocalDate(account.openingBalanceDate)}
          </p>
        )}
      </div>
      {beforeOpening > 0 && (
        <Notice tone="warning" className="col-span-2 mt-1">
          {entriesBeforeOpeningText(beforeOpening)}
        </Notice>
      )}
      <div className="col-span-2 -ml-2 flex flex-wrap items-center gap-1">
        <AccountFormDialog account={account} today={today} />
        {!account.archivedAt && !account.isDefault && !isLoanKind(account.kind) && (
          <InlineAction
            action={makeDefaultAccount}
            fields={{ id: account.id }}
            pendingLabel="Saving…"
            aria-label={`Make default: ${account.name}`}
          >
            <Star aria-hidden="true" />
            Make default
          </InlineAction>
        )}
        {!account.archivedAt && !account.isDefault && (
          <ConfirmAction
            action={setAccountArchived}
            fields={{ id: account.id, archive: "true" }}
            trigger={
              <Button variant="ghost" size="sm">
                <Archive aria-hidden="true" />
                Archive
              </Button>
            }
            title={`Archive ${account.name}?`}
            description={
              <>
                <p>It disappears from entry forms. Nothing is deleted.</p>
                <p>
                  Its entries stay in your history and its balance
                  {tracked ? ` (${money(balance!.balancePaise!)})` : ""} still counts toward your
                  total. If it’s empty in real life but shows money here, record what happened to
                  that money first.
                </p>
              </>
            }
            confirmLabel="Archive"
            pendingLabel="Archiving…"
          />
        )}
        {account.archivedAt && (
          <InlineAction
            action={setAccountArchived}
            fields={{ id: account.id, archive: "false" }}
            pendingLabel="Restoring…"
          >
            <ArchiveRestore aria-hidden="true" />
            Restore
          </InlineAction>
        )}
        {account.isDefault && (
          <p className="px-2 type-caption text-text-secondary">
            Preselected in entry forms. Make another the default to archive this one.
          </p>
        )}
      </div>
    </li>
  );
}
