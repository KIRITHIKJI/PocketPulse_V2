/** Wallet/account form schemas. Opening balances may be zero or negative (overdrawn). */
import { z } from "zod";

import { ACCOUNT_KINDS, balanceFromEntered, isLoanKind } from "@/domain";
import { balanceField, dateField, optionalAmountField, optionalTextField } from "@/lib/forms";

export const ACCOUNT_KIND_LABELS: Record<(typeof ACCOUNT_KINDS)[number], string> = {
  cash: "Cash",
  bank: "Bank account",
  upi_wallet: "UPI / wallet",
  card: "Debit card",
  other: "Other",
  credit_card: "Credit card",
  loan_borrowed: "Money I borrowed",
  loan_lent: "Money I lent",
};

export const accountNameField = z
  .string()
  .trim()
  .min(1, "Give the wallet a name.")
  .max(60, "Use at most 60 characters.");

const dayField = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Number(value)))
  .refine(
    (value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 28),
    "Choose a day from 1 to 28.",
  );

/**
 * On cards and loans the opening amount is typed as what's owed (positive) and turned into the
 * signed balance here (`balanceFromEntered`). Fields that don't belong to the kind are dropped.
 */
export const accountFormSchema = z
  .object({
    name: accountNameField,
    kind: z.enum(ACCOUNT_KINDS, "Choose a type."),
    openingBalance: balanceField,
    openingDate: dateField,
    counterparty: optionalTextField(60, "The name").optional(),
    creditLimit: optionalAmountField.optional(),
    statementDay: dayField.optional(),
    dueDay: dayField.optional(),
  })
  .transform((a) => {
    const loan = isLoanKind(a.kind);
    const card = a.kind === "credit_card";
    return {
      name: a.name,
      kind: a.kind,
      openingBalance: balanceFromEntered(a.kind, a.openingBalance),
      openingDate: a.openingDate,
      ...(loan ? { counterparty: a.counterparty ?? a.name } : {}),
      ...(card
        ? {
            creditLimit: a.creditLimit ?? null,
            statementDay: a.statementDay ?? null,
            dueDay: a.dueDay ?? null,
          }
        : {}),
    };
  });

export const accountIdSchema = z.uuid("That wallet doesn’t exist.");
