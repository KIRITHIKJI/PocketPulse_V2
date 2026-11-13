"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type ReconciliationHint,
  balanceFromEntered,
  correctionFor,
  instantFromLocalDateTime,
  isLocalDate,
  isLocalTime,
  latestCheck,
  parseSignedAmountInput,
  reconciliationHints,
  toLocalDate,
  trackingStartMs,
} from "@/domain";
import { DataLoadError } from "@/lib/data/errors";
import {
  getAccountEntries,
  getAccounts,
  getEntriesBetween,
  getProfile,
  getReconciliations,
  readWalletBalances,
} from "@/lib/data/queries";
import { requireSession } from "@/lib/data/session";
import { executeBalanceCheck } from "@/lib/ledger/execute";
import type { LedgerCommand } from "@/lib/ledger/commands";
import { balanceCheckSchema } from "@/lib/ledger/reconcile";

export type Comparison =
  | {
      ok: true;
      asOf: string;
      statedBalancePaise: number;
      recordedBalancePaise: number;
      differencePaise: number;
      correction: { type: "adjustment_in" | "adjustment_out"; amountPaise: number } | null;
      hints: ReconciliationHint[];
      /** History of this account since the last check, for "Find it". */
      findHref: string;
      /** The check is dated before now, so it changes past balances and reports. */
      inPast: boolean;
    }
  | { ok: false; message: string; field?: "amount" | "when" };

const compareSchema = z.object({
  accountId: z.uuid(),
  amount: z.string(),
  date: z.string(),
  time: z.string(),
  /** The date and time weren't changed: the check is for this very moment. */
  atNow: z.boolean().default(false),
});

/** How long ago still counts as "now" (the moment the form was opened). */
const NOW_WINDOW_MS = 10 * 60_000;

/**
 * Step one of a check: what the records say at that moment and the difference from what the user
 * typed. A read only; nothing is saved. Needs a connection, like saving does.
 */
export async function compareBalance(input: unknown): Promise<Comparison> {
  const parsed = compareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That check isn’t valid." };
  const { accountId, amount, date, time, atNow } = parsed.data;
  const typed = parseSignedAmountInput(amount);
  if (!typed.ok) return { ok: false, message: typed.message, field: "amount" };
  try {
    const [profile, accounts] = await Promise.all([getProfile(), getAccounts()]);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, message: "That account doesn’t exist any more." };
    if (!atNow && (!isLocalDate(date) || !isLocalTime(time))) {
      return { ok: false, message: "Choose a valid date and time.", field: "when" };
    }
    const now = Date.now();
    // A time typed to the minute would miss entries saved earlier in that minute; "now" doesn't.
    const asOfMs = atNow
      ? now
      : Math.min(instantFromLocalDateTime(date, time, profile.timeZone), now);
    if (asOfMs < trackingStartMs(account, profile.timeZone)) {
      return {
        ok: false,
        field: "when",
        message: "That’s before this account’s opening date. Choose a later time.",
      };
    }
    const asOf = new Date(asOfMs).toISOString();
    const balances = await readWalletBalances(asOf);
    const recorded = balances.closing.accounts.find((b) => b.accountId === accountId)?.balancePaise;
    if (recorded === null || recorded === undefined) {
      return { ok: false, message: "This account isn’t tracked at that time.", field: "when" };
    }
    const stated = balanceFromEntered(account.kind, typed.paise);
    const difference = stated - recorded;

    // Hints look at what happened since the last check (or since tracking began).
    const last = latestCheck(
      (await getReconciliations(accountId)).filter((c) => Date.parse(c.asOf) < asOfMs),
      accountId,
    );
    const sinceMs = last ? Date.parse(last.asOf) : trackingStartMs(account, profile.timeZone);
    const since = new Date(sinceMs).toISOString();
    const [window, early] = await Promise.all([
      difference === 0 ? Promise.resolve([]) : getEntriesBetween(since, asOf),
      difference === 0
        ? Promise.resolve([])
        : getAccountEntries(
            accountId,
            null,
            new Date(trackingStartMs(account, profile.timeZone)).toISOString(),
          ),
    ]);
    const hints = reconciliationHints({
      account,
      accounts,
      ledger: [...window, ...early],
      differencePaise: difference,
      sinceMs,
      untilMs: asOfMs + 1,
      timeZone: profile.timeZone,
    });
    const params = new URLSearchParams({
      account: accountId,
      from: toLocalDate(sinceMs, profile.timeZone),
      to: toLocalDate(asOfMs, profile.timeZone),
    });
    return {
      ok: true,
      asOf,
      statedBalancePaise: stated,
      recordedBalancePaise: recorded,
      differencePaise: difference,
      correction: correctionFor(difference),
      hints,
      findHref: `/transactions?${params}`,
      inPast: now - asOfMs > NOW_WINDOW_MS,
    };
  } catch (error) {
    if (error instanceof DataLoadError) return { ok: false, message: error.message };
    throw error;
  }
}

export type SaveCheckResult =
  | { ok: true; status: "applied" | "duplicate"; checkStatus: string; undo: LedgerCommand | null }
  | {
      ok: false;
      status: "stale";
      message: string;
      recordedBalancePaise: number;
      differencePaise: number;
    }
  | { ok: false; status: "conflict" | "not_found" | "rejected" | "invalid"; message: string };

/** Step two: save the check, and its correction if the user chose one. Never queued. */
export async function saveBalanceCheck(input: unknown): Promise<SaveCheckResult> {
  const parsed = balanceCheckSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: "invalid", message: "That check isn’t valid." };
  const { supabase } = await requireSession();
  const outcome = await executeBalanceCheck(supabase, parsed.data);
  if (!outcome.ok) return outcome;
  revalidatePath("/", "layout");
  return {
    ok: true,
    status: outcome.status,
    checkStatus: outcome.check.status,
    undo: outcome.undo,
  };
}
