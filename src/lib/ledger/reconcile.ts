/**
 * Balance checks in the mutation layer. A check is its own operation, not a `LedgerCommand`:
 * it must never be queued offline, because the correction depends on the recorded balance, which
 * a device that has been offline can have wrong. Keeping it out of the command union means the
 * offline queue and `/api/sync` can't accept one at all. Its Undo is an ordinary command (delete
 * the correction), which can be queued like any other.
 *
 * The client sends what it showed: the stated balance and the difference. The database works the
 * recorded balance out again and answers `stale` with fresh figures if they differ.
 */
import { z } from "zod";

import { type Reconciliation, correctionFor, isoDateTimeSchema } from "@/domain";
import { type DbError, dbErrorMessage } from "@/lib/data/errors";
import { rowToReconciliation } from "@/lib/data/mappers";
import type { LedgerCommand } from "@/lib/ledger/commands";
import type { LedgerPort } from "@/lib/ledger/executor";

const signedPaise = z.number().int().min(-999_999_999_999).max(999_999_999_999);

export const balanceCheckSchema = z.object({
  checkId: z.uuid(),
  accountId: z.uuid(),
  asOf: isoDateTimeSchema,
  statedBalancePaise: signedPaise,
  /** The difference the screen showed (stated − recorded). */
  seenDifferencePaise: signedPaise,
  /** Settle the difference with one correction, with this client id. */
  correctionId: z.uuid().nullable(),
  note: z.string().trim().max(200).nullable().default(null),
});
export type BalanceCheck = z.output<typeof balanceCheckSchema>;

export type BalanceCheckOutcome =
  | {
      ok: true;
      status: "applied" | "duplicate";
      check: Reconciliation;
      /** Deletes the correction; null when there wasn't one. */
      undo: LedgerCommand | null;
    }
  | {
      ok: false;
      status: "stale";
      message: string;
      recordedBalancePaise: number;
      differencePaise: number;
    }
  | { ok: false; status: "conflict" | "not_found" | "rejected"; message: string };

const STALE = "Your records changed since you checked. Here are the current figures.";

export function toReconcileCall(input: BalanceCheck) {
  const correction = input.correctionId ? correctionFor(input.seenDifferencePaise) : null;
  return {
    fn: "record_reconciliation" as const,
    args: {
      p_check: {
        id: input.checkId,
        account_id: input.accountId,
        as_of: input.asOf,
        stated_balance_paise: input.statedBalancePaise,
        seen_difference_paise: input.seenDifferencePaise,
        note: input.note,
      },
      // A correction for no difference can't be right; the database answers `stale` for it.
      p_correction: input.correctionId
        ? {
            id: input.correctionId,
            type: correction?.type ?? "adjustment_in",
            amount_paise: correction?.amountPaise ?? 0,
          }
        : null,
    },
  };
}

function rejected(error: DbError): BalanceCheckOutcome {
  return { ok: false, status: "rejected", message: `${dbErrorMessage(error)} Nothing was saved.` };
}

export async function runBalanceCheckWith(
  port: LedgerPort,
  input: BalanceCheck,
  newOpId: () => string = () => crypto.randomUUID(),
): Promise<BalanceCheckOutcome> {
  const { data, error } = await port.call(toReconcileCall(input));
  if (error) return rejected(error);
  const result = data as {
    status: string;
    check?: Record<string, unknown>;
    recorded_balance_paise?: string;
    difference_paise?: string;
  };
  switch (result.status) {
    case "applied":
    case "duplicate": {
      const check = rowToReconciliation(result.check!);
      return {
        ok: true,
        status: result.status,
        check,
        undo: check.correctionId
          ? { kind: "delete", opId: newOpId(), id: check.correctionId }
          : null,
      };
    }
    case "stale":
      return {
        ok: false,
        status: "stale",
        message: STALE,
        recordedBalancePaise: Number(result.recorded_balance_paise),
        differencePaise: Number(result.difference_paise),
      };
    case "not_found":
      return { ok: false, status: "not_found", message: "That account doesn’t exist any more." };
    default:
      return {
        ok: false,
        status: "conflict",
        message: "This check was already saved with other figures. Reload and check again.",
      };
  }
}
