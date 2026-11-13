import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BottomNav } from "@/components/layout/bottom-nav";
import { AppearanceSettings } from "@/components/preferences/appearance-settings";
import { AppProviders } from "@/components/providers/app-providers";
import { StatePanel } from "@/components/states/state-panel";
import { MOTION_STORAGE_KEY } from "@/lib/motion-preference";

const pathname = vi.hoisted(() => ({ current: "/home" }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn() }),
}));

describe("StatePanel", () => {
  it("announces errors and permission problems, but not plain empty states", () => {
    const { rerender } = render(<StatePanel variant="error" title="Failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");

    rerender(<StatePanel variant="denied" title="No access" />);
    expect(screen.getByRole("alert")).toHaveTextContent("No access");

    rerender(<StatePanel variant="offline" title="Offline" />);
    expect(screen.getByRole("status")).toHaveTextContent("Offline");

    rerender(<StatePanel title="Nothing yet" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("heading", { name: "Nothing yet" })).toBeInTheDocument();
  });
});

describe("BottomNav", () => {
  it("has Home, Transactions, a docked Add, Insights, Plan and More, and marks the current tab", () => {
    pathname.current = "/goals";
    render(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const names = within(nav)
      .getAllByRole("listitem")
      .map((item) => {
        const control = item.querySelector("a, button")!;
        return control.getAttribute("aria-label") ?? control.textContent;
      });
    expect(names).toEqual(["Home", "Transactions", "Add expense", "Insights", "Plan", "More"]);
    expect(screen.getByRole("link", { name: "Plan" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Add expense" })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
  });

  it("Add opens a sheet with the four ways to record", async () => {
    pathname.current = "/home";
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    const ways = await screen.findByRole("navigation", { name: "Ways to add" });
    expect(
      within(ways)
        .getAllByRole("link")
        .map((link) => [link.querySelector("span span")?.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Quick add", "/add"],
      ["Type it", "/add/text"],
      ["Say it", "/add/voice"],
      ["Full form", "/transactions/new"],
    ]);
  });

  it("More opens a sheet with Player, Reports, Manage and Settings, each hub's screens under it", async () => {
    pathname.current = "/categories";
    const user = userEvent.setup();
    render(<BottomNav />);
    expect(screen.getByRole("button", { name: "More" })).toHaveClass("text-primary");
    await user.click(screen.getByRole("button", { name: "More" }));
    const more = await screen.findByRole("navigation", { name: "More" });
    expect(within(more).getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/reports");
    expect(within(more).getByRole("link", { name: "Player" })).toHaveAttribute(
      "href",
      "/rewards/status",
    );
    expect(within(more).getByRole("link", { name: "Manage" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Two taps from the bar: More, then the screen.
    expect(
      within(within(more).getByRole("list", { name: "Manage screens" })).getByRole("link", {
        name: "Categories",
      }),
    ).toHaveAttribute("href", "/categories");
    expect(within(more).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("with progress features off, the More sheet has no progression links", async () => {
    pathname.current = "/home";
    const user = userEvent.setup();
    render(<BottomNav showProgress={false} />);
    await user.click(screen.getByRole("button", { name: "More" }));
    const more = await screen.findByRole("navigation", { name: "More" });
    expect(
      within(more).queryByRole("link", { name: /Player|Missions|Achievements|Rewards/ }),
    ).toBeNull();
    expect(within(more).getByRole("link", { name: "Reports" })).toBeInTheDocument();
  });
});

describe("AppearanceSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.motion;
  });

  it("persists the motion preference and applies it to the document", async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <AppearanceSettings />
      </AppProviders>,
    );
    const motion = screen.getByRole("radiogroup", { name: "Motion" });
    const reduced = within(motion).getByRole("radio", { name: "Reduced" });

    await user.click(reduced);
    expect(reduced).toBeChecked();
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe("reduce");
    expect(document.documentElement.dataset.motion).toBe("reduce");

    await user.click(within(motion).getByRole("radio", { name: "Match device" }));
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });

  it("switches theme between midnight and light", async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <AppearanceSettings />
      </AppProviders>,
    );
    const theme = screen.getByRole("radiogroup", { name: "Theme" });
    expect(theme.querySelector('[data-state="checked"]')).toHaveTextContent("Midnight");

    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement).toHaveClass("light");
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
