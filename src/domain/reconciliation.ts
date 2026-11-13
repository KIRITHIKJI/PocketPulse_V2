/**
 * Balance checks (reconciliation). The user types what their bank, UPI app or wallet really
 * shows; the recorded balance at that instant comes from the same balance rule as everything else
 * (`wallet_balances` in the database, `accountBalanceAt` here). The difference is either found
 * (a missing or doubled entry) or settled by one correction for exactly that amount, dated at the
 * check. A correction is never income or spending; deleting it reopens the check.
 */
import { z } from "zod";

import { accountDelta, isBeforeOpeningDate } from "./balances";
import { isActive, occurredAtMs } from "./ledger";
import { type Paise, subtractPaise } from "./money";
import {
  type Account,
  type Transaction,
  type TransactionType,
  isoDateTimeSchema,
  isAdjustment,
} from "./schemas";
import { DEFAULT_TIMEZONE, type Instant, toLocalDate } from "./time";

export const RECONCILIATION_STATUSES = ["matched", "corrected", "open"] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

const signedPaise = z.number().int().min(-999_999_999_999).max(999_999_999_999);

export const reconciliationSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  accountId: z.uuid(),
  asOf: isoDateTimeSchema,
  statedBalancePaise: signedPaise,
  recordedBalancePaise: signedPaise,
  /** stated − recorded: positive means more money than recorded. */
  differencePaise: signedPaise,
  correctionId: z.uuid().nullable().default(null),
  status: z.enum(RECONCILIATION_STATUSES),
  note: z.string().max(200).nullable().default(null),
  createdAt: isoDateTimeSchema,
});
export type Reconciliation = z.output<typeof reconciliationSchema>;

/** The one correction that settles a difference; null when there's nothing to settle. */
export function correctionFor(differencePaise: Paise): {
  type: Extract<TransactionType, "adjustment_in" | "adjustment_out">;
  amountPaise: Paise;
} | null {
  if (differencePaise === 0) return null;
  return differencePaise > 0
    ? { type: "adjustment_in", amountPaise: differencePaise }
    : { type: "adjustment_out", amountPaise: subtractPaise(0, differencePaise) };
}

export type HintKind =
  "same_amount_elsewhere" | "same_day_twice" | "before_opening" | "reversed_transfer";

export interface ReconciliationHint {
  kind: HintKind;
  message: string;
  transactionIds: string[];
}

interface HintInput {
  account: Account;
  accounts: readonly Account[];
  ledger: readonly Transaction[];
  differencePaise: Paise;
  /** Only entries after the last check (or since tracking began) are looked at. */
  sinceMs: Instant | null;
  untilMs: Instant;
  timeZone?: string;
}

/**
 * Deterministic places a difference often comes from, most specific first. They only point:
 * the user looks, fixes what's wrong, and checks again.
 */
export function reconciliationHints(input: HintInput): ReconciliationHint[] {
  const { account, differencePaise } = input;
  const tz = input.timeZone ?? DEFAULT_TIMEZONE;
  if (differencePaise === 0) return [];
  const gap = Math.abs(differencePaise);
  const names = new Map(input.accounts.map((a) => [a.id, a.name]));
  const inWindow = (tx: Transaction) => {
    const at = occurredAtMs(tx);
    return (
      isActive(tx) &&
      !isAdjustment(tx) &&
      (input.sinceMs === null || at >= input.sinceMs) &&
      at < input.untilMs
    );
  };
  const recent = input.ledger.filter(inWindow);
  const hints: ReconciliationHint[] = [];

  // Recorded on another account by mistake.
  const elsewhere = recent.filter(
    (tx) =>
      tx.amountPaise === gap &&
      "accountId" in tx &&
      tx.accountId !== account.id &&
      (tx.type === "expense" || tx.type === "income" || tx.type === "refund"),
  );
  if (elsewhere.length > 0) {
    const tx = elsewhere[0]!;
    const other = "accountId" in tx ? (names.get(tx.accountId) ?? "another account") : "";
    hints.push({
      kind: "same_amount_elsewhere",
      message: `An entry of exactly this amount is on ${other}. Was it meant for ${account.name}?`,
      transactionIds: elsewhere.map((t) => t.id),
    });
  }

  // The same entry saved twice on one day (it would make the recorded balance off by one copy).
  const seen = new Map<string, Transaction>();
  const twice: string[] = [];
  for (const tx of recent) {
    if (accountDelta(tx, account.id) === 0 || tx.type === "transfer") continue;
    const key = [
      tx.type,
      tx.amountPaise,
      toLocalDate(occurredAtMs(tx), tz),
      tx.description ?? "",
      tx.merchant ?? "",
    ].join("|");
    const first = seen.get(key);
    if (first && tx.amountPaise === gap) twice.push(first.id, tx.id);
    else seen.set(key, tx);
  }
  if (twice.length > 0) {
    hints.push({
      kind: "same_day_twice",
      message: "Two identical entries on the same day. Is one of them a duplicate?",
      transactionIds: [...new Set(twice)],
    });
  }

  // Dated before the opening date: real, but not in the recorded balance.
  const early = input.ledger.filter(
    (tx) =>
      isActive(tx) &&
      accountDelta(tx, account.id) !== 0 &&
      isBeforeOpeningDate(account, occurredAtMs(tx), tz),
  );
  if (early.length > 0) {
    hints.push({
      kind: "before_opening",
      message: `${early.length === 1 ? "An entry is" : `${early.length} entries are`} dated before ${account.name}'s opening date, so ${early.length === 1 ? "it doesn't" : "they don't"} change its balance.`,
      transactionIds: early.map((t) => t.id),
    });
  }

  // A transfer recorded the wrong way round is off by twice its amount.
  const reversed = recent.filter(
    (tx) =>
      tx.type === "transfer" &&
      tx.amountPaise * 2 === gap &&
      (tx.fromAccountId === account.id || tx.toAccountId === account.id),
  );
  if (reversed.length > 0) {
    hints.push({
      kind: "reversed_transfer",
      message:
        "A transfer of half the difference involves this account. Is it the wrong way round?",
      transactionIds: reversed.map((t) => t.id),
    });
  }
  return hints;
}

/** The newest check on an account, if any (checks arrive newest first or in any order). */
export function latestCheck(
  checks: readonly Reconciliation[],
  accountId: string,
): Reconciliation | null {
  let latest: Reconciliation | null = null;
  for (const check of checks) {
    if (check.accountId !== accountId) continue;
    if (!latest || Date.parse(check.asOf) > Date.parse(latest.asOf)) latest = check;
  }
  return latest;
}
