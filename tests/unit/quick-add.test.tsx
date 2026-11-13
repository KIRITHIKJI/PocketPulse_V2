import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/feedback/toast";
import { QuickAdd } from "@/components/transactions/quick-add";
import type { EntryKit } from "@/lib/data/entry-kit";
import type { LedgerCommand } from "@/lib/ledger/commands";
import { expense, id } from "./domain/fixtures";
import {
  DOUBLE_TAP_MS,
  type QuickEntry,
  idsForTap,
  mostUsedFirst,
  savesInOneTap,
} from "@/lib/quick-entries";
import { dropIndex, moveItem } from "@/lib/reorder";

const runLedgerCommand = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/transactions", () => ({ runLedgerCommand, saveQuickAdd: vi.fn() }));
vi.mock("@/components/offline/offline-provider", () => ({
  useOffline: () => ({ enqueue: vi.fn(), mustFollowQueue: () => false }),
}));
vi.mock("@/lib/offline/pwa", () => ({ savePagesSoon: vi.fn(), saveLoadedAssets: vi.fn() }));

const CASH = "00000000-0000-4000-8000-0000000000c1";
const FOOD = "00000000-0000-4000-8000-0000000000f1";

const tile = (over: Partial<QuickEntry> = {}): QuickEntry => ({
  key: "tea",
  presetId: "00000000-0000-4000-8000-000000000071",
  groupPresetId: "00000000-0000-4000-8000-000000000071",
  title: "Tea",
  icon: null,
  color: null,
  amountPaise: 1_500,
  categoryId: FOOD,
  subcategoryId: null,
  accountId: null,
  description: "Tea",
  merchant: null,
  askDetails: false,
  ...over,
});

const kit = {
  currency: "INR",
  timeZone: "Asia/Kolkata",
  today: "2026-11-06",
  accounts: [],
  defaultAccountId: CASH,
  expenseTree: [],
  incomeTree: [],
  categories: [],
  rules: [],
  history: [],
} as unknown as EntryKit;

describe("one-tap rules", () => {
  it("only a tile with an amount and a category saves in one tap", () => {
    expect(savesInOneTap(tile())).toBe(true);
    expect(savesInOneTap(tile({ amountPaise: null }))).toBe(false);
    expect(savesInOneTap(tile({ categoryId: null, askDetails: true }))).toBe(false);
  });

  it("a tap within the double-tap window reuses the ids; a later one is a new entry", () => {
    let n = 0;
    const id = () => `id-${++n}`;
    const first = idsForTap(null, id, 1_000);
    const double = idsForTap(first, id, 1_000 + DOUBLE_TAP_MS - 1);
    expect(double).toMatchObject({ id: first.id, opId: first.opId });
    const later = idsForTap(double, id, 1_000 + 2 * DOUBLE_TAP_MS);
    expect(later.id).not.toBe(first.id);
    expect(later.opId).not.toBe(first.opId);
  });
});

describe("Home's most used tiles", () => {
  const NOW = Date.parse("2026-11-10T12:00:00+05:30");
  const tiles = ["Tea", "Coffee", "Bus", "Lunch"].map((title, n) =>
    tile({ key: title, title, presetId: id(700 + n), groupPresetId: id(700 + n) }),
  );
  const used = (presetN: number, times: number, daysAgo = 1) =>
    Array.from({ length: times }, () => ({
      ...expense(1_000, { occurredAt: new Date(NOW - daysAgo * 86_400_000).toISOString() }),
      presetId: id(700 + presetN),
    }));
  const titles = (list: QuickEntry[]) => list.map((t) => t.title);

  it("without history keeps the user's order", () => {
    expect(titles(mostUsedFirst(tiles, [], NOW, 2))).toEqual(["Tea", "Coffee", "Bus", "Lunch"]);
  });

  it("puts the most used first, in the user's order, and the rest after", () => {
    const ledger = [...used(3, 4), ...used(2, 2), ...used(0, 1)];
    expect(titles(mostUsedFirst(tiles, ledger, NOW, 2))).toEqual(["Bus", "Lunch", "Tea", "Coffee"]);
  });

  it("only counts the frequent look-back, and no deleted entries", () => {
    const old = used(3, 5, 90);
    const deleted = used(2, 5).map((tx) => ({ ...tx, deletedAt: tx.createdAt }));
    expect(titles(mostUsedFirst(tiles, [...old, ...deleted, ...used(1, 1)], NOW, 1))).toEqual([
      "Coffee",
      "Tea",
      "Bus",
      "Lunch",
    ]);
  });
});

