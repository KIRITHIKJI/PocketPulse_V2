/**
 * `wallet_balances` (the database function screens read balances from) against the domain's own
 * balance rules, on the same rows. Any difference is a bug in one of them. Covers transfers,
 * goal money, refunds, deleted and voided rows, entries before a wallet's opening date, a wallet
 * that starts tracking later, and instants on both sides of IST midnight. Then who can call it.
 */
import {
  type Account,
  type ConsolidatedBalance,
  type Period,
  type Transaction,
  ledgerBalances,
  periodBalanceInstants,
  resolvePeriod,
  summarizePeriod,
} from "@/domain";
import { rowToAccount, rowToLedgerBalances, rowToTransaction } from "@/lib/data/mappers";

import { A, A_BANK, A_CASH, A_GOAL, B, B_CASH, type Fixtures, seedFixtures, tid } from "./fixtures";
import { ADMIN_URL, type Session, type TestDb, as, createTestDb } from "./harness";

const A_LATE = "aaaaaaaa-0000-4000-8000-0000000000e1";
const A_CARD = "aaaaaaaa-0000-4000-8000-0000000000e2";
const A_OWE = "aaaaaaaa-0000-4000-8000-0000000000e3";
const A_LENT = "aaaaaaaa-0000-4000-8000-0000000000e4";
const A_MOVED = "aaaaaaaa-0000-4000-8000-0000000000e5";
const IST = "Asia/Kolkata";
const ms = (iso: string) => Date.parse(iso);

/** Instants the balances are compared at: IST midnights, a millisecond either side, and more. */
const INSTANTS = [
  "2026-09-01T00:00:00+05:30", // before any wallet is tracked
  "2026-09-30T23:59:59.999+05:30",
  "2026-10-01T00:00:00+05:30", // Cash and Bank start tracking
  "2026-10-01T00:00:00.001+05:30",
  "2026-10-05T12:00:00+05:30", // exactly when an expense happened (it isn't counted yet)
  "2026-10-05T12:00:00.001+05:30",
  "2026-10-09T23:59:59.999+05:30",
  "2026-10-10T00:00:00+05:30",
  "2026-10-10T00:00:00.001+05:30",
  "2026-10-14T23:59:59.999+05:30",
  "2026-10-15T00:00:00+05:30", // the late wallet starts
  "2026-10-16T00:00:00+05:30",
  "2026-11-01T00:00:00+05:30",
  "2027-01-01T00:00:00+05:30",
];

const byAccount = (balance: ConsolidatedBalance) => ({
  ...balance,
  accounts: [...balance.accounts].sort((a, b) => (a.accountId < b.accountId ? -1 : 1)),
  untrackedAccountIds: [...balance.untrackedAccountIds].sort(),
});

