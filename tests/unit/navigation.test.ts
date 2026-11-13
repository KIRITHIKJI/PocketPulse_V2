import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { Route } from "next";

import {
  ADD_ITEMS,
  ALL_NAV_ITEMS,
  HUB_TABS,
  MOBILE_TABS,
  MORE_ITEMS,
  SIDEBAR_ITEMS,
  findActiveItem,
  visibleItems,
} from "@/lib/navigation";

/** Secondary routes that exist but are not navigation items. */
const AUX_ROUTES = {
  welcome: "/welcome",
  onboarding: "/onboarding",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  settingsPrivacy: "/settings/privacy",
  settingsSync: "/settings/sync",
  settingsData: "/settings/data",
} as const satisfies Record<string, Route>;

const APP_DIR = join(process.cwd(), "src", "app");

/** Resolves a URL path to a page file, looking through route groups like `(app)`. */
function pageExists(path: string, dir = APP_DIR): boolean {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return existsSync(join(dir, "page.tsx"));
  const [head, ...rest] = segments;
  const restPath = `/${rest.join("/")}`;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry.startsWith("(") && entry.endsWith(")") && pageExists(path, full)) return true;
    const isDynamic = entry.startsWith("[") && entry.endsWith("]");
    if ((entry === head || isDynamic) && pageExists(restPath, full)) return true;
  }
  return false;
}

describe("findActiveItem", () => {
  it("prefers the most specific match", () => {
    expect(findActiveItem("/rewards/missions", HUB_TABS.player)?.label).toBe("Missions");
    expect(findActiveItem("/rewards", HUB_TABS.player)?.label).toBe("Rewards");
    expect(findActiveItem("/add/text", ADD_ITEMS)?.label).toBe("Type it");
    expect(findActiveItem("/add", ADD_ITEMS)?.label).toBe("Quick add");
    expect(findActiveItem("/insights/leaks", HUB_TABS.insights)?.label).toBe("Money leaks");
    expect(findActiveItem("/insights/category/abc", HUB_TABS.insights)?.label).toBe("Insights");
  });

  it("only matches on path-segment boundaries", () => {
    expect(findActiveItem("/goalsx", SIDEBAR_ITEMS)).toBeUndefined();
    expect(findActiveItem("/homepage", MOBILE_TABS)).toBeUndefined();
  });

  it("keeps a hub's sidebar link active on each of its tabs and detail pages", () => {
    const hubOf = (path: string) => findActiveItem(path, SIDEBAR_ITEMS)?.label;
    for (const path of [
      "/budgets",
      "/goals",
      "/goals/abc",
      "/safe-to-spend",
      "/survival",
      "/recurring",
    ]) {
      expect(hubOf(path), path).toBe("Plan");
    }
    for (const path of [
      "/rewards",
      "/rewards/status",
      "/rewards/missions",
      "/rewards/achievements",
    ]) {
      expect(hubOf(path), path).toBe("Player");
    }
    for (const path of ["/accounts", "/accounts/abc", "/categories", "/reminders"]) {
      expect(hubOf(path), path).toBe("Manage");
    }
    for (const path of ["/insights", "/insights/leaks", "/insights/category/abc"]) {
      expect(hubOf(path), path).toBe("Insights");
    }
    expect(hubOf("/transactions/abc-123")).toBe("Transactions");
    expect(hubOf("/settings/privacy")).toBe("Settings");
    expect(hubOf("/reports")).toBe("Reports");
  });

  it("maps every hub screen to its phone tab, or to More", () => {
    for (const path of ["/budgets", "/goals", "/safe-to-spend", "/survival", "/recurring"]) {
      expect(findActiveItem(path, MOBILE_TABS)?.label, path).toBe("Plan");
    }
    expect(findActiveItem("/insights/leaks", MOBILE_TABS)?.label).toBe("Insights");
    expect(findActiveItem("/settings", MOBILE_TABS)).toBeUndefined();
    expect(findActiveItem("/categories", MORE_ITEMS)?.label).toBe("Manage");
    expect(findActiveItem("/rewards/missions", MORE_ITEMS)?.label).toBe("Player");
  });
});

