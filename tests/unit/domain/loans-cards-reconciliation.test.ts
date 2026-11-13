import {
  ACCOUNT_KINDS,
  type Account,
  type AccountKind,
  accountBalanceAt,
  accountSchema,
  balanceFromEntered,
  balanceWording,
  buildReport,
  calculateSafeToSpend,
  cardFigures,
  consolidatedBalanceAt,
  correctionFor,
  enteredFromBalance,
  formatINR,
  netSpending,
  reconciliationHints,
  reportDifferences,
  resolvePeriod,
  summarizePeriod,
  transactionSchema,
} from "@/domain";

import { BANK, CASH, OWNER, expense, id, income, ist, istMs, transfer } from "./fixtures";

const TZ = "Asia/Kolkata";
const settings = { timeZone: TZ, weekStartsOn: 1 as const };
const NOW = istMs("2026-11-10");
const CARD = id(110);
const OWE = id(111);
const LENT = id(112);

const acct = (
  accountId: string,
  kind: AccountKind,
  openingBalancePaise: number,
  extra: Partial<Account> = {},
): Account =>
  accountSchema.parse({
    id: accountId,
    ownerId: OWNER,
    name: kind,
    kind,
    openingBalancePaise,
    openingBalanceDate: "2026-10-01",
    ...extra,
  });

let n = 5000;
const correction = (
  type: "adjustment_in" | "adjustment_out",
  amountPaise: number,
  at: string,
  accountId = CASH,
) =>
  transactionSchema.parse({
    id: id(n++),
    ownerId: OWNER,
    type,
    amountPaise,
    currency: "INR",
    occurredAt: at,
    accountId,
    source: "reconciliation",
    description: "Balance correction",
    createdAt: at,
    updatedAt: at,
  });

describe("what people type on cards and loans", () => {
  // Each kind on its own: what's typed, the balance it becomes, and back again.
  it.each<[AccountKind, number, number]>([
    ["cash", 50_000, 50_000],
    ["bank", -2_000, -2_000],
    ["upi_wallet", 0, 0],
    ["card", 12_345, 12_345],
    ["other", 100, 100],
    ["credit_card", 230_000, -230_000],
    ["loan_borrowed", 60_000, -60_000],
    ["loan_lent", 50_000, 50_000],
  ])("%s: typed %d is a balance of %d", (kind, typed, balance) => {
    expect(balanceFromEntered(kind, typed)).toBe(balance);
    expect(enteredFromBalance(kind, balance)).toBe(typed);
    expect(Object.is(balanceFromEntered(kind, 0), -0)).toBe(false);
  });

  it("covers every account kind", () => {
    expect([...ACCOUNT_KINDS].sort()).toEqual([
      "bank",
      "card",
      "cash",
      "credit_card",
      "loan_borrowed",
      "loan_lent",
      "other",
      "upi_wallet",
    ]);
  });

  it("reads a balance in words, never as a raw sign", () => {
    const ravi = acct(OWE, "loan_borrowed", 0, { counterparty: "Ravi" });
    const priya = acct(LENT, "loan_lent", 0, { counterparty: "Priya" });
    const card = acct(CARD, "credit_card", 0);
    expect(balanceWording(ravi, -60_000, formatINR)).toBe("You owe Ravi ₹600");
    expect(balanceWording(priya, 50_000, formatINR)).toBe("Priya owes you ₹500");
    expect(balanceWording(priya, -1_000, formatINR)).toBe("You owe Priya ₹10");
    expect(balanceWording(ravi, 0, formatINR)).toBe("Settled with Ravi");
    expect(balanceWording(card, -230_000, formatINR)).toBe("Owed on card ₹2,300");
    expect(balanceWording(card, 5_000, formatINR)).toBe("Credit on card ₹50");
  });

  it("a card's available credit is its limit minus what's owed", () => {
    const card = acct(CARD, "credit_card", 0, { creditLimitPaise: 1_000_000 });
    expect(cardFigures(card, -230_000)).toEqual({ owedPaise: 230_000, availablePaise: 770_000 });
    expect(cardFigures(card, 10_000)).toEqual({ owedPaise: 0, availablePaise: 1_000_000 });
    expect(cardFigures(acct(CARD, "credit_card", 0), -1)).toEqual({
      owedPaise: 1,
      availablePaise: null,
    });
  });

  it("only a card holds a limit and statement days; only a loan a counterparty (domain shape)", () => {
    expect(
      acct(CARD, "credit_card", 0, { creditLimitPaise: 1, statementDay: 5, dueDay: 28 }),
    ).toMatchObject({
      creditLimitPaise: 1,
      dueDay: 28,
    });
    expect(() => acct(CARD, "credit_card", 0, { dueDay: 29 })).toThrow();
  });
});

