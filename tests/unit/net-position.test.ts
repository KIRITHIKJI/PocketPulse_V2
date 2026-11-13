import { type Account, type AccountKind, accountSchema, consolidatedBalanceAt } from "@/domain";
import { netPositionParts } from "@/lib/net-position";

import { CASH, OWNER, expense, id, istMs, transfer } from "./domain/fixtures";

// Home's "In wallets · You owe · Owed to you" line: three parts of the net figure, never a new one.
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

const partsOf = (accounts: Account[], ledger: ReturnType<typeof expense>[] = []) => {
  const net = consolidatedBalanceAt(accounts, ledger, NOW, "Asia/Kolkata");
  return { net: net.balancePaise, parts: netPositionParts(accounts, net.accounts) };
};

describe("Home's net position line", () => {
  it("splits the spec's example and adds back up to the net balance", () => {
    // ₹1,000 cash; ₹300 owed on the card; ₹200 borrowed; ₹500 lent (doc/V2_SPEC.md §4).
    const { net, parts } = partsOf([
      acct(CASH, "cash", 100_000),
      acct(CARD, "credit_card", -30_000),
      acct(OWE, "loan_borrowed", -20_000),
      acct(LENT, "loan_lent", 50_000),
    ]);
    expect(net).toBe(100_000);
    expect(parts).toEqual({ inWalletsPaise: 100_000, youOwePaise: 50_000, owedToYouPaise: 50_000 });
    expect(parts!.inWalletsPaise - parts!.youOwePaise + parts!.owedToYouPaise).toBe(net);
  });

  it("follows the ledger: a card purchase is owed, a repayment moves money between parts", () => {
    const accounts = [
      acct(CASH, "cash", 100_000),
      acct(CARD, "credit_card", 0),
      acct(LENT, "loan_lent", 30_000),
    ];
    const at = "2026-11-05T12:00:00+05:30";
    const { net, parts } = partsOf(accounts, [
      expense(75_000, { accountId: CARD, occurredAt: at }),
      transfer(10_000, LENT, CASH, { occurredAt: at }),
    ]);
    expect(parts).toEqual({ inWalletsPaise: 110_000, youOwePaise: 75_000, owedToYouPaise: 20_000 });
    expect(parts!.inWalletsPaise - parts!.youOwePaise + parts!.owedToYouPaise).toBe(net);
  });

  it("a lent loan paid back beyond what was owed counts as owed by you", () => {
    const { net, parts } = partsOf([acct(CASH, "cash", 0), acct(LENT, "loan_lent", -5_000)]);
    expect(parts).toEqual({ inWalletsPaise: 0, youOwePaise: 5_000, owedToYouPaise: 0 });
    expect(parts!.inWalletsPaise - parts!.youOwePaise + parts!.owedToYouPaise).toBe(net);
  });

  it("is hidden without cards or loans, and for an archived one that is settled", () => {
    expect(partsOf([acct(CASH, "cash", 100_000), acct(id(113), "bank", 5_000)]).parts).toBeNull();
    const archived = acct(OWE, "loan_borrowed", 0, { archivedAt: "2026-10-20T10:00:00+05:30" });
    expect(partsOf([acct(CASH, "cash", 100_000), archived]).parts).toBeNull();
    const owing = acct(OWE, "loan_borrowed", -1_000, { archivedAt: "2026-10-20T10:00:00+05:30" });
    expect(partsOf([acct(CASH, "cash", 100_000), owing]).parts).not.toBeNull();
  });
});
