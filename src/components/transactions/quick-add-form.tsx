"use client";

import * as React from "react";
import { Info, LoaderCircle } from "lucide-react";

import { CategoryBadge } from "@/components/categories/category-icon";
import { CategoryPicker } from "@/components/categories/category-picker";
import { Field, MoneyField, SelectField } from "@/components/forms/form-parts";
import { OtherEntryRoutes, money, quickEntryCommand } from "@/components/transactions/quick-entry";
import { useLedger } from "@/components/transactions/use-ledger";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// The modules themselves, not the `@/domain` barrel: the barrel brings the schemas and `zod`
// into the browser's first load.
import { isSpendingAccount } from "@/domain/accounts";
import { isBeforeOpeningDate } from "@/domain/balances";
import { suggestCategory } from "@/domain/categorize";
import { type CategoryChoice, categoryLabel } from "@/domain/category-tree";
import { parseAmountInput } from "@/domain/money";
import { saveQuickAdd } from "@/lib/actions/transactions";
import type { EntryKit } from "@/lib/data/entry-kit";
import { formatLocalDate, paiseToInput } from "@/lib/format";
import { newId } from "@/lib/ids";
import { beforeOpeningText } from "@/lib/opening-note";
import type { QuickEntry } from "@/lib/quick-entries";

/**
 * The confirm sheet for a tile, a "log again" shortcut or a tile in edit mode. Loaded on first
 * use (`QuickAdd` preloads it once the page is idle), so Home's first JavaScript stays small.
 * `openCount` gives every opening a fresh form, with fresh ids.
 */
