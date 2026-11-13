"use client";

import * as React from "react";
import { Info, Pencil, Plus } from "lucide-react";

import {
  ActionForm,
  Field,
  FormMessage,
  MoneyField,
  SelectField,
  SubmitButton,
} from "@/components/forms/form-parts";
import { useDialogAction } from "@/components/forms/use-dialog-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Surface } from "@/components/ui/surface";
import {
  ACCOUNT_KINDS,
  type AccountKind,
  enteredBalanceLabel,
  enteredFromBalance,
  holdsDebt,
  isLoanKind,
} from "@/domain";
import { createAccount, updateAccount } from "@/lib/actions/accounts";
import { paiseToInput } from "@/lib/format";
import { ACCOUNT_KIND_LABELS } from "@/lib/validation/accounts";

type EditableAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  openingBalancePaise: number;
  openingBalanceDate: string;
  counterparty: string | null;
  creditLimitPaise: number | null;
  statementDay: number | null;
  dueDay: number | null;
};

/** The note shown wherever an opening balance is set. */
export function OpeningBalanceNote() {
  return (
    <Surface variant="inset" className="flex-row gap-2 type-caption text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p>
        The opening balance is what you count in this wallet at the start of the opening date.
        PocketPulse adds and subtracts your entries from there — it isn’t connected to a bank and
        doesn’t verify balances. Entries dated <em>before</em> the opening date are treated as
        already included, so they don’t change the balance.
      </p>
    </Surface>
  );
}

/** Create or edit a wallet: name, type, opening balance and its effective date. */
export function AccountFormDialog({
  account,
  today,
}: {
  account?: EditableAccount;
  today: string;
}) {
  const editing = Boolean(account);
  const { open, setOpen, state, formAction, pending, formKey } = useDialogAction(
    editing ? updateAccount : createAccount,
  );
  const err = state.fieldErrors ?? {};
  const prefix = account ? `account-${account.id}` : "account-new";
  const [kind, setKind] = React.useState<AccountKind>(account?.kind ?? "bank");
  // What's owed is typed as a positive amount on cards and loans (the sign is added on save).
  const opening = account ? enteredFromBalance(account.kind, account.openingBalancePaise) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${account!.name}`}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden="true" />
            Add wallet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${account!.name}` : "Add a wallet"}</DialogTitle>
          <DialogDescription>
            Cash, a bank account, a UPI app, a credit card, or money you borrowed or lent.
          </DialogDescription>
        </DialogHeader>
        <ActionForm key={formKey} action={formAction} className="flex flex-col gap-4">
          {account && <input type="hidden" name="id" value={account.id} />}
          <FormMessage state={state} />
          <Field
            id={`${prefix}-name`}
            name="name"
            label="Name"
            defaultValue={account?.name ?? ""}
            maxLength={60}
            autoComplete="off"
            required
            error={err.name}
          />
          <SelectField
            id={`${prefix}-kind`}
            name="kind"
            label="Type"
            value={kind}
            onChange={(event) => setKind(event.currentTarget.value as AccountKind)}
            error={err.kind}
          >
            {ACCOUNT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {ACCOUNT_KIND_LABELS[kind]}
              </option>
            ))}
          </SelectField>
          {isLoanKind(kind) && (
            <Field
              id={`${prefix}-counterparty`}
              name="counterparty"
              label={kind === "loan_borrowed" ? "Borrowed from" : "Lent to"}
              defaultValue={account?.counterparty ?? ""}
              maxLength={60}
              autoComplete="off"
              hint="Blank = the name above."
              error={err.counterparty}
            />
          )}
          {kind === "credit_card" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <MoneyField
                id={`${prefix}-limit`}
                name="creditLimit"
                label="Credit limit"
                defaultValue={paiseToInput(account?.creditLimitPaise ?? null)}
                hint="Optional."
                error={err.creditLimit}
              />
              <Field
                id={`${prefix}-statement`}
                name="statementDay"
                label="Statement day"
                type="number"
                min={1}
                max={28}
                defaultValue={account?.statementDay ?? ""}
                hint="Optional, 1–28."
                error={err.statementDay}
              />
              <Field
                id={`${prefix}-due`}
                name="dueDay"
                label="Payment due day"
                type="number"
                min={1}
                max={28}
                defaultValue={account?.dueDay ?? ""}
                hint="Optional, 1–28."
                error={err.dueDay}
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              id={`${prefix}-opening`}
              name="openingBalance"
              label={
                kind === "credit_card" || isLoanKind(kind)
                  ? enteredBalanceLabel(kind)
                  : "Opening balance"
              }
              defaultValue={paiseToInput(opening)}
              hint={
                holdsDebt(kind)
                  ? "On the opening date. Blank = ₹0. Type it as a positive amount."
                  : "Blank = ₹0. Use a minus sign if it’s overdrawn."
              }
              error={err.openingBalance}
            />
            <Field
              id={`${prefix}-date`}
              name="openingDate"
              label="Opening date"
              type="date"
              defaultValue={account?.openingBalanceDate ?? today}
              required
              error={err.openingDate}
            />
          </div>
          <OpeningBalanceNote />
          <SubmitButton pending={pending} pendingLabel="Saving…" size="default">
            {editing ? "Save changes" : "Add wallet"}
          </SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
