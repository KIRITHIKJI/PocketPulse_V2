/**
 * Home's one quiet line under the net tracked balance (doc/V2_SPEC.md §4, "Balance basis"): what is
 * in wallets, what you owe on cards and loans, and what people owe you. The parts come from the
 * same per-account balances as the net figure, and always add back up to it:
 *
 *   in wallets − you owe + owed to you = net tracked balance
 *
 * Integer paise through the domain's money helpers; nothing new is calculated about any account.
 */
import type { AccountBalance } from "./balances";
import { type Paise, addPaise, maxPaise, subtractPaise } from "./money";
import { type Account, LOAN_KINDS } from "./schemas";

export interface NetPositionParts {
  inWalletsPaise: Paise;
  youOwePaise: Paise;
  owedToYouPaise: Paise;
}

const OWING_KINDS = new Set<Account["kind"]>(["credit_card", ...LOAN_KINDS]);

/**
 * The three parts, or null when the user has no card or loan to show (an archived one that is
 * settled doesn't count). A card or loan below zero is owed by you, above zero is owed to you
 * (a lent loan, or credit left on a card); every other account is a wallet, overdrawn or not.
 */
export function netPositionParts(
  accounts: readonly Pick<Account, "id" | "kind" | "archivedAt">[],
  balances: readonly Pick<AccountBalance, "accountId" | "balancePaise">[],
): NetPositionParts | null {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const parts: NetPositionParts = { inWalletsPaise: 0, youOwePaise: 0, owedToYouPaise: 0 };
  let owingAccounts = 0;
  for (const { accountId, balancePaise } of balances) {
    const account = byId.get(accountId);
    const paise = balancePaise ?? 0;
    if (!account || !OWING_KINDS.has(account.kind)) {
      parts.inWalletsPaise = addPaise(parts.inWalletsPaise, paise);
      continue;
    }
    if (!account.archivedAt || paise !== 0) owingAccounts += 1;
    parts.youOwePaise = addPaise(parts.youOwePaise, maxPaise(0, subtractPaise(0, paise)));
    parts.owedToYouPaise = addPaise(parts.owedToYouPaise, maxPaise(0, paise));
  }
  return owingAccounts > 0 ? parts : null;
}
