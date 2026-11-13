import type { Route } from "next";
import {
  ChartPie,
  CircleUserRound,
  FileText,
  House,
  MessageSquareText,
  Mic,
  Receipt,
  Settings,
  SlidersHorizontal,
  SquarePen,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: Route;
  label: string;
  /** Sidebar, bottom bar and sheet rows draw it; hub tabs are text only. */
  icon?: LucideIcon;
  /** Extra path prefixes that should also mark this item active (a hub's other screens). */
  also?: readonly string[];
  /** A progression screen: hidden from navigation when progress features are off (Settings). */
  progress?: true;
};

export type AddItem = NavItem & { icon: LucideIcon; hint: string };

/**
 * The hubs' tabs (doc/V2_SPEC.md §6.2). Only screens that exist today: the Insights hub gets Feed
 * and Reviews when those screens are built (Phase 4). The first tab is where the hub link goes.
 */
export const HUB_TABS = {
  insights: [
    { href: "/insights", label: "Insights", also: ["/insights/category"] },
    { href: "/insights/leaks", label: "Money leaks" },
  ],
  plan: [
    { href: "/budgets", label: "Budgets" },
    { href: "/goals", label: "Goals" },
    { href: "/safe-to-spend", label: "Safe to Spend" },
    { href: "/survival", label: "Survival Mode" },
    { href: "/recurring", label: "Recurring" },
  ],
  player: [
    { href: "/rewards/status", label: "Player status", progress: true },
    { href: "/rewards/missions", label: "Missions", progress: true },
    { href: "/rewards/achievements", label: "Achievements", progress: true },
    { href: "/rewards", label: "Rewards", progress: true },
  ],
  manage: [
    { href: "/accounts", label: "Accounts" },
    { href: "/categories", label: "Categories" },
    { href: "/reminders", label: "Reminders" },
  ],
} as const satisfies Record<string, readonly NavItem[]>;

export type Hub = keyof typeof HUB_TABS;

/** Every path a hub covers, so its sidebar link stays active on each tab and detail page. */
function hubPaths(hub: Hub): string[] {
  return HUB_TABS[hub].flatMap((tab: NavItem) => [tab.href, ...(tab.also ?? [])]);
}

const HOME: NavItem = { href: "/home", label: "Home", icon: House };
const TRANSACTIONS: NavItem = { href: "/transactions", label: "Transactions", icon: Receipt };
const INSIGHTS: NavItem = {
  href: "/insights",
  label: "Insights",
  icon: ChartPie,
  also: hubPaths("insights"),
};
const PLAN: NavItem = { href: "/budgets", label: "Plan", icon: Target, also: hubPaths("plan") };
const PLAYER: NavItem = {
  href: "/rewards/status",
  label: "Player",
  icon: CircleUserRound,
  also: hubPaths("player"),
  progress: true,
};
const REPORTS: NavItem = { href: "/reports", label: "Reports", icon: FileText };
const MANAGE: NavItem = {
  href: "/accounts",
  label: "Manage",
  icon: SlidersHorizontal,
  also: hubPaths("manage"),
};
const SETTINGS: NavItem = { href: "/settings", label: "Settings", icon: Settings };

/** The desktop sidebar: eight destinations, no group headings. */
export const SIDEBAR_ITEMS: readonly NavItem[] = [
  HOME,
  TRANSACTIONS,
  INSIGHTS,
  PLAN,
  PLAYER,
  REPORTS,
  MANAGE,
  SETTINGS,
];

/** The phone bar's link tabs: Home · Transactions · (Add) · Insights · Plan · (More). */
export const MOBILE_TABS: readonly NavItem[] = [HOME, TRANSACTIONS, INSIGHTS, PLAN];

/** The phone bar's More sheet. Player is also one tap away from Home's level strip. */
export const MORE_ITEMS: readonly NavItem[] = [PLAYER, REPORTS, MANAGE, SETTINGS];

/** The Add sheet: the four ways to record, fastest first. Also the tabs on the add screens. */
export const ADD_ITEMS: readonly AddItem[] = [
  { href: "/add", label: "Quick add", icon: Zap, hint: "One tap on a saved tile" },
  { href: "/add/text", label: "Type it", icon: MessageSquareText, hint: "“tea 20, auto 60”" },
  { href: "/add/voice", label: "Say it", icon: Mic, hint: "Speak, then check" },
  {
    href: "/transactions/new",
    label: "Full form",
    icon: SquarePen,
    hint: "Income, transfers, every field",
  },
];

function matchLength(pathname: string, prefix: string): number {
  if (pathname === prefix) return prefix.length;
  if (pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)) return prefix.length;
  return -1;
}

/**
 * Returns the item that best matches the pathname: the longest matching prefix wins, so
 * `/rewards/missions` activates Missions rather than Rewards.
 * Matches only on path-segment boundaries (`/goalsx` does not match `/goals`).
 */
export function findActiveItem<T extends NavItem>(
  pathname: string,
  items: readonly T[],
): T | undefined {
  let best: T | undefined;
  let bestLength = -1;
  for (const item of items) {
    for (const prefix of [item.href, ...(item.also ?? [])]) {
      const length = matchLength(pathname, prefix);
      if (length > bestLength) {
        best = item;
        bestLength = length;
      }
    }
  }
  return best;
}

/** Every destination navigation can reach: the sidebar, the hubs' tabs and the Add sheet. */
export const ALL_NAV_ITEMS: readonly NavItem[] = [
  ...SIDEBAR_ITEMS,
  ...Object.values(HUB_TABS).flat(),
  ...ADD_ITEMS,
];

/** Navigation without progression screens, for when progress features are off. */
export function visibleItems<T extends NavItem>(items: readonly T[], showProgress: boolean): T[] {
  return showProgress ? [...items] : items.filter((item) => !item.progress);
}