describe("loans and cards in the money rules", () => {
  const accounts = [
    acct(CASH, "cash", 100_000),
    acct(BANK, "bank", 0),
    acct(CARD, "credit_card", 0),
    acct(OWE, "loan_borrowed", 0, { counterparty: "Ravi" }),
    acct(LENT, "loan_lent", 0, { counterparty: "Priya" }),
  ];
  const november = resolvePeriod({ kind: "this_month" }, NOW, settings);
  const at = ist("2026-11-05");

  it("borrowing and repaying are never income or spending", () => {
    const ledger = [
      transfer(100_000, OWE, CASH, { occurredAt: at }),
      transfer(40_000, CASH, OWE, { occurredAt: at }),
      transfer(50_000, CASH, LENT, { occurredAt: at }),
      transfer(20_000, LENT, CASH, { occurredAt: at }),
    ];
    const s = summarizePeriod(accounts, ledger, november, NOW);
    expect(s).toMatchObject({
      incomePaise: 0,
      expensesPaise: 0,
      netSpendingPaise: 0,
      netMovementPaise: 0,
    });
    expect(netSpending(ledger, november)).toBe(0);
    expect(consolidatedBalanceAt(accounts, ledger, NOW).balancePaise).toBe(100_000);
    expect(accountBalanceAt(accounts[3]!, ledger, NOW).balancePaise).toBe(-60_000);
    expect(accountBalanceAt(accounts[4]!, ledger, NOW).balancePaise).toBe(30_000);
  });

  it("a ₹500 card purchase and a ₹500 bill payment count ₹500 once", () => {
    const purchase = expense(50_000, { accountId: CARD, occurredAt: at });
    const bill = transfer(50_000, BANK, CARD, { occurredAt: ist("2026-11-06") });
    const before = consolidatedBalanceAt(accounts, [], NOW).balancePaise;
    expect(consolidatedBalanceAt(accounts, [purchase], NOW).balancePaise).toBe(before - 50_000);
    expect(consolidatedBalanceAt(accounts, [purchase, bill], NOW).balancePaise).toBe(
      before - 50_000,
    );
    expect(netSpending([purchase, bill], november)).toBe(50_000);
    expect(accountBalanceAt(accounts[2]!, [purchase, bill], NOW).balancePaise).toBe(0);
  });

  it("Safe to Spend leaves out money lent until it comes back", () => {
    // ₹1,000 cash; ₹300 owed on the card; ₹200 borrowed (in cash); ₹500 lent (from cash).
    const wallets = [
      acct(CASH, "cash", 100_000),
      acct(CARD, "credit_card", -30_000),
      acct(OWE, "loan_borrowed", -20_000),
      acct(LENT, "loan_lent", 50_000),
    ];
    const plan = (ledger = [] as ReturnType<typeof transfer>[], list = wallets) =>
      calculateSafeToSpend({
        accounts: list,
        ledger,
        commitments: [],
        now: NOW,
        settings,
        nextIncomeDate: "2026-12-01",
      });
    const r = plan();
    expect(r.inputs.balancePaise).toBe(100_000); // 1,000 − 300 − 200 + 500
    expect(r.inputs.lentOutPaise).toBe(50_000);
    expect(r.flexiblePaise).toBe(50_000);
    expect(r.explanation).toContain("Money you lent (₹500) isn't counted until it comes back.");

    const repaid = plan([transfer(20_000, LENT, CASH, { occurredAt: at })]);
    expect(repaid.inputs.balancePaise).toBe(100_000);
    expect(repaid.flexiblePaise).toBe(70_000);

    // Paid back more than owed: a lent account below zero is money you owe, so it stays in.
    const over = plan([], [...wallets.slice(0, 3), acct(LENT, "loan_lent", -10_000)]);
    expect(over.inputs.lentOutPaise).toBe(0);
    expect(over.flexiblePaise).toBe(100_000 - 30_000 - 20_000 - 10_000);
    expect(over.explanation.join(" ")).not.toMatch(/Money you lent/);
  });
});

