"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, History, LoaderCircle, Repeat2 } from "lucide-react";

import { CategoryBadge } from "@/components/categories/category-icon";
import { useToast } from "@/components/feedback/toast";
import { OtherEntryRoutes, money, quickEntryCommand } from "@/components/transactions/quick-entry";
import { useLedger } from "@/components/transactions/use-ledger";
import { Button } from "@/components/ui/button";
import { lazyModule, useLazyModule } from "@/hooks/use-lazy-module";
import type { EntryKit } from "@/lib/data/entry-kit";
import { newId } from "@/lib/ids";
import {
  type QuickEntry,
  type QuickShortcut,
  type TapIds,
  idsForTap,
  savesInOneTap,
} from "@/lib/quick-entries";
import { cn } from "@/lib/utils";

/** A one-tap save stays undoable this long (the sheet's saves keep the usual 8 s). */
const ONE_TAP_UNDO_MS = 5_000;
/** How long a tile shows its check after a save. */
const SAVED_MS = 900;

const SHEET_UNAVAILABLE = "Couldn’t open this without a connection. Try Type it, or try again.";

/** The confirm sheet: loaded on first use, and preloaded once the page is idle. */
const loadSheet = lazyModule(() => import("@/components/transactions/quick-add-form"));

type TileState = "idle" | "saving" | "saved";

/**
 * Tiles + "log again" shortcuts, and the sheet that confirms an amount. A tile with a usual amount
 * and a category saves in one tap; a tile without an amount opens the sheet. "Edit tiles" turns
 * every tap into the sheet (a different amount, or a new usual one) and links to the tile editor.
 * With `visible`, only that many tiles show until "More" reveals the rest and the shortcuts.
 */
