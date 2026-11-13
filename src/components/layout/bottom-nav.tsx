"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ellipsis, type LucideIcon } from "lucide-react";

import { AddButton } from "@/components/layout/add-button";
import { useNavSheets } from "@/components/layout/use-nav-sheets";
import { MOBILE_TABS, MORE_ITEMS, findActiveItem, visibleItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const TAB =
  "flex h-full w-full flex-col items-center justify-center gap-1 text-[0.6875rem] leading-none font-medium text-muted-foreground outline-none transition-colors focus-visible:text-foreground";

function TabMark({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-7 w-11 items-center justify-center rounded-full transition-colors",
        active && "bg-primary-soft",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

/**
 * Phones: Home · Transactions · Add · Insights · Plan · More (doc/V2_SPEC.md §6.2). Add is docked
 * in the bar, so nothing floats over the page. More opens a sheet with Player, Reports, Manage
 * and Settings.
 */
export function BottomNav({ showProgress = true }: { showProgress?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sheets, open: load } = useNavSheets();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const active = findActiveItem(pathname, MOBILE_TABS);
  const moreActive = findActiveItem(pathname, visibleItems(MORE_ITEMS, showProgress)) !== undefined;
  const [first, second, ...rest] = MOBILE_TABS;

  async function showMore() {
    if (await load()) setMoreOpen(true);
    else router.push("/settings");
  }

  const tab = (item: (typeof MOBILE_TABS)[number]) => {
    const isActive = active?.href === item.href;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          className={cn(TAB, isActive && "text-primary")}
        >
          <TabMark icon={item.icon!} active={isActive} />
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-6">
        {tab(first!)}
        {tab(second!)}
        <li className="flex items-center justify-center">
          <AddButton look="dock" />
        </li>
        {rest.map(tab)}
        <li>
          <button
            type="button"
            onClick={showMore}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(TAB, moreActive && "text-primary")}
          >
            <TabMark icon={Ellipsis} active={moreActive} />
            More
          </button>
        </li>
      </ul>
      {sheets && (
        <sheets.MoreSheet
          open={moreOpen}
          onOpenChange={setMoreOpen}
          pathname={pathname}
          showProgress={showProgress}
        />
      )}
    </nav>
  );
}
