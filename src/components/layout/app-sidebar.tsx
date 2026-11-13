"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { AddButton } from "@/components/layout/add-button";
import { SIDEBAR_ITEMS, findActiveItem, visibleItems, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * A sidebar link: 40 px with a mouse, 44 px on touch. Prefetches when it is pointed at or
 * focused, not on load, so a page view doesn't render every destination on the server.
 */
function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon!;
  // Next.js's hover-prefetch pattern: no prefetch until the link is wanted, then the usual one.
  const [wanted, setWanted] = React.useState(false);
  const want = () => setWanted(true);
  return (
    <Link
      href={item.href}
      prefetch={wanted ? null : false}
      onMouseEnter={want}
      onFocus={want}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 type-body font-medium text-sidebar-foreground/75 transition-colors duration-(--duration-quick) outline-none hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:min-h-11",
        active &&
          "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 text-text-tertiary transition-colors group-hover:text-sidebar-accent-foreground",
          active && "text-primary group-hover:text-primary",
        )}
      />
      {item.label}
    </Link>
  );
}

/**
 * Desktop navigation (doc/V2_SPEC.md §6.2): logo, the one Add button, eight links in one column
 * with no group headings, and the slim level line at the foot. It fits a 768 px tall screen
 * without scrolling. With progress features off there is no Player link and no level line.
 */
export function AppSidebar({
  showProgress = true,
  playerChip,
}: {
  showProgress?: boolean;
  /** The streamed one-line level widget; only rendered when progress features are on. */
  playerChip?: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = visibleItems(SIDEBAR_ITEMS, showProgress);
  const active = findActiveItem(pathname, items);

  return (
    <aside
      aria-label="Main navigation"
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 border-r border-sidebar-border bg-sidebar px-3 pt-4 pb-3 lg:flex"
    >
      <Link
        href="/home"
        className="self-start rounded-lg px-2 py-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label="PocketPulse home"
      >
        <Logo />
      </Link>
      <AddButton look="sidebar" />
      <nav aria-label="Sections" className="flex min-h-0 flex-1 flex-col">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.href}>
              <SidebarItem item={item} active={active?.href === item.href} />
            </li>
          ))}
        </ul>
      </nav>
      {showProgress && playerChip}
    </aside>
  );
}
