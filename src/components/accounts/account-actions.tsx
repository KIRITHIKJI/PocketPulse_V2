"use client";

import * as React from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

import { Notice } from "@/components/feedback/notice";
import { useToast } from "@/components/feedback/toast";
import { Field, MoneyField, SelectField } from "@/components/forms/form-parts";
import { useLedger } from "@/components/transactions/use-ledger";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type CurrencyCode, moneyFormatter, parseAmountInput } from "@/domain";
import { type Comparison, compareBalance, saveBalanceCheck } from "@/lib/actions/balance-checks";
import { newId } from "@/lib/ids";
import { paiseToInput } from "@/lib/format";

interface Wallet {
  id: string;
  name: string;
}

/** A dialog whose form starts fresh (new ids) every time it opens. */
function FreshDialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [openCount, setOpenCount] = React.useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpenCount((n) => n + 1);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <React.Fragment key={openCount}>{children(() => setOpen(false))}</React.Fragment>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Money between this card or loan and one of the user's wallets: an ordinary transfer, so never
 * income or spending. `into` = money arrives on this account (paying the card, repaying a loan,
 * lending more); otherwise it leaves it (borrowing more, getting money back).
 */
export function TransferAction({
  label,
  title,
  description,
  accountId,
  into,
  wallets,
  defaultWalletId,
  defaultAmountPaise,
  currency,
  success,
  after,
  variant = "outline",
}: {
  label: string;
  title: string;
  description: string;
  accountId: string;
  into: boolean;
  wallets: Wallet[];
  defaultWalletId: string;
  defaultAmountPaise: number | null;
  currency: CurrencyCode;
  /** The toast; `{amount}` and `{wallet}` are filled in ("Paid {amount} from {wallet}."). */
  success: string;
  /** Shown under the form, e.g. where interest goes. */
  after?: React.ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <FreshDialog
      trigger={<Button variant={variant}>{label}</Button>}
      title={title}
      description={description}
    >
      {(close) => (
        <TransferForm
          accountId={accountId}
          into={into}
          wallets={wallets}
          defaultWalletId={defaultWalletId}
          defaultAmountPaise={defaultAmountPaise}
          currency={currency}
          success={success}
          after={after}
          submitLabel={label}
          onDone={close}
        />
      )}
    </FreshDialog>
  );
}