export function QuickAdd({
  kit,
  tiles,
  shortcuts,
  visible,
  title,
  showRoutes = false,
}: {
  kit: EntryKit;
  tiles: QuickEntry[];
  shortcuts: QuickShortcut[];
  /** Home: how many tiles show before "More" (the most used come first). */
  visible?: number;
  /** Home: a heading for the section, with Edit tiles beside it instead of under the tiles. */
  title?: { text: string; id: string };
  /** Home: also link to Type it and Say it (Quick add has them as tabs). */
  showRoutes?: boolean;
}) {
  const { run } = useLedger();
  const { show } = useToast();
  const { module: sheet, load } = useLazyModule(loadSheet);
  const [active, setActive] = React.useState<QuickEntry | null>(null);
  const [openCount, setOpenCount] = React.useState(0);
  const [states, setStates] = React.useState<Record<string, TileState>>({});
  const [editing, setEditing] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const taps = React.useRef(new Map<string, TapIds>());
  const gridId = React.useId();

  const hiddenCount = visible === undefined ? 0 : Math.max(0, tiles.length - visible);
  const shown = expanded || hiddenCount === 0 ? tiles : tiles.slice(0, visible);
  const showShortcuts = shortcuts.length > 0 && (hiddenCount === 0 || expanded);

  const editToggle = (
    <Button
      variant="ghost"
      size="sm"
      className="min-h-10 aria-pressed:bg-accent aria-pressed:text-accent-foreground"
      aria-pressed={editing}
      onClick={() => setEditing((on) => !on)}
    >
      Edit tiles
    </Button>
  );

  async function open(entry: QuickEntry) {
    setOpenCount((n) => n + 1);
    setActive(entry);
    if (!sheet && (await load()) === null) {
      setActive(null);
      show({ tone: "error", message: SHEET_UNAVAILABLE });
    }
  }
  const setState = (key: string, state: TileState) =>
    setStates((current) => ({ ...current, [key]: state }));

  async function tap(tile: QuickEntry) {
    if (editing || !savesInOneTap(tile)) return open(tile);
    const ids = idsForTap(taps.current.get(tile.key) ?? null, newId);
    taps.current.set(tile.key, ids);
    setState(tile.key, "saving");
    const result = await run(
      quickEntryCommand(tile, kit, {
        ids,
        amountPaise: tile.amountPaise!,
        occurredAt: new Date(ids.at).toISOString(),
      }),
      {
        success: `Saved ${money(tile.amountPaise!, kit)} · ${tile.title}`,
        label: tile.title,
        routine: true,
        undoMs: ONE_TAP_UNDO_MS,
      },
    );
    // `null`: a second tap while the first is still sending. The first one reports.
    if (result === null) return;
    setState(tile.key, result.ok ? "saved" : "idle");
    if (result.ok) window.setTimeout(() => setState(tile.key, "idle"), SAVED_MS);
  }

  return (
    <div className="flex flex-col gap-3">
      {title && (
        <div className="-mb-1 flex items-center justify-between gap-3">
          <h2 id={title.id} className="type-heading">
            {title.text}
          </h2>
          <span className="-mr-3">{editToggle}</span>
        </div>
      )}
      {editing && (
        <div
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-(--finance-inset) py-1.5 pr-1.5 pl-3"
          data-testid="tile-edit-hint"
        >
          <p className="type-caption text-text-secondary">
            Tap a tile to log a different amount. The sheet can keep it as the usual one.
          </p>
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/add?tab=edit">Add, hide or reorder</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Done
            </Button>
          </span>
        </div>
      )}

      <ul
        id={gridId}
        aria-label="Quick-add tiles"
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
      >
        {shown.map((tile) => (
          <QuickTile
            key={tile.key}
            tile={tile}
            kit={kit}
            editing={editing}
            state={states[tile.key] ?? "idle"}
            onTap={() => void tap(tile)}
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-10"
            aria-expanded={expanded}
            aria-controls={gridId}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Fewer" : `More (${hiddenCount})`}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "transition-transform duration-(--duration-quick)",
                expanded && "rotate-180",
              )}
            />
          </Button>
        )}
        {showRoutes && <OtherEntryRoutes />}
        {!title && <span className="ml-auto">{editToggle}</span>}
      </div>

      {showShortcuts && (
        <div className="flex flex-col gap-2">
          <h3 className="type-caption font-medium text-muted-foreground">Log again</h3>
          <ul className="flex flex-wrap gap-2">
            {shortcuts.map(({ kind, count, entry }) => (
              <li key={`${kind}-${entry.key}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-10 rounded-full py-1.5"
                  onClick={() => void open(entry)}
                  aria-label={
                    kind === "repeat"
                      ? `Repeat ${entry.title} ${money(entry.amountPaise ?? 0, kit)}: your last expense`
                      : `${entry.title} ${money(entry.amountPaise ?? 0, kit)}${count ? ` · ${count}×` : ""}: log again`
                  }
                >
                  {kind === "repeat" ? (
                    <Repeat2 aria-hidden="true" />
                  ) : (
                    <History aria-hidden="true" />
                  )}
                  <span className="max-w-40 truncate">
                    {kind === "repeat" ? "Repeat " : ""}
                    {entry.title}
                  </span>
                  <span className="text-muted-foreground money">
                    {money(entry.amountPaise ?? 0, kit)}
                    {count ? ` · ${count}×` : ""}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet && (
        <sheet.QuickAddSheet
          entry={active}
          openCount={openCount}
          kit={kit}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function QuickTile({
  tile,
  kit,
  editing,
  state,
  onTap,
}: {
  tile: QuickEntry;
  kit: EntryKit;
  editing: boolean;
  state: TileState;
  onTap: () => void;
}) {
  const ready = savesInOneTap(tile);
  const amount = tile.amountPaise !== null ? money(tile.amountPaise, kit) : null;
  // A tile without a usual amount shows only its name; tapping it asks for the amount.
  const hint = tile.askDetails ? "Any item" : amount;
  const label = editing
    ? `Change ${tile.title}${amount ? `, usually ${amount}` : ""}`
    : ready
      ? `${tile.title}, ${amount}. Saves in one tap`
      : tile.askDetails
        ? `${tile.title}. Any item: enter what it was`
        : `${tile.title}. Enter the amount`;
  return (
    <li data-state={state}>
      <button
        type="button"
        onClick={onTap}
        aria-label={label}
        aria-busy={state === "saving" || undefined}
        data-ready={ready || undefined}
        className={cn(
          "flex h-full min-h-22 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-transparent bg-(--finance-inset) px-2 py-3 text-center transition-[background-color,border-color,transform] duration-(--duration-quick) outline-none select-none hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] active:duration-(--duration-instant)",
          editing && "border-dashed border-border-strong",
          state === "saved" && "border-feedback-success/50",
        )}
      >
        <span className="relative">
          <CategoryBadge icon={tile.icon} color={tile.color} size="sm" />
          {state === "saved" && (
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center rounded-lg bg-feedback-success text-positive-foreground"
            >
              <Check className="size-4" />
            </span>
          )}
        </span>
        <span className="line-clamp-1 type-body font-medium">{tile.title}</span>
        {hint || state === "saving" ? (
          <span
            className={cn(
              "flex items-center gap-1 type-caption money",
              ready ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {state === "saving" ? (
              <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
            ) : null}
            {hint}
          </span>
        ) : null}
      </button>
    </li>
  );
}