describe("balance corrections", () => {
  const accounts = [acct(CASH, "cash", 100_000), acct(BANK, "bank", 500_000)];

  it("settle exactly the difference, in the right direction", () => {
    expect(correctionFor(4_000)).toEqual({ type: "adjustment_in", amountPaise: 4_000 });
    expect(correctionFor(-2_500)).toEqual({ type: "adjustment_out", amountPaise: 2_500 });
    expect(correctionFor(0)).toBeNull();
  });

  it("move only their account's balance, from their instant, and are never income or spending", () => {
    const fix = correction("adjustment_in", 4_000, ist("2026-11-09", "23:59"));
    const out = correction("adjustment_out", 2_500, ist("2026-11-08"), BANK);
    const cash = accounts[0]!;
    expect(accountBalanceAt(cash, [fix], Date.parse(fix.occurredAt)).balancePaise).toBe(100_000);
    expect(accountBalanceAt(cash, [fix], Date.parse(fix.occurredAt) + 1).balancePaise).toBe(
      104_000,
    );
    expect(accountBalanceAt(accounts[1]!, [fix, out], NOW).balancePaise).toBe(497_500);
    const s = summarizePeriod(
      accounts,
      [fix, out],
      resolvePeriod({ kind: "this_month" }, NOW, settings),
      NOW,
    );
    expect(s).toMatchObject({
      incomePaise: 0,
      expensesPaise: 0,
      netSpendingPaise: 0,
      adjustmentsInPaise: 4_000,
      adjustmentsOutPaise: 2_500,
      netMovementPaise: 1_500,
    });
    expect(s.closing.balancePaise - s.opening.balancePaise).toBe(s.netMovementPaise);
    expect(netSpending([fix, out], resolvePeriod({ kind: "this_month" }, NOW, settings))).toBe(0);
  });

  it("the report adds up with one each way, one in the period and one before it", () => {
    const ledger = [
      income(30_000, { accountId: BANK, occurredAt: ist("2026-11-02") }),
      expense(12_000, { occurredAt: ist("2026-11-03") }),
      correction("adjustment_out", 2_500, ist("2026-10-20"), BANK),
      correction("adjustment_in", 4_000, ist("2026-11-09")),
    ];
    const report = (period: ReturnType<typeof resolvePeriod>) =>
      buildReport({
        accounts,
        ledger,
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
    const nov = report(resolvePeriod({ kind: "this_month" }, NOW, settings));
    expect(reportDifferences(nov)).toEqual({ balance: 0, spending: 0, purchases: 0 });
    expect(nov).toMatchObject({
      openingPaise: 100_000 + 497_500,
      incomePaise: 30_000,
      netSpendingPaise: 12_000,
      correctionsInPaise: 4_000,
      correctionsOutPaise: 0,
      correctionsPaise: 4_000,
      correctionCount: 1,
    });
    // opening + income + refunds − spending ± corrections = closing
    expect(nov.openingPaise + 30_000 - 12_000 + 4_000).toBe(nov.closingPaise);
    expect(nov.transactions!.find((t) => t.type === "correction")).toMatchObject({
      signedPaise: 4_000,
      description: "Balance correction",
    });

    const both = report(
      resolvePeriod({ kind: "custom", from: "2026-10-01", to: "2026-11-10" }, NOW, settings),
    );
    expect(reportDifferences(both)).toEqual({ balance: 0, spending: 0, purchases: 0 });
    expect(both).toMatchObject({
      correctionsInPaise: 4_000,
      correctionsOutPaise: 2_500,
      correctionsPaise: 1_500,
    });
    expect(
      both.transactions!.filter((t) => t.type === "correction").map((t) => t.signedPaise),
    ).toEqual([-2_500, 4_000]);
  });

  it("points at likely causes of a difference, and stays quiet with none", () => {
    const cash = accounts[0]!;
    const misplaced = expense(4_000, { accountId: BANK, occurredAt: ist("2026-11-05") });
    const twiceA = expense(1_500, { occurredAt: ist("2026-11-06", "10:00"), description: "Tea" });
    const twiceB = expense(1_500, { occurredAt: ist("2026-11-06", "10:01"), description: "Tea" });
    const early = expense(700, { occurredAt: ist("2026-09-30") });
    const backwards = transfer(2_000, CASH, BANK, { occurredAt: ist("2026-11-07") });
    const base = {
      account: cash,
      accounts,
      sinceMs: istMs("2026-11-01", "00:00"),
      untilMs: NOW,
      timeZone: TZ,
    };
    const kinds = (ledger: ReturnType<typeof expense>[], differencePaise: number) =>
      reconciliationHints({ ...base, ledger, differencePaise }).map((h) => [
        h.kind,
        h.transactionIds,
      ]);
    expect(kinds([misplaced, twiceA, twiceB, early, backwards], 4_000)).toEqual([
      ["same_amount_elsewhere", [misplaced.id]],
      ["before_opening", [early.id]],
      ["reversed_transfer", [backwards.id]],
    ]);
    expect(kinds([twiceA, twiceB], 1_500)).toEqual([["same_day_twice", [twiceA.id, twiceB.id]]]);
    expect(kinds([misplaced, twiceA, twiceB], 0)).toEqual([]);
    expect(kinds([misplaced], 3_999)).toEqual([]);
  });
});
