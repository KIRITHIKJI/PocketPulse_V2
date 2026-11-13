"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADD_ITEMS, HUB_TABS, findActiveItem, type Hub, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const TABS: Record<Hub | "add", { label: string; items: readonly NavItem[] }> = {
  insights: { label: "Insights screens", items: HUB_TABS.insights },
  plan: { label: "Plan screens", items: HUB_TABS.plan },
  player: { label: "Player screens", items: HUB_TABS.player },
  manage: { label: "Manage screens", items: HUB_TABS.manage },
  add: { label: "Ways to record", items: ADD_ITEMS },
};

export type HubTabsKey = keyof typeof TABS;

/**
 * A hub's screens as a row of text tabs over one divider, the current one underlined in violet.
 * On a narrow screen the row scrolls sideways inside itself; the page never does. Takes a key
 * rather than items so server pages don't pass anything across the client boundary.
 */
export function HubTabs({ hub }: { hub: HubTabsKey }) {
  const pathname = usePathname();
  const { label, items } = TABS[hub];
  const active = findActiveItem(pathname, items);

  return (
    <nav
      aria-label={label}
      className="border-b border-(--section-divider) max-lg:-mx-gutter max-lg:px-gutter"
    >
      {/* Phones: the row fades at the right edge, so a cut-off tab reads as "scroll for more". */}
      <ul className="-mb-px flex [scrollbar-width:none] gap-1 overflow-x-auto max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] max-sm:pr-8 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const current = active?.href === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center border-b-2 border-transparent px-2.5 type-body font-medium whitespace-nowrap text-text-secondary transition-colors duration-(--duration-quick) outline-none hover:text-foreground focus-visible:rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  current && "border-primary text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