describe("navigation structure (doc/V2_SPEC.md §6.2)", () => {
  it("has eight sidebar links and no others", () => {
    expect(SIDEBAR_ITEMS.map((item) => item.label)).toEqual([
      "Home",
      "Transactions",
      "Insights",
      "Plan",
      "Player",
      "Reports",
      "Manage",
      "Settings",
    ]);
    // A hub link opens the hub's first tab.
    expect(findActiveItem("/budgets", SIDEBAR_ITEMS)?.href).toBe(HUB_TABS.plan[0].href);
    expect(findActiveItem("/rewards/status", SIDEBAR_ITEMS)?.href).toBe(HUB_TABS.player[0].href);
    expect(findActiveItem("/accounts", SIDEBAR_ITEMS)?.href).toBe(HUB_TABS.manage[0].href);
    expect(findActiveItem("/insights", SIDEBAR_ITEMS)?.href).toBe(HUB_TABS.insights[0].href);
  });

  it("has the hubs' tabs from the spec, without screens that don't exist yet", () => {
    const labels = (hub: keyof typeof HUB_TABS) => HUB_TABS[hub].map((tab) => tab.label);
    expect(labels("insights")).toEqual(["Insights", "Money leaks"]);
    expect(labels("plan")).toEqual([
      "Budgets",
      "Goals",
      "Safe to Spend",
      "Survival Mode",
      "Recurring",
    ]);
    expect(labels("player")).toEqual(["Player status", "Missions", "Achievements", "Rewards"]);
    expect(labels("manage")).toEqual(["Accounts", "Categories", "Reminders"]);
  });

  it("has the phone bar's link tabs, a More sheet, and the Add sheet's four ways", () => {
    expect(MOBILE_TABS.map((tab) => tab.label)).toEqual([
      "Home",
      "Transactions",
      "Insights",
      "Plan",
    ]);
    expect(MORE_ITEMS.map((item) => item.label)).toEqual([
      "Player",
      "Reports",
      "Manage",
      "Settings",
    ]);
    expect(ADD_ITEMS.map((item) => [item.label, item.href])).toEqual([
      ["Quick add", "/add"],
      ["Type it", "/add/text"],
      ["Say it", "/add/voice"],
      ["Full form", "/transactions/new"],
    ]);
  });

  it("with progress features off, no progression screen is in navigation", () => {
    const hrefs = (show: boolean) =>
      [
        ...visibleItems(SIDEBAR_ITEMS, show),
        ...visibleItems(MORE_ITEMS, show),
        ...visibleItems(HUB_TABS.player, show),
      ].map((item) => item.href);
    expect(hrefs(false).some((href) => href.startsWith("/rewards"))).toBe(false);
    expect(hrefs(false)).toEqual(expect.arrayContaining(["/reports", "/settings", "/home"]));
    expect(hrefs(true)).toEqual(expect.arrayContaining(["/rewards/status", "/rewards"]));
  });

  it("has no duplicate destinations in any one menu", () => {
    for (const items of [
      SIDEBAR_ITEMS,
      MOBILE_TABS,
      MORE_ITEMS,
      ADD_ITEMS,
      ...Object.values(HUB_TABS),
    ]) {
      const hrefs = items.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });

  it.each([...new Set([...ALL_NAV_ITEMS.map((item) => item.href), ...Object.values(AUX_ROUTES)])])(
    "route %s has a page",
    (href) => {
      expect(pageExists(href)).toBe(true);
    },
  );
});

describe("spec §5 screen coverage", () => {
  // Every screen listed in PROJECT_SPEC.md §5 must have a reachable route.
  const SCREENS: Record<string, string[]> = {
    "Welcome/onboarding": ["/welcome", "/onboarding"],
    "Registration, login, password recovery": [
      "/register",
      "/login",
      "/forgot-password",
      "/reset-password",
    ],
    "Dashboard/Home": ["/home"],
    "Quick-add interface": ["/add"],
    "Full transaction form": ["/transactions/new"],
    "Natural-language entry and preview": ["/add/text"],
    "Voice entry and preview": ["/add/voice"],
    "Transaction history, detail, edit": [
      "/transactions",
      "/transactions/some-id",
      "/transactions/some-id/edit",
    ],
    "Categories and subcategories management": ["/categories"],
    "Spending Insights and charts": ["/insights"],
    "Money Leak Detector": ["/insights/leaks"],
    Budgets: ["/budgets"],
    "Savings goals and pockets": ["/goals"],
    "Safe-to-Spend calculator": ["/safe-to-spend"],
    "Pocket-Money Survival Mode": ["/survival"],
    "Income and recurring templates": ["/recurring"],
    "Parent Report Mode": ["/reports"],
    Gamification: ["/rewards"],
    "Reminders/notifications": ["/reminders"],
    "Profile, preferences, privacy, sync, data export, deletion": [
      "/settings",
      "/settings/privacy",
      "/settings/sync",
      "/settings/data",
    ],
  };

  it.each(Object.entries(SCREENS))("%s", (_screen, routes) => {
    for (const route of routes) expect(pageExists(route), route).toBe(true);
  });
});
