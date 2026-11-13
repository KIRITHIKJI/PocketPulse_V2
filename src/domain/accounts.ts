/**
 * How card and loan balances are entered and read. A balance is signed (money you have is
 * positive), but nobody thinks of a card bill as "−₹2,300": on cards and loans people type and
 * read what is owed, as a positive amount, and these functions convert the sign both ways.
 *
 *   credit card      typed "owed on the card"   ₹2,300  →  balance −₹2,300
 *   money borrowed   typed "I owe"              ₹600    →  balance −₹600
 *   money lent       typed "owed to me"         ₹500    →  balance +₹500
 *   anything else    typed as the balance itself (a minus sign if it's overdrawn)
 */
import { type Paise, maxPaise, subtractPaise } from "./money";
import type { Account, AccountKind } from "./schemas";

/** The signed balance for what the user typed on an account of this kind. */
export function balanceFromEntered(kind: AccountKind, enteredPaise: Paise): Paise {
  return kind === "credit_card" || kind === "loan_borrowed"
    ? subtractPaise(0, enteredPaise)
    : enteredPaise;
}

/** What the user would type for this balance (the inverse of `balanceFromEntered`). */
export function enteredFromBalance(kind: AccountKind, balancePaise: Paise): Paise {
  return balanceFromEntered(kind, balancePaise);
}

/** What the form asks for on an account of this kind. */
export function enteredBalanceLabel(kind: AccountKind): string {
  switch (kind) {
    case "credit_card":
      return "Owed on the card";
    case "loan_borrowed":
      return "Amount you owe";
    case "loan_lent":
      return "Amount owed to you";
    default:
      return "Balance";
  }
}

/**
 * One account's balance in words, never a raw sign: "You owe Ravi ₹600", "Priya owes you ₹500",
 * "Owed on card ₹2,300".
 */
export function balanceWording(
  account: Pick<Account, "kind" | "name" | "counterparty">,
  balancePaise: Paise,
  money: (paise: Paise) => string,
): string {
  const who = account.counterparty ?? account.name;
  const owedByYou = money(maxPaise(0, subtractPaise(0, balancePaise)));
  const owedToYou = money(maxPaise(0, balancePaise));
  switch (account.kind) {
    case "credit_card":
      return balancePaise > 0 ? `Credit on card ${owedToYou}` : `Owed on card ${owedByYou}`;
    case "loan_borrowed":
    case "loan_lent":
      if (balancePaise === 0) return `Settled with ${who}`;
      return balancePaise < 0 ? `You owe ${who} ${owedByYou}` : `${who} owes you ${owedToYou}`;
    default:
      return money(balancePaise);
  }
}

/** A card's figures: what's owed (sign removed) and, with a limit, the credit still available. */
export function cardFigures(
  account: Pick<Account, "creditLimitPaise">,
  balancePaise: Paise,
): { owedPaise: Paise; availablePaise: Paise | null } {
  const owedPaise = maxPaise(0, subtractPaise(0, balancePaise));
  return {
    owedPaise,
    availablePaise:
      account.creditLimitPaise === null ? null : subtractPaise(account.creditLimitPaise, owedPaise),
  };
}

/** Where everyday money is spent from: loans aren't (the quick-add and expense pickers skip them). */
export function isSpendingAccount(account: Pick<Account, "kind">): boolean {
  return account.kind !== "loan_borrowed" && account.kind !== "loan_lent";
}

const CARD = String.raw`(credit\s*card|cc|card)`;
const CARD_PAYMENT = new RegExp(
  String.raw`\b${CARD}\s*(bill|payment|dues?|repay(ment)?)\b|\bpa(y|id|ying)\s+(the\s+|my\s+)?${CARD}\b`,
  "i",
);

/**
 * Whether an expense's words read like paying a card bill. Paying the bill is a transfer to the
 * card: the purchases were already spending, so recording the bill as an expense would count
 * them twice. A plain word match; the form only offers the transfer, the user decides.
 */
export function looksLikeCardPayment(text: string): boolean {
  return CARD_PAYMENT.test(text);
}