describe.skipIf(!ADMIN_URL)("wallet_balances matches the domain", () => {
  let db: TestDb;
  let f: Fixtures;

  beforeAll(async () => {
    db = await createTestDb();
    f = await seedFixtures(db);
  });
  afterAll(async () => {
    await db?.close();
  });

  /** A's ledger: every kind of row the balance rules treat differently. */
  async function writeLedger(s: Session) {
    await s.q(
      `insert into public.accounts (id, name, kind, currency, opening_balance_paise, opening_balance_date)
       values ($1, 'Late wallet', 'cash', 'INR', 30000, '2026-10-15')`,
      [A_LATE],
    );
    const create = async (n: number, tx: Record<string, unknown>) => {
      const result = await s.rpc<{ status: string }>("create_transaction", [
        { id: tid(n), currency: "INR", ...tx },
      ]);
      expect(result.status).toBe("applied");
    };
    const expense = (n: number, amount: number, at: string, account = A_CASH) =>
      create(n, {
        type: "expense",
        amount_paise: amount,
        occurred_at: at,
        account_id: account,
        category_id: f.aFood,
      });

    await create(1, {
      type: "income",
      amount_paise: 2_000_000,
      occurred_at: "2026-10-02T09:00:00+05:30",
      account_id: A_BANK,
      category_id: f.aAllowance,
    });
    await expense(2, 150_000, "2026-10-05T12:00:00+05:30");
    // Either side of IST midnight on 10 Oct.
    await expense(3, 30_000, "2026-10-09T23:59:59.999+05:30");
    await expense(4, 70_000, "2026-10-10T00:00:00+05:30");
    // Dated before the wallets' opening date (1 Oct IST): already in the opening balance.
    await expense(5, 40_000, "2026-09-30T23:59:59.999+05:30");
    await expense(6, 11_000, "2026-10-01T00:00:00+05:30");
    // Before the late wallet starts, then after.
    await expense(7, 5_000, "2026-10-14T20:00:00+05:30", A_LATE);
    await expense(8, 6_000, "2026-10-15T08:00:00+05:30", A_LATE);
    await create(9, {
      type: "refund",
      amount_paise: 50_000,
      occurred_at: "2026-10-12T10:00:00+05:30",
      account_id: A_CASH,
      refund_of_id: tid(2),
    });
    await create(10, {
      type: "transfer",
      amount_paise: 1_000_000,
      occurred_at: "2026-10-11T10:00:00+05:30",
      from_account_id: A_BANK,
      to_account_id: A_CASH,
    });
    // Into the late wallet before it starts tracking (the receiving side doesn't count yet),
    // then after.
    await create(11, {
      type: "transfer",
      amount_paise: 20_000,
      occurred_at: "2026-10-14T21:00:00+05:30",
      from_account_id: A_CASH,
      to_account_id: A_LATE,
    });
    await create(12, {
      type: "transfer",
      amount_paise: 25_000,
      occurred_at: "2026-10-16T09:00:00+05:30",
      from_account_id: A_CASH,
      to_account_id: A_LATE,
    });
    // Goal money never moves a wallet balance.
    await s.rpc("move_goal_money", [
      tid(13),
      A_GOAL,
      "allocation",
      300_000,
      "2026-10-13T10:00:00+05:30",
    ]);
    await s.rpc("move_goal_money", [
      tid(14),
      A_GOAL,
      "allocation_release",
      100_000,
      "2026-10-14T10:00:00+05:30",
    ]);
    // A deleted expense, and a voided one: neither counts.
    await expense(15, 999_900, "2026-10-06T10:00:00+05:30");
    await s.rpc("set_transaction_deleted", [tid(15), true]);
    await expense(16, 888_800, "2026-10-07T10:00:00+05:30");
    await s.q("reset role");
    await s.q("update public.transactions set voided_at = now() where id = $1", [tid(16)]);
    await s.q("set local role authenticated");
    // A later entry in the bank, so 2027 differs from November.
    await expense(17, 12_345, "2026-12-31T23:59:59.999+05:30", A_BANK);
  }

  /**
   * A credit card, money borrowed and lent, and balance corrections in both directions: one at
   * the last millisecond before IST midnight, one undone, one before its account's opening date.
   */
  async function writeV2Ledger(s: Session) {
    await s.q(
      `insert into public.accounts (id, name, kind, currency, opening_balance_paise, opening_balance_date, counterparty, credit_limit_paise)
       values ($1, 'Card', 'credit_card', 'INR', -50000, '2026-10-01', null, 1000000),
              ($2, 'Ravi', 'loan_borrowed', 'INR', 0, '2026-10-01', 'Ravi', null),
              ($3, 'Priya', 'loan_lent', 'INR', 0, '2026-10-01', 'Priya', null),
              ($4, 'Moved', 'bank', 'INR', 7000, '2026-10-01', null, null)`,
      [A_CARD, A_OWE, A_LENT, A_MOVED],
    );
    const create = async (n: number, tx: Record<string, unknown>) => {
      const result = await s.rpc<{ status: string }>("create_transaction", [
        { id: tid(n), currency: "INR", ...tx },
      ]);
      expect(result.status).toBe("applied");
    };
    const transfer = (n: number, amount: number, at: string, from: string, to: string) =>
      create(n, {
        type: "transfer",
        amount_paise: amount,
        occurred_at: at,
        from_account_id: from,
        to_account_id: to,
      });
    // Card purchase, then the bill paid from the bank.
    await create(101, {
      type: "expense",
      amount_paise: 50_000,
      occurred_at: "2026-10-03T10:00:00+05:30",
      account_id: A_CARD,
      category_id: f.aFood,
    });
    await transfer(102, 50_000, "2026-10-08T10:00:00+05:30", A_BANK, A_CARD);
    // Borrowed, repaid part, the rest partly forgiven.
    await transfer(103, 100_000, "2026-10-04T10:00:00+05:30", A_OWE, A_CASH);
    await transfer(104, 40_000, "2026-10-12T10:00:00+05:30", A_CASH, A_OWE);
    await create(105, {
      type: "income",
      amount_paise: 10_000,
      occurred_at: "2026-10-21T10:00:00+05:30",
      account_id: A_OWE,
    });
    // Lent, part came back, part written off.
    await transfer(106, 50_000, "2026-10-06T10:00:00+05:30", A_CASH, A_LENT);
    await transfer(107, 20_000, "2026-10-13T10:00:00+05:30", A_LENT, A_CASH);
    await create(108, {
      type: "expense",
      amount_paise: 10_000,
      occurred_at: "2026-10-20T10:00:00+05:30",
      account_id: A_LENT,
    });
    // Balance checks: the server works out the recorded balance; the correction must match it.
    const reconcile = async (n: number, account: string, asOf: string, delta: number) => {
      const wallets = await s.rpc<{ accounts: { account_id: string; closing_paise: string }[] }>(
        "wallet_balances",
        [asOf, null],
      );
      const recorded = Number(
        wallets.accounts.find((w) => w.account_id === account)!.closing_paise,
      );
      const result = await s.rpc<{ status: string }>("record_reconciliation", [
        { id: tid(n), account_id: account, as_of: asOf, stated_balance_paise: recorded + delta },
        {
          id: tid(n + 1),
          type: delta > 0 ? "adjustment_in" : "adjustment_out",
          amount_paise: Math.abs(delta),
        },
      ]);
      expect(result.status).toBe("applied");
    };
    await reconcile(110, A_CASH, "2026-10-09T23:59:59.999+05:30", 4_000);
    await reconcile(112, A_BANK, "2026-10-15T00:00:00+05:30", -2_500);
    await reconcile(114, A_CARD, "2026-10-16T12:00:00+05:30", 9_900);
    await s.rpc("set_transaction_deleted", [tid(115), true]);
    await reconcile(116, A_MOVED, "2026-10-03T12:00:00+05:30", 1_500);
    await s.q("update public.accounts set opening_balance_date = '2026-10-05' where id = $1", [
      A_MOVED,
    ]);
  }

  async function read(s: Session): Promise<{ accounts: Account[]; ledger: Transaction[] }> {
    const accounts = (await s.q("select * from public.accounts")).rows.map(rowToAccount);
    // Deleted rows included on purpose: the domain must leave them out by itself.
    const ledger = (await s.q("select * from public.transactions")).rows.map(rowToTransaction);
    return { accounts, ledger };
  }

  const rpc = async (s: Session, closing: string, opening: string | null) =>
    rowToLedgerBalances(
      await s.rpc("wallet_balances", [closing, opening]),
      ms(closing),
      opening === null ? null : ms(opening),
    );

  async function expectSameAt(s: Session, timeZone: string) {
    const { accounts, ledger } = await read(s);
    expect(ledger.some((tx) => tx.deletedAt !== null)).toBe(true);
    expect(ledger.some((tx) => tx.voidedAt !== null)).toBe(true);
    for (const closing of INSTANTS) {
      for (const opening of [null, ...INSTANTS.filter((i) => ms(i) <= ms(closing))]) {
        const fromDb = await rpc(s, closing, opening);
        const fromDomain = ledgerBalances(
          accounts,
          ledger,
          ms(closing),
          opening === null ? null : ms(opening),
          timeZone,
        );
        expect(byAccount(fromDb.closing), `closing ${closing}`).toEqual(
          byAccount(fromDomain.closing),
        );
        expect([...fromDb.entriesBeforeOpening].sort()).toEqual(
          [...fromDomain.entriesBeforeOpening].sort(),
        );
        if (opening === null) expect(fromDb.opening).toBeNull();
        else
          expect(byAccount(fromDb.opening!), `opening ${opening}`).toEqual(
            byAccount(fromDomain.opening!),
          );
      }
    }
  }

  it("agrees with the domain at every instant, in the profile's time zone", async () => {
    await as(db, A, async (s) => {
      await writeLedger(s);
      await expectSameAt(s, IST);

      // Spot-check figures by hand, so both can't be wrong the same way.
      const at = async (iso: string) => (await rpc(s, iso, null)).closing;
      const cash = (balance: ConsolidatedBalance) =>
        balance.accounts.find((b) => b.accountId === A_CASH)!.balancePaise;
      expect((await at("2026-09-30T23:59:59.999+05:30")).balancePaise).toBe(0);
      expect(cash(await at("2026-10-01T00:00:00+05:30"))).toBe(100_000);
      expect(cash(await at("2026-10-01T00:00:00.001+05:30"))).toBe(100_000 - 11_000);
      // 1 Oct 00:00 → 9 Oct 23:59:59.999 holds the 11,000 and 150,000 expenses; the 30,000 one
      // is at that instant, so it isn't in yet.
      expect(cash(await at("2026-10-09T23:59:59.999+05:30"))).toBe(100_000 - 11_000 - 150_000);
      expect(cash(await at("2026-10-10T00:00:00+05:30"))).toBe(100_000 - 11_000 - 150_000 - 30_000);
      const late = (await at("2026-10-14T23:59:59.999+05:30")).accounts.find(
        (b) => b.accountId === A_LATE,
      )!;
      expect(late).toMatchObject({ balancePaise: null, tracked: false });
      // From 15 Oct: opening 30,000 − 6,000 (the 5,000 and the transfer in are before it).
      const late16 = (await at("2026-10-16T00:00:00+05:30")).accounts.find(
        (b) => b.accountId === A_LATE,
      )!;
      expect(late16.balancePaise).toBe(30_000 - 6_000);
      // Before the opening date: Cash's 30 Sep expense; the late wallet's 14 Oct expense and the
      // transfer into it.
      const before = (await rpc(s, "2026-11-01T00:00:00+05:30", null)).entriesBeforeOpening;
      expect(Object.fromEntries(before)).toMatchObject({ [A_CASH]: 1, [A_BANK]: 0, [A_LATE]: 2 });
    });
  });

  it("follows the profile's time zone for where each wallet's day starts", async () => {
    await as(db, A, async (s) => {
      await writeLedger(s);
      await s.q("update public.profiles set time_zone = 'America/New_York' where id = $1", [A]);
      await expectSameAt(s, "America/New_York");
      // Opening date 1 Oct starts at midnight New York time, 09:30 IST: nothing is tracked
      // at IST midnight any more.
      const fromDb = await rpc(s, "2026-10-01T00:00:00+05:30", null);
      expect(fromDb.closing.balancePaise).toBe(0);
    });
  });

  it("agrees with the domain on cards, loans and balance corrections too", async () => {
    await as(db, A, async (s) => {
      await writeLedger(s);
      await writeV2Ledger(s);
      const { ledger } = await read(s);
      for (const type of ["adjustment_in", "adjustment_out"]) {
        expect(ledger.some((tx) => tx.type === type && tx.deletedAt === null)).toBe(true);
      }
      expect(ledger.some((tx) => tx.type === "adjustment_in" && tx.deletedAt !== null)).toBe(true);
      await expectSameAt(s, IST);

      // By hand: the card owes 500 at the start, buys 500, the bank pays 500 off.
      const at = async (iso: string) => (await rpc(s, iso, null)).closing;
      const of = (balance: ConsolidatedBalance, id: string) =>
        balance.accounts.find((b) => b.accountId === id)!.balancePaise;
      const nov = await at("2026-11-01T00:00:00+05:30");
      expect(of(nov, A_CARD)).toBe(-50_000);
      // Borrowed 1,000, repaid 400, then 100 forgiven (income on the loan).
      expect(of(nov, A_OWE)).toBe(-100_000 + 40_000 + 10_000);
      // Lent 500, 200 came back, 100 written off (an expense on the loan).
      expect(of(nov, A_LENT)).toBe(50_000 - 20_000 - 10_000);
      // The 40 correction lands exactly at its instant: not before, then from it on.
      const cash = (balance: ConsolidatedBalance) => of(balance, A_CASH)!;
      expect(
        cash(await at("2026-10-10T00:00:00+05:30")) -
          cash(await at("2026-10-09T23:59:59.999+05:30")),
      ).toBe(4_000 - 30_000);
      // A correction dated before its account's opening date is already inside the opening.
      const before = (await rpc(s, "2026-11-01T00:00:00+05:30", null)).entriesBeforeOpening;
      expect(before.get(A_MOVED)).toBe(1);
      expect(of(nov, A_MOVED)).toBe(7_000);

      await s.q("update public.profiles set time_zone = 'America/New_York' where id = $1", [A]);
      await expectSameAt(s, "America/New_York");
    });
  });

  it("gives summarizePeriod the same opening and closing as the full ledger", async () => {
    await as(db, A, async (s) => {
      await writeLedger(s);
      const { accounts, ledger } = await read(s);
      const now = ms("2026-10-20T15:00:00+05:30");
      const settings = { timeZone: IST, weekStartsOn: 1 as const };
      const periods: Period[] = [
        resolvePeriod({ kind: "this_month" }, now, settings),
        resolvePeriod({ kind: "custom", from: "2026-10-01", to: "2026-10-09" }, now, settings),
        resolvePeriod({ kind: "custom", from: "2026-10-10", to: "2026-10-10" }, now, settings),
        resolvePeriod({ kind: "custom", from: "2026-09-20", to: "2026-10-15" }, now, settings),
        resolvePeriod({ kind: "custom", from: "2026-11-01", to: "2026-11-30" }, now, settings),
        resolvePeriod({ kind: "all_time" }, now, settings),
      ];
      for (const period of periods) {
        const { openingMs, closingMs } = periodBalanceInstants(period, now);
        const balances = rowToLedgerBalances(
          await s.rpc("wallet_balances", [
            new Date(closingMs).toISOString(),
            openingMs === null ? null : new Date(openingMs).toISOString(),
          ]),
          closingMs,
          openingMs,
        );
        const windowRows = ledger.filter(
          (tx) => openingMs === null || Date.parse(tx.occurredAt) >= openingMs,
        );
        expect(
          summarizePeriod(accounts, windowRows, period, now, IST, balances),
          period.startDate ?? "all time",
        ).toEqual(summarizePeriod(accounts, ledger, period, now, IST));
      }
    });
  });

  it("gives summarizePeriod the same figures with cards, loans and corrections", async () => {
    await as(db, A, async (s) => {
      await writeLedger(s);
      await writeV2Ledger(s);
      const { accounts, ledger } = await read(s);
      const now = ms("2026-10-25T15:00:00+05:30");
      const settings = { timeZone: IST, weekStartsOn: 1 as const };
      for (const period of [
        resolvePeriod({ kind: "this_month" }, now, settings),
        resolvePeriod({ kind: "custom", from: "2026-10-10", to: "2026-10-20" }, now, settings),
        resolvePeriod({ kind: "all_time" }, now, settings),
      ]) {
        const { openingMs, closingMs } = periodBalanceInstants(period, now);
        const balances = rowToLedgerBalances(
          await s.rpc("wallet_balances", [
            new Date(closingMs).toISOString(),
            openingMs === null ? null : new Date(openingMs).toISOString(),
          ]),
          closingMs,
          openingMs,
        );
        const fromDb = summarizePeriod(accounts, ledger, period, now, IST, balances);
        expect(fromDb, period.startDate ?? "all time").toEqual(
          summarizePeriod(accounts, ledger, period, now, IST),
        );
      }
      const october = summarizePeriod(
        accounts,
        ledger,
        resolvePeriod({ kind: "this_month" }, now, settings),
        now,
        IST,
      );
      // 4,000 in on Cash; the bank's 2,500 out; the undone one and the one before Moved's
      // opening date don't count.
      expect(october.adjustmentsInPaise).toBe(4_000);
      expect(october.adjustmentsOutPaise).toBe(2_500);
    });
  });
});

