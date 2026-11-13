import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const changeQuest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/rewards", () => ({
  changeQuest,
  markWeekReviewed: vi.fn(),
}));

import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/feedback/toast";
import { MissionRow, currentObjective } from "@/components/rewards/progress-parts";
import type { MissionView } from "@/lib/rewards/view";

const sort: MissionView = {
  code: "categorise_week",
  title: "Clear Uncategorized",
  description: "Give every expense this week a category.",
  cadence: "weekly",
  xp: 20,
  target: 1,
  progress: 1,
  complete: true,
  skipped: false,
  toSort: 0,
};

describe("a completed mission", () => {
  it("keeps saying Completed, with no hint when nothing new needs sorting", () => {
    render(<MissionRow mission={sort} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByTestId("mission-to-sort")).toBeNull();
  });

  it("shows entries logged since as a separate hint, not as lost progress", () => {
    render(<MissionRow mission={{ ...sort, toSort: 2 }} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    const hint = screen.getByTestId("mission-to-sort");
    expect(hint).toHaveTextContent("2 new entries to sort");
    expect(hint).toHaveAttribute("href", "/categories?tab=uncategorized");
    expect(screen.queryByRole("button", { name: /Skip/ })).toBeNull();
  });

  it("says entry for one", () => {
    render(<MissionRow mission={{ ...sort, toSort: 1 }} />);
    expect(screen.getByTestId("mission-to-sort")).toHaveTextContent("1 new entry to sort");
  });
});

describe("an open mission in the journal", () => {
  const open: MissionView = {
    ...sort,
    code: "log_today",
    title: "Log today",
    cadence: "daily",
    xp: 5,
    progress: 0,
    complete: false,
  };

  it("has one main action, its reward as a tag, and Skip only inside the overflow menu", async () => {
    changeQuest.mockResolvedValue({ status: "success" });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ul>
          <MissionRow mission={open} />
        </ul>
      </ToastProvider>,
    );
    expect(screen.getByRole("link", { name: "Quick add" })).toHaveAttribute("href", "/add");
    expect(screen.getByText("+5 XP")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Skip/ })).toBeNull();
    expect(screen.queryByText("Completed")).toBeNull();

    await user.click(screen.getByRole("button", { name: "More for the Log today mission" }));
    await user.click(await screen.findByRole("menuitem", { name: "Skip this mission" }));
    expect(changeQuest).toHaveBeenCalledTimes(1);
    const form = changeQuest.mock.calls[0]![1] as FormData;
    expect(form.get("code")).toBe("log_today");
    expect(form.get("optOut")).toBe("true");
  });

  it("a done mission's glyph carries the seal; an open one's doesn't", () => {
    const { container, rerender } = render(<MissionRow mission={sort} />);
    expect(container.querySelector("[data-seal]")).not.toBeNull();
    rerender(
      <ToastProvider>
        <MissionRow mission={open} />
      </ToastProvider>,
    );
    expect(container.querySelector("[data-seal]")).toBeNull();
  });
});

describe("the current objective", () => {
  const m = (
    code: string,
    cadence: MissionView["cadence"],
    progress: number,
    target: number,
    extra: Partial<MissionView> = {},
  ): MissionView => ({
    ...sort,
    code,
    title: code,
    cadence,
    progress,
    target,
    complete: false,
    ...extra,
  });

  it("is the open mission closest to done", () => {
    const list = [m("a", "daily", 0, 1), m("b", "once", 15, 20), m("c", "once", 1, 4)];
    expect(currentObjective(list)?.code).toBe("b");
  });

  it("breaks ties by the shorter cadence, then the catalog order", () => {
    const list = [
      m("weekly1", "weekly", 0, 1),
      m("daily1", "daily", 0, 1),
      m("daily2", "daily", 0, 1),
    ];
    expect(currentObjective(list)?.code).toBe("daily1");
  });

  it("skips done and skipped missions, and is null when none is open", () => {
    const list = [
      m("a", "daily", 1, 1, { complete: true }),
      m("b", "daily", 0, 1, { skipped: true }),
    ];
    expect(currentObjective(list)).toBeNull();
    expect(currentObjective([...list, m("c", "weekly", 0, 1)])?.code).toBe("c");
  });
});
