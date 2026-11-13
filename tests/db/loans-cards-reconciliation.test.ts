import {
  type Account,
  type Transaction,
  buildReport,
  calculateSafeToSpend,
  categoryBreakdown,
  netSpending,
  periodBalanceInstants,
  reportDifferences,
  resolvePeriod,
  summarizePeriod,
} from "@/domain";
import {
  rowToAccount,
  rowToLedgerBalances,
  rowToReconciliation,
  rowToTransaction,
} from "@/lib/data/mappers";

import { runLedgerCommandWith } from "@/lib/ledger/executor";
import { runBalanceCheckWith } from "@/lib/ledger/reconcile";

import { A, A_BANK, A_CASH, B, B_CASH, type Fixtures, seedFixtures, tid } from "./fixtures";
import { ADMIN_URL, SKIP_REASON, type Session, type TestDb, as, createTestDb } from "./harness";
import { pgPort } from "./ledger-port";

// V2 Phase 2B: credit cards, loans and balance checks, on the real schema, RLS and RPCs, read
// back through the same domain functions the screens use.

const TZ = "Asia/Kolkata";
const settings = { timeZone: TZ, weekStartsOn: 1 as const };
const NOW = Date.parse("2026-11-10T12:00:00+05:30");
const AT = "2026-11-05T10:00:00+05:30";
const A_CARD = "aaaaaaaa-0000-4000-8000-0000000000a2";
const A_OWE = "aaaaaaaa-0000-4000-8000-0000000000a3";
const A_LENT = "aaaaaaaa-0000-4000-8000-0000000000a4";
const NOVEMBER = resolvePeriod({ kind: "this_month" }, NOW, settings);

type Check = {
  id: string;
  account_id: string;
  as_of: string;
  stated_balance_paise: number;
  seen_difference_paise?: number;
  note?: string;
};
type Result = {
  status: string;
  reason?: string;
  check?: Record<string, unknown>;
  correction?: Record<string, unknown> | null;
  recorded_balance_paise?: string;
  difference_paise?: string;
};

async function addAccounts(s: Session) {
  await s.q(
    `insert into public.accounts (id, name, kind, currency, opening_balance_paise, opening_balance_date, counterparty, credit_limit_paise, statement_day, due_day)
     values ($1, 'Card', 'credit_card', 'INR', 0, '2026-10-01', null, 2000000, 5, 25),
            ($2, 'Ravi', 'loan_borrowed', 'INR', 0, '2026-10-01', 'Ravi', null, null, null),
            ($3, 'Priya', 'loan_lent', 'INR', 0, '2026-10-01', 'Priya', null, null, null)`,
    [A_CARD, A_OWE, A_LENT],
  );
}

async function create(s: Session, n: number, tx: Record<string, unknown>) {
  const result = await s.rpc<{ status: string }>("create_transaction", [
    { id: tid(n), currency: "INR", occurred_at: AT, ...tx },
  ]);
  expect(result.status).toBe("applied");
}

const transfer = (s: Session, n: number, amount: number, from: string, to: string) =>
  create(s, n, {
    type: "transfer",
    amount_paise: amount,
    from_account_id: from,
    to_account_id: to,
  });

async function read(s: Session): Promise<{ accounts: Account[]; ledger: Transaction[] }> {
  return {
    accounts: (await s.q("select * from public.accounts where currency = 'INR'")).rows.map(
      rowToAccount,
    ),
    ledger: (await s.q("select * from public.transactions")).rows.map(rowToTransaction),
  };
}

async function balancesAt(s: Session, closing: string, opening: string | null = null) {
  return rowToLedgerBalances(
    await s.rpc("wallet_balances", [closing, opening]),
    Date.parse(closing),
    opening === null ? null : Date.parse(opening),
  );
}

async function balanceOf(s: Session, account: string, at = "2026-11-10T12:00:00+05:30") {
  const closing = (await balancesAt(s, at)).closing;
  return closing.accounts.find((b) => b.accountId === account)!.balancePaise!;
}

const reconcile = (s: Session, check: Check, correction: Record<string, unknown> | null = null) =>
  s.rpc<Result>("record_reconciliation", [check, correction]);