function TransferForm({
  accountId,
  into,
  wallets,
  defaultWalletId,
  defaultAmountPaise,
  currency,
  success,
  after,
  submitLabel,
  onDone,
}: {
  accountId: string;
  into: boolean;
  wallets: Wallet[];
  defaultWalletId: string;
  defaultAmountPaise: number | null;
  currency: CurrencyCode;
  success: string;
  after?: React.ReactNode;
  submitLabel: string;
  onDone: () => void;
}) {
  const { run } = useLedger();
  const money = moneyFormatter(currency);
  // Fixed for this sheet: a double tap or retry replays the same transfer.
  const [ids] = React.useState(() => ({ id: newId(), opId: newId() }));
  const at = React.useRef<string | null>(null);
  const [amountText, setAmountText] = React.useState(
    defaultAmountPaise && defaultAmountPaise > 0 ? paiseToInput(defaultAmountPaise) : "",
  );
  const [walletId, setWalletId] = React.useState(
    wallets.some((w) => w.id === defaultWalletId) ? defaultWalletId : (wallets[0]?.id ?? ""),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseAmountInput(amountText);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    at.current ??= new Date().toISOString();
    setPending(true);
    const wallet = wallets.find((w) => w.id === walletId)?.name ?? "your wallet";
    const result = await run(
      {
        kind: "create",
        opId: ids.opId,
        draft: {
          id: ids.id,
          type: "transfer",
          amountPaise: parsed.paise,
          currency,
          occurredAt: at.current,
          accountId: null,
          fromAccountId: into ? walletId : accountId,
          toAccountId: into ? accountId : walletId,
          refundOfId: null,
          categoryId: null,
          subcategoryId: null,
          description: null,
          merchant: null,
          note: null,
          tags: [],
          source: "manual",
          presetId: null,
        },
      },
      {
        success: success.replace("{amount}", money(parsed.paise)).replace("{wallet}", wallet),
      },
    );
    setPending(false);
    if (result?.ok) onDone();
  }

  if (wallets.length === 0) {
    return <Notice tone="info">Add a wallet first: cash, a bank account or a UPI app.</Notice>;
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <MoneyField
        id={`move-amount-${ids.id}`}
        name="amount"
        label="Amount"
        value={amountText}
        onChange={(e) => {
          setAmountText(e.target.value);
          setError(null);
        }}
        autoFocus
        error={error ?? undefined}
      />
      <SelectField
        id={`move-wallet-${ids.id}`}
        name="wallet"
        label={into ? "From wallet" : "Into wallet"}
        value={walletId}
        onChange={(e) => setWalletId(e.target.value)}
      >
        {wallets.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </SelectField>
      <p className="type-caption text-muted-foreground">
        A transfer between your own accounts: not income, not spending.
      </p>
      {after}
      <Button type="submit" disabled={pending} aria-disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

/**
 * The two loan endings that are real changes to your money, each only on the user's own
 * confirmation: a loan you gave that won't come back (spending), or a loan you took that was
 * forgiven (income). The dialog names the amount and what it counts as.
 */
export function LoanEndAction({
  accountId,
  counterparty,
  ending,
  outstandingPaise,
  categoryId,
  currency,
}: {
  accountId: string;
  counterparty: string;
  ending: "write_off" | "forgiven";
  outstandingPaise: number;
  categoryId: string | null;
  currency: CurrencyCode;
}) {
  const writeOff = ending === "write_off";
  return (
    <FreshDialog
      trigger={<Button variant="ghost">{writeOff ? "Write it off" : "They let me keep it"}</Button>}
      title={writeOff ? `Write off what ${counterparty} owes?` : `${counterparty} let you keep it?`}
      description={
        writeOff
          ? "Only if it won’t come back. It counts as spending, because the money is gone."
          : "Only if you won’t pay it back. It counts as income, because the money is now yours."
      }
    >
      {(close) => (
        <LoanEndForm
          accountId={accountId}
          writeOff={writeOff}
          outstandingPaise={outstandingPaise}
          categoryId={categoryId}
          currency={currency}
          counterparty={counterparty}
          onDone={close}
        />
      )}
    </FreshDialog>
  );
}

function LoanEndForm({
  accountId,
  writeOff,
  outstandingPaise,
  categoryId,
  currency,
  counterparty,
  onDone,
}: {
  accountId: string;
  writeOff: boolean;
  outstandingPaise: number;
  categoryId: string | null;
  currency: CurrencyCode;
  counterparty: string;
  onDone: () => void;
}) {
  const { run } = useLedger();
  const money = moneyFormatter(currency);
  const [ids] = React.useState(() => ({ id: newId(), opId: newId() }));
  const at = React.useRef<string | null>(null);
  const [amountText, setAmountText] = React.useState(
    outstandingPaise > 0 ? paiseToInput(outstandingPaise) : "",
  );
  const [pending, setPending] = React.useState(false);
  const parsed = parseAmountInput(amountText);
  const too = parsed.ok && parsed.paise > outstandingPaise;
  const effect = writeOff ? "spending" : "income";

  async function confirm() {
    if (!parsed.ok || too) return;
    at.current ??= new Date().toISOString();
    setPending(true);
    const result = await run(
      {
        kind: "create",
        opId: ids.opId,
        draft: {
          id: ids.id,
          type: writeOff ? "expense" : "income",
          amountPaise: parsed.paise,
          currency,
          occurredAt: at.current,
          accountId,
          fromAccountId: null,
          toAccountId: null,
          refundOfId: null,
          categoryId,
          subcategoryId: null,
          description: writeOff ? `Written off: ${counterparty}` : `Forgiven by ${counterparty}`,
          merchant: null,
          note: null,
          tags: [],
          source: "manual",
          presetId: null,
        },
      },
      {
        success: writeOff
          ? `Wrote off ${money(parsed.paise)}. It counts as spending.`
          : `Recorded ${money(parsed.paise)} as income.`,
      },
    );
    setPending(false);
    if (result?.ok) onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <MoneyField
        id={`end-amount-${ids.id}`}
        name="amount"
        label="Amount"
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
        hint={`Outstanding: ${money(outstandingPaise)}.`}
        error={
          too
            ? `That’s more than the ${money(outstandingPaise)} outstanding.`
            : !parsed.ok && amountText.trim()
              ? parsed.message
              : undefined
        }
      />
      {parsed.ok && !too && (
        <p className="type-body" data-testid="loan-end-summary">
          {money(parsed.paise)} will count as {effect} today.
        </p>
      )}
      <Button
        type="button"
        variant="destructive"
        disabled={!parsed.ok || too || pending}
        onClick={confirm}
      >
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {parsed.ok && !too
          ? `Yes, record ${money(parsed.paise)} as ${effect}`
          : `Record as ${effect}`}
      </Button>
    </div>
  );
}

const NEEDS_CONNECTION =
  "Checking a balance needs a connection: it compares with your latest records. Nothing was saved.";

/**
 * Check balance: type what the bank, UPI app or wallet really shows; see the recorded balance and
 * the difference; then save a matching check, look for the missing entry, or record one
 * correction. Online only: nothing here is ever queued.
 */
export function CheckBalance({
  accountId,
  accountName,
  amountLabel,
  currency,
  today,
  nowTime,
}: {
  accountId: string;
  accountName: string;
  amountLabel: string;
  currency: CurrencyCode;
  today: string;
  nowTime: string;
}) {
  const money = moneyFormatter(currency);
  const { show } = useToast();
  const { undo } = useLedger();
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(today);
  const [time, setTime] = React.useState(nowTime);
  const [whenChanged, setWhenChanged] = React.useState(false);
  const [comparison, setComparison] = React.useState<Extract<Comparison, { ok: true }> | null>(
    null,
  );
  const [ids, setIds] = React.useState(() => ({ check: newId(), correction: newId() }));
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function compare(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (!navigator.onLine) {
      setError({ message: NEEDS_CONNECTION });
      return;
    }
    setPending(true);
    try {
      const result = await compareBalance({ accountId, amount, date, time, atNow: !whenChanged });
      if (result.ok) {
        setComparison(result);
        setIds({ check: newId(), correction: newId() });
        setError(null);
      } else {
        setComparison(null);
        setError({ message: result.message, field: result.field });
      }
    } catch {
      setError({ message: NEEDS_CONNECTION });
    } finally {
      setPending(false);
    }
  }

  async function save(withCorrection: boolean) {
    if (!comparison) return;
    if (!navigator.onLine) {
      setError({ message: NEEDS_CONNECTION });
      return;
    }
    setPending(true);
    try {
      const result = await saveBalanceCheck({
        checkId: ids.check,
        accountId,
        asOf: comparison.asOf,
        statedBalancePaise: comparison.statedBalancePaise,
        seenDifferencePaise: comparison.differencePaise,
        correctionId: withCorrection ? ids.correction : null,
        note: null,
      });
      if (result.ok) {
        const reverse = result.undo;
        show({
          tone: "success",
          message: withCorrection
            ? `Corrected ${accountName} by ${money(Math.abs(comparison.differencePaise))}. It now matches.`
            : result.checkStatus === "matched"
              ? `${accountName} matches. Check saved.`
              : "Check saved. The difference is still open.",
          action: reverse ? { label: "Undo", run: () => undo(reverse) } : undefined,
        });
        setComparison(null);
        setAmount("");
      } else if (result.status === "stale") {
        // The records changed: show the current figures and let the user decide again.
        const differencePaise = result.differencePaise;
        setComparison({
          ...comparison,
          recordedBalancePaise: result.recordedBalancePaise,
          differencePaise,
          correction:
            differencePaise === 0
              ? null
              : {
                  type: differencePaise > 0 ? "adjustment_in" : "adjustment_out",
                  amountPaise: Math.abs(differencePaise),
                },
        });
        setIds({ check: newId(), correction: newId() });
        setNotice(result.message);
      } else {
        setError({ message: result.message });
      }
    } catch {
      setError({ message: NEEDS_CONNECTION });
    } finally {
      setPending(false);
    }
  }

  const d = comparison?.differencePaise ?? 0;
  return (
    <div className="flex flex-col gap-4" data-testid="check-balance">
      <form onSubmit={compare} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <MoneyField
            id="check-amount"
            name="amount"
            label={amountLabel}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setComparison(null);
            }}
            hint="What your bank, UPI app or wallet shows."
            error={error?.field === "amount" ? error.message : undefined}
          />
          <Field
            id="check-date"
            name="date"
            label="On"
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              setDate(e.target.value);
              setWhenChanged(true);
              setComparison(null);
            }}
            error={error?.field === "when" ? error.message : undefined}
          />
          <Field
            id="check-time"
            name="time"
            label="At"
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setWhenChanged(true);
              setComparison(null);
            }}
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending} className="self-start">
          {pending && !comparison && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          Compare
        </Button>
      </form>

      {error && !error.field && <Notice tone="warning">{error.message}</Notice>}
      {notice && <Notice tone="info">{notice}</Notice>}

      {comparison && (
        <div className="flex flex-col gap-3 border-t pt-4" data-testid="check-result">
          <dl className="grid grid-cols-3 gap-2 type-body">
            <div>
              <dt className="type-caption text-muted-foreground">Recorded</dt>
              <dd className="money" data-testid="check-recorded">
                {money(comparison.recordedBalancePaise)}
              </dd>
            </div>
            <div>
              <dt className="type-caption text-muted-foreground">Real</dt>
              <dd className="money">{money(comparison.statedBalancePaise)}</dd>
            </div>
            <div>
              <dt className="type-caption text-muted-foreground">Difference</dt>
              <dd className="money" data-testid="check-difference" data-paise={d}>
                {d > 0 ? "+" : ""}
                {money(d)}
              </dd>
            </div>
          </dl>
          {comparison.inPast && (
            <Notice tone="info">
              This check is dated in the past. A correction would change balances and reports from
              then on.
            </Notice>
          )}
          {d === 0 ? (
            <Button onClick={() => save(false)} disabled={pending} className="self-start">
              Save check: it matches
            </Button>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h3 className="type-body font-medium">Find it</h3>
                {comparison.hints.length > 0 ? (
                  <ul className="flex list-disc flex-col gap-1 pl-5 type-body">
                    {comparison.hints.map((hint) => (
                      <li key={hint.kind}>
                        {hint.message}{" "}
                        {hint.transactionIds.length === 1 && (
                          <Link
                            href={`/transactions/${hint.transactionIds[0]}`}
                            className="underline underline-offset-4"
                          >
                            Open it
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="type-body text-muted-foreground">
                    No obvious cause. Look through the entries since your last check.
                  </p>
                )}
                <Button variant="outline" asChild className="self-start">
                  <Link href={comparison.findHref}>See {accountName}’s entries</Link>
                </Button>
                <p className="type-caption text-muted-foreground">
                  After fixing an entry, check the balance again.
                </p>
              </div>
              <div className="flex flex-col gap-2 border-t pt-3">
                <h3 className="type-body font-medium">Or record one correction</h3>
                <p className="type-caption text-muted-foreground">
                  One entry of {money(Math.abs(d))} labelled “Balance correction”. Not income, not
                  spending. You can undo or delete it later.
                </p>
                <Button onClick={() => save(true)} disabled={pending} className="self-start">
                  {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                  Record a correction of {d > 0 ? "+" : "−"}
                  {money(Math.abs(d))}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