export function QuickAddSheet({
  entry,
  openCount,
  kit,
  onClose,
}: {
  entry: QuickEntry | null;
  openCount: number;
  kit: EntryKit;
  onClose: () => void;
}) {
  return (
    <Dialog open={entry !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {entry && (
          <QuickAddForm
            key={`${entry.key}-${openCount}`}
            entry={entry}
            kit={kit}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function QuickAddForm({
  entry,
  kit,
  onDone,
}: {
  entry: QuickEntry;
  kit: EntryKit;
  onDone: () => void;
}) {
  const { run } = useLedger();
  // Ids are fixed for the life of this sheet: a double tap or retry replays the same entry.
  const [ids] = React.useState(() => ({ id: newId(), opId: newId() }));
  // "Now" for this sheet: the entry's time, and the moment the opening-date rule is checked at.
  const [openedAt] = React.useState(() => Date.now());
  const firstSubmitAt = React.useRef<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const activeAccounts = kit.accounts.filter((a) => !a.archivedAt && isSpendingAccount(a));
  const startAccount =
    entry.accountId && activeAccounts.some((a) => a.id === entry.accountId)
      ? entry.accountId
      : kit.defaultAccountId;
  const [accountId, setAccountId] = React.useState(startAccount);
  const [amountText, setAmountText] = React.useState(paiseToInput(entry.amountPaise));
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState(entry.description ?? "");
  const [chosen, setChosen] = React.useState<CategoryChoice | null>(
    entry.categoryId ? { categoryId: entry.categoryId, subcategoryId: entry.subcategoryId } : null,
  );
  const [pickedByUser, setPickedByUser] = React.useState(entry.categoryId !== null);
  const [categoryError, setCategoryError] = React.useState<string | null>(null);

  const deferredDescription = React.useDeferredValue(description);
  const suggestion = React.useMemo(
    () =>
      entry.askDetails
        ? suggestCategory(
            { description: deferredDescription, kind: "expense" },
            { categories: kit.categories, rules: kit.rules, history: kit.history },
          )
        : null,
    [entry.askDetails, deferredDescription, kit],
  );
  const category = pickedByUser ? chosen : (suggestion ?? chosen);

  const parsed = parseAmountInput(amountText);
  const amountPaise = parsed.ok ? parsed.paise : null;
  const [remember, setRemember] = React.useState(
    entry.presetId !== null && entry.amountPaise === null,
  );
  const canRemember =
    entry.presetId !== null && amountPaise !== null && amountPaise !== entry.amountPaise;

  const account = kit.accounts.find((a) => a.id === accountId);
  const beforeOpening = account && isBeforeOpeningDate(account, openedAt, kit.timeZone);
  const byId = React.useMemo(() => new Map(kit.categories.map((c) => [c.id, c])), [kit.categories]);
  const label = category ? categoryLabel(category, byId) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!parsed.ok) {
      setAmountError(parsed.message);
      return;
    }
    if (!category) {
      setCategoryError("Choose a category.");
      return;
    }
    firstSubmitAt.current ??= new Date().toISOString();
    const text = entry.askDetails ? description.trim() || null : entry.description;
    const command = quickEntryCommand(entry, kit, {
      ids,
      amountPaise: parsed.paise,
      occurredAt: firstSubmitAt.current,
      accountId,
      category,
      description: text,
    });
    setPending(true);
    const usual =
      remember && canRemember && entry.presetId
        ? { presetId: entry.presetId, amountPaise: parsed.paise }
        : null;
    const result = await run(command, {
      success: `Saved ${money(parsed.paise, kit)} · ${text ?? entry.title}`,
      send: (c) => saveQuickAdd(c, usual),
      label: text ?? entry.title,
      remember: usual,
    });
    setPending(false);
    if (result?.ok) onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <CategoryBadge icon={entry.icon} color={entry.color} />
          <div className="min-w-0">
            <DialogTitle>{entry.title}</DialogTitle>
            <DialogDescription>
              {label ?? "Expense"} · now
              {activeAccounts.length <= 1 && account ? ` · from ${account.name}` : ""}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <MoneyField
        id={`quick-amount-${entry.key}`}
        name="amount"
        label="Amount"
        value={amountText}
        onChange={(e) => {
          setAmountText(e.target.value);
          setAmountError(null);
        }}
        onFocus={(e) => e.currentTarget.select()}
        enterKeyHint="done"
        autoFocus
        className="[&_input]:h-14 [&_input]:text-2xl [&_input]:font-semibold"
        error={amountError ?? undefined}
      />

      {entry.askDetails && (
        <>
          <Field
            id={`quick-description-${entry.key}`}
            name="description"
            label="What was it?"
            placeholder="e.g. samosa, photocopy, auto to station"
            value={description}
            maxLength={200}
            autoComplete="off"
            onChange={(e) => setDescription(e.target.value)}
          />
          <CategoryPicker
            id={`quick-category-${entry.key}`}
            label="Category"
            tree={kit.expenseTree}
            value={category}
            error={categoryError ?? undefined}
            hint={
              !pickedByUser && suggestion
                ? `Suggested: ${suggestion.reason}. Change it if it’s wrong.`
                : undefined
            }
            onChange={(choice) => {
              setChosen(choice);
              setPickedByUser(true);
              setCategoryError(null);
            }}
          />
        </>
      )}
      {!entry.askDetails && !category && (
        <p role="alert" className="text-sm text-destructive">
          This tile has no category. Edit the tile on Quick add to choose one.
        </p>
      )}

      {activeAccounts.length > 1 && (
        <SelectField
          id={`quick-account-${entry.key}`}
          name="accountId"
          label="Paid from"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          {activeAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.isDefault ? " (default)" : ""}
            </option>
          ))}
        </SelectField>
      )}

      {beforeOpening && account && (
        <p className="flex gap-2 rounded-lg bg-warning/10 p-2.5 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          {beforeOpeningText(account.name, formatLocalDate(account.openingBalanceDate))}
        </p>
      )}

      {canRemember && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Save {money(amountPaise!, kit)} as the usual amount for {entry.title}. Next time, one tap
          saves it.
        </label>
      )}

      <Button type="submit" size="lg" disabled={pending} aria-disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {pending ? "Saving…" : amountPaise !== null ? `Save ${money(amountPaise, kit)}` : "Save"}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-sm text-muted-foreground">More than one thing?</p>
        <OtherEntryRoutes />
      </div>
    </form>
  );
}