/** November's income, spending and the total balance: what a loan or a card bill mustn't move. */
async function month(s: Session) {
  const { accounts, ledger } = await read(s);
  const summary = summarizePeriod(accounts, ledger, NOVEMBER, NOW, TZ);
  return {
    income: summary.incomePaise,
    spending: netSpending(ledger, NOVEMBER),
    categories: categoryBreakdown(ledger, NOVEMBER).netPaise,
    total: (await balancesAt(s, "2026-11-10T12:00:00+05:30")).closing.balancePaise,
  };
}

describe.skipIf(!ADMIN_URL)("credit cards and loans", () => {
  let db: TestDb;
  let f: Fixtures;

  beforeAll(async () => {
    db = await createTestDb();
    f = await seedFixtures(db);
  });
  afterAll(async () => {
    await db?.close();
  });

  it("accepts the new kinds and their fields, and keeps V1 wallets valid", async () => {
    await as(db, A, async (s) => {
      await addAccounts(s);
      // A V1 card stays a (debit) card.
      expect(
        await s.error("update public.accounts set kind = 'card' where id = $1", [A_BANK]),
      ).toBe(null);
      const bad = [
        [
          "a counterparty on a wallet",
          "update public.accounts set counterparty = 'X' where id = $1",
          A_CASH,
        ],
        [
          "a limit on a loan",
          "update public.accounts set credit_limit_paise = 100 where id = $1",
          A_OWE,
        ],
        ["a due day on a wallet", "update public.accounts set due_day = 5 where id = $1", A_CASH],
        ["a due day past 28", "update public.accounts set due_day = 30 where id = $1", A_CARD],
        ["a zero limit", "update public.accounts set credit_limit_paise = 0 where id = $1", A_CARD],
        [
          "a loan as the default wallet",
          "update public.accounts set is_default = (id = $1)",
          A_OWE,
        ],
      ] as const;
      for (const [what, sql, id] of bad) {
        expect((await s.error(sql, [id]))?.code, what).toBe("23514");
      }
    });
  });

  it("borrowing and repaying move the wallet and the loan, never income or spending", async () => {
    await as(db, A, async (s) => {
      await addAccounts(s);
      const before = await month(s);
      await transfer(s, 1, 100_000, A_OWE, A_CASH); // borrowed ₹1,000 from Ravi into Cash
      expect(await balanceOf(s, A_OWE)).toBe(-100_000);
      expect(await balanceOf(s, A_CASH)).toBe(100_000 + 100_000);
      await transfer(s, 2, 40_000, A_CASH, A_OWE); // repaid ₹400
      expect(await balanceOf(s, A_OWE)).toBe(-60_000);
      await transfer(s, 3, 50_000, A_CASH, A_LENT); // lent ₹500 to Priya
      await transfer(s, 4, 20_000, A_LENT, A_CASH); // ₹200 came back
      expect(await balanceOf(s, A_LENT)).toBe(30_000);
      expect(await balanceOf(s, A_CASH)).toBe(100_000 + 100_000 - 40_000 - 50_000 + 20_000);
      // Net position, income, spending and every category: unchanged.
      expect(await month(s)).toEqual(before);
    });
  });

  it("a ₹500 card purchase and its ₹500 bill lower money and spending by ₹500 once", async () => {
    await as(db, A, async (s) => {
      await addAccounts(s);
      const before = await month(s);
      await create(s, 1, {
        type: "expense",
        amount_paise: 50_000,
        account_id: A_CARD,
        category_id: f.aFood,
      });
      const afterPurchase = await month(s);
      expect(afterPurchase.spending - before.spending).toBe(50_000);
      expect(afterPurchase.total - before.total).toBe(-50_000);
      expect(await balanceOf(s, A_CARD)).toBe(-50_000);
      await transfer(s, 2, 50_000, A_BANK, A_CARD);
      const afterBill = await month(s);
      expect(afterBill).toEqual(afterPurchase);
      expect(await balanceOf(s, A_CARD)).toBe(0);
      expect(await balanceOf(s, A_BANK)).toBe(500_000 - 50_000);
    });
  });

  it("Safe to Spend leaves out money lent until it comes back (from wallet_balances)", async () => {
    await as(db, A, async (s) => {
      await addAccounts(s);
      // ₹1,000 cash; ₹300 owed on the card; ₹200 borrowed; ₹500 lent. Bank emptied for clarity.
      await transfer(s, 1, 500_000, A_BANK, A_CASH);
      await create(s, 2, { type: "expense", amount_paise: 500_000, account_id: A_CASH });
      await create(s, 3, { type: "expense", amount_paise: 30_000, account_id: A_CARD });
      await transfer(s, 4, 20_000, A_OWE, A_CASH);
      await transfer(s, 5, 50_000, A_CASH, A_LENT);
      await create(s, 6, {
        type: "income",
        amount_paise: 30_000,
        account_id: A_CASH,
      });
      const plan = async () => {
        const { accounts, ledger } = await read(s);
        const balance = (await balancesAt(s, new Date(NOW).toISOString())).closing;
        return calculateSafeToSpend({
          accounts,
          ledger,
          balance,
          commitments: [],
          now: NOW,
          settings,
          nextIncomeDate: "2026-12-01",
        });
      };
      expect(await balanceOf(s, A_CASH)).toBe(100_000);
      let r = await plan();
      expect(r.inputs.balancePaise).toBe(100_000 - 30_000 - 20_000 + 50_000);
      expect(r.inputs.lentOutPaise).toBe(50_000);
      expect(r.flexiblePaise).toBe(50_000);
      expect(r.explanation.join(" ")).toMatch(/Money you lent \(₹500\) isn't counted/);

      await transfer(s, 7, 20_000, A_LENT, A_CASH); // Priya repays ₹200
      r = await plan();
      expect(r.inputs.balancePaise).toBe(100_000);
      expect(r.flexiblePaise).toBe(70_000);

      // Paid back more than she owed: the lent account is below zero, money you owe, so it stays.
      await transfer(s, 8, 40_000, A_LENT, A_CASH);
      r = await plan();
      expect(await balanceOf(s, A_LENT)).toBe(-10_000);
      expect(r.inputs.lentOutPaise).toBe(0);
      expect(r.flexiblePaise).toBe(r.inputs.balancePaise);
    });
  });
});

describe.skipIf(!ADMIN_URL)("balance checks", () => {
  let db: TestDb;
  let f: Fixtures;

  beforeAll(async () => {
    db = await createTestDb();
    f = await seedFixtures(db);
  });
  afterAll(async () => {
    await db?.close();
  });

  const AS_OF = "2026-11-10T09:00:00+05:30";
  const check = (n: number, stated: number, extra: Partial<Check> = {}): Check => ({
    id: tid(n),
    account_id: A_CASH,
    as_of: AS_OF,
    stated_balance_paise: stated,
    ...extra,
  });
  const plus40 = (n: number) => ({ id: tid(n), type: "adjustment_in", amount_paise: 4_000 });

  it("a check ₹40 above the records makes one ₹40 correction; spending and income stay", async () => {
    await as(db, A, async (s) => {
      const before = await month(s);
      expect(await balanceOf(s, A_CASH, AS_OF)).toBe(100_000);
      const r = await reconcile(s, check(1, 104_000, { seen_difference_paise: 4_000 }), plus40(2));
      expect(r.status).toBe("applied");
      expect(r.check).toMatchObject({
        status: "corrected",
        recorded_balance_paise: 100_000,
        difference_paise: 4_000,
        correction_id: tid(2),
      });
      const rows = (
        await s.q("select * from public.transactions where account_id = $1", [A_CASH])
      ).rows.map(rowToTransaction);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: "adjustment_in",
        amountPaise: 4_000,
        source: "reconciliation",
        description: "Balance correction",
        occurredAt: expect.any(String),
      });
      expect(Date.parse(rows[0]!.occurredAt)).toBe(Date.parse(AS_OF));
      // The account now matches what was stated, from the check's instant on.
      expect(await balanceOf(s, A_CASH, "2026-11-10T09:00:00.001+05:30")).toBe(104_000);
      const after = await month(s);
      expect(after.income).toBe(before.income);
      expect(after.spending).toBe(before.spending);
      expect(after.categories).toBe(before.categories);
      expect(after.total - before.total).toBe(4_000);
      // A second check now matches.
      const again = await reconcile(s, check(3, 104_000, { as_of: "2026-11-10T10:00:00+05:30" }));
      expect(again.check).toMatchObject({ status: "matched", difference_paise: 0 });
    });
  });

  it("a replayed save is a duplicate; Undo reopens the check and restoring closes it", async () => {
    await as(db, A, async (s) => {
      await reconcile(s, check(1, 104_000), plus40(2));
      const replay = await reconcile(s, check(1, 104_000), plus40(2));
      expect(replay.status).toBe("duplicate");
      expect(replay.correction).toMatchObject({ id: tid(2), type: "adjustment_in" });
      expect((await s.q("select count(*)::int as n from public.reconciliations")).rows[0]!.n).toBe(
        1,
      );
      expect(
        (
          await s.q(
            "select count(*)::int as n from public.transactions where type like 'adjustment%'",
          )
        ).rows[0]!.n,
      ).toBe(1);

      // Undo is an ordinary delete of the correction.
      expect((await s.rpc<Result>("set_transaction_deleted", [tid(2), true])).status).toBe(
        "applied",
      );
      const status = async () =>
        rowToReconciliation(
          (await s.q("select * from public.reconciliations where id = $1", [tid(1)])).rows[0]!,
        ).status;
      expect(await status()).toBe("open");
      expect(await balanceOf(s, A_CASH)).toBe(100_000);
      // A replay after the Undo is still the same check: nothing new.
      expect((await reconcile(s, check(1, 104_000), plus40(2))).status).toBe("duplicate");
      expect(await balanceOf(s, A_CASH)).toBe(100_000);
      expect((await s.rpc<Result>("set_transaction_deleted", [tid(2), false])).status).toBe(
        "applied",
      );
      expect(await status()).toBe("corrected");
      // Same id, other content: a conflict, nothing written.
      const other = await reconcile(s, check(1, 999_000));
      expect(other).toMatchObject({ status: "conflict", reason: "different_content" });
    });
  });

  it("works out the figures itself: a correction that isn't the difference writes nothing", async () => {
    await as(db, A, async (s) => {
      // The records changed since the screen read them: an expense the screen didn't know of.
      await create(s, 9, {
        type: "expense",
        amount_paise: 1_000,
        account_id: A_CASH,
        occurred_at: "2026-11-09T10:00:00+05:30",
      });
      const counts = async () =>
        (
          await s.q(
            `select (select count(*) from public.reconciliations)::int as checks,
                    (select count(*) from public.transactions)::int as entries`,
          )
        ).rows[0];
      const start = await counts();
      const stale = [
        await reconcile(s, check(1, 104_000), plus40(2)), // the real gap is now ₹50
        await reconcile(s, check(3, 104_000), {
          id: tid(4),
          type: "adjustment_out",
          amount_paise: 5_000,
        }),
        await reconcile(s, check(5, 104_000, { seen_difference_paise: 4_000 })),
        await reconcile(s, check(7, 99_000), {
          id: tid(8),
          type: "adjustment_in",
          amount_paise: 1,
        }),
      ];
      for (const r of stale) {
        expect(r).toEqual({
          status: "stale",
          recorded_balance_paise: "99000",
          difference_paise: String(r === stale[3] ? 0 : 5_000),
        });
      }
      expect(await counts()).toEqual(start);
      // With the fresh figures it goes through.
      const ok = await reconcile(s, check(1, 104_000, { seen_difference_paise: 5_000 }), {
        id: tid(2),
        type: "adjustment_in",
        amount_paise: 5_000,
      });
      expect(ok.status).toBe("applied");
    });
  });

  it("keeps a difference left as it is, and refuses impossible checks", async () => {
    await as(db, A, async (s) => {
      const open = await reconcile(s, check(1, 95_000));
      expect(open.check).toMatchObject({
        status: "open",
        difference_paise: -5_000,
        correction_id: null,
      });
      expect(
        (
          await s.error("select public.record_reconciliation($1, null)", [
            check(2, 1, { as_of: "2026-09-30T12:00:00+05:30" }),
          ])
        )?.message,
      ).toBe("account_not_tracked");
      expect(
        (
          await s.error("select public.record_reconciliation($1, null)", [
            check(3, 1, { as_of: "2030-01-01T00:00:00+05:30" }),
          ])
        )?.message,
      ).toBe("check_in_future");
      expect(
        await reconcile(s, check(4, 1, { account_id: "aaaaaaaa-0000-4000-8000-0000000000ff" })),
      ).toEqual({ status: "not_found" });
    });
  });

  it("a correction is fixed, can't exist without its check, and the check can't be rewritten", async () => {
    await as(db, A, async (s) => {
      await reconcile(s, check(1, 104_000), plus40(2));
      const edit = await s.error("select public.update_transaction($1, 1, $2)", [
        tid(2),
        { amount_paise: 9_000 },
      ]);
      expect(edit?.message).toBe("correction_fixed");
      // A note on it is fine.
      expect(
        (await s.rpc<Result>("update_transaction", [tid(2), 1, { note: "Found a ₹40 note" }]))
          .status,
      ).toBe("applied");
      expect(
        (
          await s.error(
            "update public.reconciliations set stated_balance_paise = 1 where id = $1",
            [tid(1)],
          )
        )?.message,
      ).toBe("reconciliation_fixed");
      // The database sets the figures, whatever a direct write says.
      await s.q(
        `insert into public.reconciliations (id, account_id, as_of, stated_balance_paise, recorded_balance_paise, difference_paise, status)
         values ($1, $2, '2026-11-10T11:00:00+05:30', 104000, 0, 104000, 'open')`,
        [tid(5), A_CASH],
      );
      expect(
        (
          await s.q(
            "select recorded_balance_paise, difference_paise, status from public.reconciliations where id = $1",
            [tid(5)],
          )
        ).rows[0],
      ).toEqual({ recorded_balance_paise: "104000", difference_paise: "0", status: "matched" });
      // A correction made without a check fails when the transaction commits.
      await s.rpc("create_transaction", [
        {
          id: tid(6),
          type: "adjustment_in",
          amount_paise: 100,
          currency: "INR",
          occurred_at: AT,
          account_id: A_CASH,
          source: "reconciliation",
        },
      ]);
      expect((await s.error("set constraints all immediate"))?.message).toBe(
        "correction_without_check",
      );
    });
  });

  it("the report adds up with a correction each way, one in the period and one before it", async () => {
    await as(db, A, async (s) => {
      await create(s, 1, {
        type: "income",
        amount_paise: 30_000,
        account_id: A_BANK,
        category_id: f.aAllowance,
      });
      await create(s, 2, {
        type: "expense",
        amount_paise: 12_000,
        account_id: A_CASH,
        category_id: f.aFood,
      });
      // Before November: −₹25 on the bank. Inside it: +₹40 on cash.
      await reconcile(
        s,
        check(3, 500_000 - 2_500, { account_id: A_BANK, as_of: "2026-10-20T10:00:00+05:30" }),
        {
          id: tid(4),
          type: "adjustment_out",
          amount_paise: 2_500,
        },
      );
      await reconcile(s, check(5, 100_000 - 12_000 + 4_000), plus40(6));
      const { accounts, ledger } = await read(s);
      const report = (period = NOVEMBER) => {
        const { openingMs, closingMs } = periodBalanceInstants(period, NOW);
        return { period, openingMs, closingMs };
      };
      for (const { period, openingMs, closingMs } of [
        report(),
        report(
          resolvePeriod({ kind: "custom", from: "2026-10-01", to: "2026-11-10" }, NOW, settings),
        ),
      ]) {
        const balances = await balancesAt(
          s,
          new Date(closingMs).toISOString(),
          openingMs === null ? null : new Date(openingMs).toISOString(),
        );
        const r = buildReport({
          accounts,
          ledger,
          balances,
          categories: [],
          period,
          periodLabel: "test",
          comparison: null,
          now: NOW,
          settings,
          currency: "INR",
          options: {
            includeTransactions: true,
            includeNotes: false,
            compare: false,
            hiddenCategoryIds: [],
          },
        });
        expect(reportDifferences(r)).toEqual({ balance: 0, spending: 0, purchases: 0 });
        expect(r.incomePaise).toBe(30_000);
        expect(r.netSpendingPaise).toBe(12_000);
        expect(r.transactions!.filter((t) => t.type === "correction")).toHaveLength(
          r.correctionCount,
        );
        if (period === NOVEMBER) {
          expect(r).toMatchObject({
            correctionsInPaise: 4_000,
            correctionsOutPaise: 0,
            correctionsPaise: 4_000,
          });
          // opening + income + refunds − spending ± corrections = closing
          expect(r.openingPaise + 30_000 - 12_000 + 4_000).toBe(r.closingPaise);
        } else {
          expect(r).toMatchObject({
            correctionsInPaise: 4_000,
            correctionsOutPaise: 2_500,
            correctionsPaise: 1_500,
          });
        }
      }
    });
  });

  it("is owner-only: no other user, and no anonymous caller, can read, write or call it", async () => {
    await as(db, A, async (s) => {
      await reconcile(s, check(1, 104_000), plus40(2));
      await s.q("commit");
      await s.q("begin");
    });
    try {
      await as(db, B, async (s) => {
        expect((await s.q("select * from public.reconciliations")).rows).toEqual([]);
        // A's account through the RPC: not found for B.
        expect(await reconcile(s, check(10, 1))).toEqual({ status: "not_found" });
        // A direct row pointing at A's account is refused (same-owner foreign key / guard).
        const direct = await s.error(
          `insert into public.reconciliations (id, account_id, as_of, stated_balance_paise, recorded_balance_paise, difference_paise, status)
           values ($1, $2, now(), 1, 0, 1, 'open')`,
          [tid(11), A_CASH],
        );
        expect(direct).not.toBeNull();
        // Re-owning or touching A's check changes nothing.
        await s.q("update public.reconciliations set note = 'x' where id = $1", [tid(1)]);
        expect(
          (await s.error("delete from public.reconciliations where id = $1", [tid(1)]))?.message,
        ).toMatch(/permission denied/);
        // B's own check works on B's own wallet.
        const own = await reconcile(s, check(12, 20_000, { account_id: B_CASH }));
        expect(own.check).toMatchObject({ status: "matched" });
      });
      const { rows } = await db.client.query(
        "select note, owner_id from public.reconciliations where id = $1",
        [tid(1)],
      );
      expect(rows).toEqual([{ note: null, owner_id: A }]);
      await as(db, null, async (s) => {
        expect((await s.error("select * from public.reconciliations"))?.message).toMatch(
          /permission denied/,
        );
        expect(
          (await s.error("select public.record_reconciliation('{}'::jsonb, null)"))?.message,
        ).toMatch(/permission denied/);
      });
    } finally {
      await db.client.query("delete from public.reconciliations where owner_id = $1", [A]);
      await db.client.query("delete from public.transactions where owner_id = $1", [A]);
    }
  });

  it("through the mutation layer: save, then Undo as an ordinary command", async () => {
    await as(db, A, async (s) => {
      const port = pgPort(s);
      const saved = await runBalanceCheckWith(port, {
        checkId: tid(1),
        accountId: A_CASH,
        asOf: AS_OF,
        statedBalancePaise: 104_000,
        seenDifferencePaise: 4_000,
        correctionId: tid(2),
        note: null,
      });
      expect(saved).toMatchObject({ ok: true, status: "applied", check: { status: "corrected" } });
      if (!saved.ok || !saved.undo) throw new Error("expected an Undo");
      expect(saved.undo).toMatchObject({ kind: "delete", id: tid(2) });
      expect((await runLedgerCommandWith(port, saved.undo)).ok).toBe(true);
      expect(await balanceOf(s, A_CASH)).toBe(100_000);
      const check = (await s.q("select status from public.reconciliations where id = $1", [tid(1)]))
        .rows[0];
      expect(check).toEqual({ status: "open" });
    });
  });

  it("adds no SECURITY DEFINER function, and the new ones take no user id", async () => {
    const { rows } = await db.client.query(
      `select p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid) as args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and (p.prosecdef or p.proname in ('record_reconciliation', 'recorded_balance_at'))
       order by 1`,
    );
    expect(rows).toEqual([
      { proname: "ensure_my_defaults", prosecdef: true, args: "" },
      { proname: "handle_new_user", prosecdef: true, args: "" },
      {
        proname: "record_reconciliation",
        prosecdef: false,
        args: "p_check jsonb, p_correction jsonb",
      },
      {
        proname: "recorded_balance_at",
        prosecdef: false,
        args: "p_account uuid, p_at timestamp with time zone",
      },
      { proname: "seed_user_defaults", prosecdef: true, args: "p_user uuid" },
    ]);
  });
});

describe.skipIf(ADMIN_URL)("credit cards, loans and balance checks (skipped)", () => {
  it.skip(SKIP_REASON, () => {});
});
