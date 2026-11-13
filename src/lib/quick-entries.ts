/**
 * Builds the quick-add tiles and the "log again" shortcuts (repeat last expense, frequent
 * entries) from the user's presets and ledger. Pure; the screens only render the result.
 */
// The modules themselves, not the `@/domain` barrel: the barrel brings the schemas and `zod`
// into the browser's first load.
import { categoryLabel, resolveCategoryChoice } from "@/domain/category-tree";
import { isActive, occurredAtMs } from "@/domain/ledger";
import type { Category, ExpenseTransaction, Transaction } from "@/domain/schemas";
import { frequentExpenses, frequentExpensesSince, lastExpense } from "@/domain/shortcuts";
import type { Instant } from "@/domain/time";
import { CATEGORY_ICON_NAMES } from "@/lib/category-style";
import type { QuickAddPreset } from "@/lib/data/queries";

/** What the confirm sheet needs: a tile, "repeat last" or a frequent entry. */
export type QuickEntry = {
  key: string;
  /** Set for tiles: lets the sheet remember the amount as the tile's usual one. */
  presetId: string | null;
  /** The tile the saved entry belongs to: a repeat of a tile entry stays in that tile's group. */
  groupPresetId: string | null;
  title: string;
  icon: string | null;
  color: string | null;
  amountPaise: number | null;
  categoryId: string | null;
  subcategoryId: string | null;
  /** A repeat uses the original wallet when it's still active; otherwise the default wallet. */
  accountId: string | null;
  description: string | null;
  merchant: string | null;
  /** The custom tile: ask what it was and which category. */
  askDetails: boolean;
};

export type QuickShortcut = { kind: "repeat" | "frequent"; count?: number; entry: QuickEntry };

const ICONS = new Set<string>(CATEGORY_ICON_NAMES);

/** A tile's own icon if the app can draw it ("plus" from the seed reads as circle-plus). */
export function presetIcon(icon: string | null): string | null {
  if (icon === "plus") return "circle-plus";
  return icon && ICONS.has(icon) ? icon : null;
}

function style(
  choice: { categoryId: string | null; subcategoryId: string | null },
  byId: Map<string, Category>,
) {
  const main = choice.categoryId ? byId.get(choice.categoryId) : undefined;
  const sub = choice.subcategoryId ? byId.get(choice.subcategoryId) : undefined;
  return { icon: sub?.icon ?? main?.icon ?? null, color: sub?.color ?? main?.color ?? null };
}

export function tileEntries(presets: readonly QuickAddPreset[], categories: readonly Category[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return presets
    .filter((p) => !p.archived)
    .map((p): QuickEntry => {
      // Follows merges; an archived category leaves the tile asking for one.
      const choice = resolveCategoryChoice(p, byId, "expense");
      const look = choice ? style(choice, byId) : { icon: null, color: null };
      return {
        key: p.id,
        presetId: p.id,
        // A tile that asks what it was (the custom tile) has no meaning of its own to group by.
        groupPresetId: choice ? p.id : null,
        title: p.label,
        icon: presetIcon(p.icon) ?? look.icon,
        color: look.color,
        amountPaise: p.amountPaise,
        categoryId: choice?.categoryId ?? null,
        subcategoryId: choice?.subcategoryId ?? null,
        accountId: null,
        description: choice ? p.label : null,
        merchant: null,
        askDetails: choice === null,
      };
    });
}

/** How many tiles Home shows before "More". */
export const HOME_TILES = 6;

/**
 * Home's tiles: the `count` tiles used most in the "frequent" look-back come first, in the
 * user's own order so a tile doesn't jump under a thumb; the rest follow, also in that order.
 * Ties, and a new account without history, fall back to the user's order.
 */
export function mostUsedFirst(
  tiles: readonly QuickEntry[],
  ledger: readonly Transaction[],
  now: Instant,
  count: number = HOME_TILES,
): QuickEntry[] {
  const since = frequentExpensesSince(now);
  const uses = new Map<string, number>();
  for (const tx of ledger) {
    if (tx.type !== "expense" || !tx.presetId || !isActive(tx)) continue;
    const at = occurredAtMs(tx);
    if (at < since || at > now) continue;
    uses.set(tx.presetId, (uses.get(tx.presetId) ?? 0) + 1);
  }
  const usesOf = (tile: QuickEntry) => (tile.presetId ? (uses.get(tile.presetId) ?? 0) : 0);
  const top = new Set(
    tiles
      .map((tile, order) => ({ tile, order }))
      .sort((a, b) => usesOf(b.tile) - usesOf(a.tile) || a.order - b.order)
      .slice(0, count)
      .map(({ tile }) => tile.key),
  );
  return [...tiles.filter((t) => top.has(t.key)), ...tiles.filter((t) => !top.has(t.key))];
}

function fromExpense(tx: ExpenseTransaction, key: string, byId: Map<string, Category>): QuickEntry {
  const choice = resolveCategoryChoice(tx, byId, "expense");
  const label = choice ? categoryLabel(choice, byId) : null;
  return {
    key,
    presetId: null,
    groupPresetId: tx.presetId,
    title: tx.description || tx.merchant || label?.split(" › ").pop() || "Expense",
    ...(choice ? style(choice, byId) : { icon: null, color: null }),
    amountPaise: tx.amountPaise,
    categoryId: choice?.categoryId ?? null,
    subcategoryId: choice?.subcategoryId ?? null,
    accountId: tx.accountId,
    description: tx.description,
    merchant: tx.merchant,
    askDetails: choice === null,
  };
}

export function shortcutEntries(
  ledger: readonly Transaction[],
  categories: readonly Category[],
  now: Instant,
): QuickShortcut[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const shortcuts: QuickShortcut[] = [];
  const last = lastExpense(ledger);
  if (last) shortcuts.push({ kind: "repeat", entry: fromExpense(last, `repeat-${last.id}`, byId) });
  for (const group of frequentExpenses(ledger, now, { limit: 5 })) {
    if (last && group.template.id === last.id) continue;
    shortcuts.push({
      kind: "frequent",
      count: group.count,
      entry: fromExpense(group.template, `frequent-${group.key}`, byId),
    });
  }
  return shortcuts.slice(0, 5);
}

/** A tile saves in one tap only when it knows everything: an amount and a category. */
export function savesInOneTap(entry: QuickEntry): boolean {
  return entry.amountPaise !== null && entry.categoryId !== null && !entry.askDetails;
}

/** Taps on one tile closer together than this are one entry: a double tap, not two teas. */
export const DOUBLE_TAP_MS = 1_000;

export type TapIds = { id: string; opId: string; at: number };

/**
 * The ids for a tap. A tap within `DOUBLE_TAP_MS` of the last one reuses its ids, so the server
 * answers `duplicate` instead of saving a second entry (the same idempotency key as any retry).
 * A tap after that is a new entry.
 */
export function idsForTap(
  previous: TapIds | null,
  newId: () => string,
  now: number = Date.now(),
): TapIds {
  if (previous && now - previous.at < DOUBLE_TAP_MS) return { ...previous, at: now };
  return { id: newId(), opId: newId(), at: now };
}