describe("reordering", () => {
  it("moves an item and clamps the target", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 1, 9)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("drops a dragged row where the pointer is", () => {
    const middles = [10, 30, 50, 70];
    expect(dropIndex(middles, 0, 5)).toBe(0);
    expect(dropIndex(middles, 0, 55)).toBe(2);
    expect(dropIndex(middles, 3, 15)).toBe(1);
    expect(dropIndex(middles, 1, 100)).toBe(3);
  });
});

describe("QuickAdd tiles", () => {
  beforeEach(() => {
    runLedgerCommand.mockReset();
    runLedgerCommand.mockImplementation(async (command: LedgerCommand) => ({
      ok: true,
      status: "applied",
      id: command.kind === "create" ? command.draft.id : null,
      undo:
        command.kind === "create" ? { kind: "delete", opId: "undo", id: command.draft.id } : null,
    }));
  });

  const renderTiles = (tiles: QuickEntry[], visible?: number) =>
    render(
      <ToastProvider>
        <QuickAdd kit={kit} tiles={tiles} shortcuts={[]} visible={visible} />
      </ToastProvider>,
    );

  it("a tile with a usual amount saves in one tap, with Undo", async () => {
    const user = userEvent.setup();
    renderTiles([tile()]);
    await user.click(screen.getByRole("button", { name: /^Tea, ₹15\. Saves in one tap/ }));
    expect(runLedgerCommand).toHaveBeenCalledOnce();
    const command = runLedgerCommand.mock.calls[0]![0] as LedgerCommand;
    expect(command).toMatchObject({
      kind: "create",
      draft: { amountPaise: 1_500, categoryId: FOOD, accountId: CASH, source: "quick_add" },
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveTextContent("Saved ₹15 · Tea");
    expect(toast).toHaveAttribute("data-tone", "success");
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("a fast double tap sends the same ids, so the server can't save two", async () => {
    const user = userEvent.setup();
    renderTiles([tile()]);
    const button = screen.getByRole("button", { name: /^Tea,/ });
    await user.dblClick(button);
    const sent = runLedgerCommand.mock.calls.map((c) => c[0] as LedgerCommand);
    expect(sent.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(sent.map((c) => (c.kind === "create" ? c.draft.id : null)));
    const ops = new Set(sent.map((c) => c.opId));
    expect(ids.size).toBe(1);
    expect(ops.size).toBe(1);
  });

  it("Undo for a one-tap save lasts 5 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderTiles([tile()]);
      await user.click(screen.getByRole("button", { name: /^Tea,/ }));
      await screen.findByTestId("toast");
      act(() => vi.advanceTimersByTime(4_900));
      expect(screen.getByTestId("toast")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(200));
      expect(screen.queryByTestId("toast")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a tile without an amount opens the sheet and offers to save it as the usual amount", async () => {
    const user = userEvent.setup();
    renderTiles([tile({ amountPaise: null })]);
    expect(screen.queryByText("Set amount")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tea. Enter the amount" }));
    expect(runLedgerCommand).not.toHaveBeenCalled();
    const sheet = await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Amount"), "15");
    expect(sheet).toHaveTextContent("Save ₹15 as the usual amount for Tea");
  });

  it("Edit tiles opens the sheet even for a one-tap tile, and links to the tile editor", async () => {
    const user = userEvent.setup();
    renderTiles([tile()]);
    const edit = screen.getByRole("button", { name: "Edit tiles" });
    await user.click(edit);
    expect(edit).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Add, hide or reorder" })).toHaveAttribute(
      "href",
      "/add?tab=edit",
    );
    await user.click(screen.getByRole("button", { name: "Change Tea, usually ₹15" }));
    expect(runLedgerCommand).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveValue("15");
    // Done leaves edit mode: the tile saves in one tap again.
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: /^Tea, ₹15. Saves in one tap/ })).toBeVisible();
  });

  it("shows the first tiles and More reveals the rest", async () => {
    const user = userEvent.setup();
    renderTiles(
      [tile(), tile({ key: "bus", title: "Bus" }), tile({ key: "lunch", title: "Lunch" })],
      2,
    );
    const grid = screen.getByRole("list", { name: "Quick-add tiles" });
    expect(grid.querySelectorAll("li")).toHaveLength(2);
    const more = screen.getByRole("button", { name: "More (1)" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.click(more);
    expect(grid.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Fewer" })).toHaveAttribute("aria-expanded", "true");
  });
});
