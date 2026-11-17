"use client";

import * as React from "react";
import { CircleCheck, Sparkles } from "lucide-react";

import { CategoryPicker, type PickerNode } from "@/components/categories/category-picker";
import { ActionForm, FormMessage, SubmitButton } from "@/components/forms/form-parts";
import { InlineAction } from "@/components/forms/inline-action";
import { StatePanel } from "@/components/states/state-panel";
import { assignCategory } from "@/lib/actions/categories";
import { IDLE } from "@/lib/form-state";

export type QueueItem = {
  id: string;
  version: number;
  amountLabel: string;
  dateLabel: string;
  description: string | null;
  merchant: string | null;
  suggestion: {
    categoryId: string;
    subcategoryId: string | null;
    label: string;
    reason: string;
  } | null;
};

function QueueRow({ item, tree }: { item: QueueItem; tree: PickerNode[] }) {
  const [state, formAction, pending] = React.useActionState(assignCategory, IDLE);
  const title = item.description || item.merchant || "No description";
  const rememberText = item.description ?? "";
  return (
    <li className="flex min-w-0 flex-col gap-3 border-b border-(--section-divider) py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate type-body font-medium">{title}</p>
          <p className="type-caption text-muted-foreground">
            {item.dateLabel}
            {item.merchant && item.description ? ` · ${item.merchant}` : ""}
          </p>
        </div>
        <p className="shrink-0 type-body font-semibold money">{item.amountLabel}</p>
      </div>

      {item.suggestion && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-(--finance-inset) p-3">
          <Sparkles className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <p className="min-w-0 flex-1 type-body">
            Suggested: <span className="font-medium">{item.suggestion.label}</span>
            <span className="block type-caption text-muted-foreground">
              {item.suggestion.reason}
            </span>
          </p>
          <InlineAction
            action={assignCategory}
            fields={{
              transactionId: item.id,
              version: String(item.version),
              categoryId: item.suggestion.categoryId,
              subcategoryId: item.suggestion.subcategoryId ?? "",
            }}
            pendingLabel="Saving…"
            variant="default"
          >
            <CircleCheck aria-hidden="true" />
            Use this
          </InlineAction>
        </div>
      )}

      <ActionForm action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="transactionId" value={item.id} />
        <input type="hidden" name="version" value={item.version} />
        <input type="hidden" name="rememberText" value={rememberText} />
        <FormMessage state={state} />
        <CategoryPicker
          id={`queue-${item.id}`}
          label={item.suggestion ? "Or choose" : "Category"}
          tree={tree}
          error={state.fieldErrors?.categoryId}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          {rememberText.trim() ? (
            <label className="flex min-h-11 items-center gap-2 type-body">
              <input type="checkbox" name="remember" className="size-4 accent-[var(--primary)]" />
              Remember for “{rememberText}”
            </label>
          ) : (
            <span />
          )}
          <SubmitButton pending={pending} pendingLabel="Saving…" size="sm" variant="outline">
            Save category
          </SubmitButton>
        </div>
      </ActionForm>
    </li>
  );
}

/** Expenses without a category. Each can take the suggestion or a manual choice. */
export function UncategorizedQueue({ items, tree }: { items: QueueItem[]; tree: PickerNode[] }) {
  if (items.length === 0) {
    return (
      <StatePanel
        size="section"
        icon={CircleCheck}
        title="Nothing waiting"
        description="Nothing to sort. Every expense has a category."
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="type-body text-text-secondary">
        {items.length} {items.length === 1 ? "expense needs" : "expenses need"} a category. They
        already count in your balance and totals as “Uncategorized”.
      </p>
      <ul className="grid max-w-5xl md:grid-cols-2 md:gap-x-12">
        {items.map((item) => (
          <QueueRow key={`${item.id}-${item.version}`} item={item} tree={tree} />
        ))}
      </ul>
    </div>
  );
}
