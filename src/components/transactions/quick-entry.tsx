import Link from "next/link";
import { MessageSquareText, Mic } from "lucide-react";

import { Button } from "@/components/ui/button";
// The module itself, not the `@/domain` barrel: the barrel brings the schemas and `zod`
// into the browser's first load.
import type { CategoryChoice } from "@/domain/category-tree";
import { formatMoney } from "@/domain/money";
import type { EntryKit } from "@/lib/data/entry-kit";
import type { LedgerCommand } from "@/lib/ledger/commands";
import type { QuickEntry } from "@/lib/quick-entries";

/*
 * What a one-tap save needs at once: the command a tile records, its money label and the other
 * ways in. The confirm sheet (`quick-add-form`) loads on first use.
 */

/** The ways in for several entries at once, or for anything a tile doesn't cover. */
export function OtherEntryRoutes() {
  return (
    <nav aria-label="Other ways to add" className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="min-h-10 rounded-full" asChild>
        <Link href="/add/text">
          <MessageSquareText aria-hidden="true" />
          Type it
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="min-h-10 rounded-full" asChild>
        <Link href="/add/voice">
          <Mic aria-hidden="true" />
          Say it
        </Link>
      </Button>
    </nav>
  );
}

export function money(paise: number, kit: EntryKit) {
  return formatMoney(paise, { currency: kit.currency });
}

/**
 * The expense a tile, shortcut or the sheet records. The ids come from the caller and stay fixed
 * for one save, so a double tap or a retry replays the same entry instead of adding another.
 */
export function quickEntryCommand(
  entry: QuickEntry,
  kit: EntryKit,
  values: {
    ids: { id: string; opId: string };
    amountPaise: number;
    occurredAt: string;
    accountId?: string;
    category?: CategoryChoice;
    description?: string | null;
  },
): LedgerCommand {
  const active = kit.accounts.some((a) => a.id === entry.accountId && !a.archivedAt);
  const category = values.category ?? {
    categoryId: entry.categoryId!,
    subcategoryId: entry.subcategoryId,
  };
  return {
    kind: "create",
    opId: values.ids.opId,
    draft: {
      id: values.ids.id,
      type: "expense",
      amountPaise: values.amountPaise,
      currency: kit.currency,
      occurredAt: values.occurredAt,
      accountId: values.accountId ?? (active ? entry.accountId! : kit.defaultAccountId),
      fromAccountId: null,
      toAccountId: null,
      refundOfId: null,
      categoryId: category.categoryId,
      subcategoryId: category.subcategoryId,
      description: values.description !== undefined ? values.description : entry.description,
      merchant: entry.merchant,
      note: null,
      tags: [],
      source: "quick_add",
      presetId: entry.groupPresetId,
    },
  };
}