describe.skipIf(!ADMIN_URL)("wallet_balances access", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    await seedFixtures(db);
  });
  afterAll(async () => {
    await db?.close();
  });

  it("takes no user id, and runs as the caller under RLS", async () => {
    const { rows } = await db.client.query(
      `select pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
       from pg_proc p where p.proname = 'wallet_balances'`,
    );
    expect(rows).toEqual([
      {
        args: "p_closing timestamp with time zone, p_opening timestamp with time zone",
        prosecdef: false,
      },
    ]);
  });

  it("shows each user only their own wallets", async () => {
    await as(db, A, async (s) => {
      await s.rpc("create_transaction", [
        {
          id: tid(50),
          type: "expense",
          amount_paise: 12_300,
          currency: "INR",
          occurred_at: "2026-10-05T12:00:00+05:30",
          account_id: A_CASH,
        },
      ]);
      // Committed, so B could see it if anything leaked.
      await s.q("commit");
      await s.q("begin");
    });
    try {
      const at = "2026-11-01T00:00:00+05:30";
      const a = await as(db, A, (s) =>
        s.rpc<Record<string, unknown>>("wallet_balances", [at, null]),
      );
      const b = await as(db, B, (s) =>
        s.rpc<Record<string, unknown>>("wallet_balances", [at, null]),
      );
      const ids = (r: Record<string, unknown>) =>
        (r.accounts as { account_id: string }[]).map((w) => w.account_id);
      expect(ids(a)).toContain(A_CASH);
      expect(ids(b)).toEqual([B_CASH]);
      expect(b.closing_total_paise).toBe("20000");
      expect(a.closing_total_paise).toBe(String(100_000 + 500_000 + 0 - 12_300));
    } finally {
      await db.client.query("delete from public.transactions where id = $1", [tid(50)]);
    }
  });

  it("refuses anonymous callers", async () => {
    await as(db, null, async (s) => {
      const error = await s.error("select public.wallet_balances(now(), null)");
      expect(error?.code).toBe("42501");
    });
  });
});
