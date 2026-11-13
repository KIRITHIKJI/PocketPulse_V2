import { ledgerCommandSchema } from "@/lib/ledger/commands";
import { type LedgerPort } from "@/lib/ledger/executor";
import { balanceCheckSchema, runBalanceCheckWith, toReconcileCall } from "@/lib/ledger/reconcile";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const input = (over: Partial<Record<string, unknown>> = {}) =>
  balanceCheckSchema.parse({
    checkId: id(1),
    accountId: id(2),
    asOf: "2026-11-10T09:00:00+05:30",
    statedBalancePaise: 104_000,
    seenDifferencePaise: 4_000,
    correctionId: id(3),
    ...over,
  });

const checkRow = (status: string, correction: string | null) => ({
  id: id(1),
  owner_id: id(9),
  account_id: id(2),
  as_of: "2026-11-10T03:30:00+00:00",
  stated_balance_paise: 104_000,
  recorded_balance_paise: 100_000,
  difference_paise: 4_000,
  correction_id: correction,
  status,
  note: null,
  created_at: "2026-11-10T03:30:01+00:00",
});

const port = (data: unknown): LedgerPort & { calls: unknown[] } => {
  const calls: unknown[] = [];
  return {
    calls,
    async readRow() {
      return { row: null, error: null };
    },
    async call(call) {
      calls.push(call);
      return { data, error: null };
    },
  };
};

describe("balance checks in the mutation layer", () => {
  it("can't be a queued ledger command: the queue and /api/sync only take LedgerCommands", () => {
    const asCommand = ledgerCommandSchema.safeParse({ kind: "reconcile", opId: id(4), ...input() });
    expect(asCommand.success).toBe(false);
  });

  it("sends what the screen showed; the correction is the difference, in its direction", () => {
    expect(toReconcileCall(input())).toEqual({
      fn: "record_reconciliation",
      args: {
        p_check: {
          id: id(1),
          account_id: id(2),
          as_of: "2026-11-10T09:00:00+05:30",
          stated_balance_paise: 104_000,
          seen_difference_paise: 4_000,
          note: null,
        },
        p_correction: { id: id(3), type: "adjustment_in", amount_paise: 4_000 },
      },
    });
    const out = toReconcileCall(input({ seenDifferencePaise: -2_500, statedBalancePaise: 97_500 }));
    expect(out.args.p_correction).toEqual({
      id: id(3),
      type: "adjustment_out",
      amount_paise: 2_500,
    });
    expect(toReconcileCall(input({ correctionId: null })).args.p_correction).toBeNull();
  });

  it("offers Undo as an ordinary delete of the correction", async () => {
    const outcome = await runBalanceCheckWith(
      port({ status: "applied", check: checkRow("corrected", id(3)) }),
      input(),
      () => id(5),
    );
    expect(outcome).toMatchObject({
      ok: true,
      status: "applied",
      check: { status: "corrected", differencePaise: 4_000 },
      undo: { kind: "delete", opId: id(5), id: id(3) },
    });
    const matched = await runBalanceCheckWith(
      port({
        status: "duplicate",
        check: { ...checkRow("matched", null), difference_paise: 0, stated_balance_paise: 100_000 },
      }),
      input({ correctionId: null, seenDifferencePaise: 0, statedBalancePaise: 100_000 }),
    );
    expect(matched).toMatchObject({ ok: true, status: "duplicate", undo: null });
  });

  it("passes the database's fresh figures back when the screen's were out of date", async () => {
    const outcome = await runBalanceCheckWith(
      port({ status: "stale", recorded_balance_paise: "99000", difference_paise: "5000" }),
      input(),
    );
    expect(outcome).toEqual({
      ok: false,
      status: "stale",
      message: expect.stringMatching(/changed since you checked/),
      recordedBalancePaise: 99_000,
      differencePaise: 5_000,
    });
  });

  it("says nothing was saved when the database refuses", async () => {
    const failing: LedgerPort = {
      async readRow() {
        return { row: null, error: null };
      },
      async call() {
        return { data: null, error: { code: "P0001", message: "account_not_tracked" } };
      },
    };
    const outcome = await runBalanceCheckWith(failing, input());
    expect(outcome).toMatchObject({ ok: false, status: "rejected" });
    expect(outcome.ok === false && outcome.message).toMatch(/Nothing was saved/);
  });
});
