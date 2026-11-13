"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  ADD_ITEMS,
  HUB_TABS,
  MORE_ITEMS,
  findActiveItem,
  visibleItems,
  type Hub,
  type NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

/*
 * The navigation sheets. This module loads on first use (see `use-nav-sheets.ts`), so the shell's
 * first JavaScript carries only the buttons that open them.
 */

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
};

const ROW =
  "group flex min-h-14 items-center gap-3 px-1 py-2 outline-none transition-colors duration-(--duration-quick) focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-lg";

/**
 * Add: the four ways to record, fastest first. A bottom sheet on phones; on a laptop a small
 * panel beside the sidebar's Add button.
 */
export function AddSheet({ open, onOpenChange, pathname }: SheetProps) {
  const active = findActiveItem(pathname, ADD_ITEMS);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="add-sheet"
        className="lg:inset-x-auto lg:top-20 lg:bottom-auto lg:left-63 lg:w-88 lg:rounded-2xl lg:border lg:pb-5"
      >
        <div className="flex flex-col gap-0.5 pr-10">
          <SheetTitle>Add</SheetTitle>
          <SheetDescription>Pick how you want to record it.</SheetDescription>
        </div>
        <nav aria-label="Ways to add">
          <ul className="flex flex-col divide-y divide-border">
            {ADD_ITEMS.map((item) => {
              const Icon = item.icon;
              const current = active?.href === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    aria-current={current ? "page" : undefined}
                    className={cn(ROW, "hover:bg-accent/60")}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-inset text-text-secondary group-hover:text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="type-body font-medium">{item.label}</span>
                      <span className="type-caption text-text-secondary">{item.hint}</span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-text-tertiary"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

const MORE_HUB: Partial<Record<NavItem["href"], Hub>> = {
  "/rewards/status": "player",
  "/accounts": "manage",
};

/**
 * Phones' More: Player, Reports, Manage, Settings. A hub's own tabs sit under its row, so every
 * screen is at most two taps from the bar.
 */
export function MoreSheet({
  open,
  onOpenChange,
  pathname,
  showProgress,
}: SheetProps & { showProgress: boolean }) {
  const close = () => onOpenChange(false);
  const items = visibleItems(MORE_ITEMS, showProgress);
  const active = findActiveItem(pathname, items);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="more-sheet">
        <div className="flex flex-col gap-0.5 pr-10">
          <SheetTitle>More</SheetTitle>
          <SheetDescription>Progress, reports, your accounts and settings.</SheetDescription>
        </div>
        <nav aria-label="More">
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => {
              const Icon = item.icon!;
              const hub = MORE_HUB[item.href];
              const tabs = hub ? HUB_TABS[hub] : [];
              const current = active?.href === item.href;
              return (
                <li key={item.href} className="flex flex-col py-1">
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={current ? "page" : undefined}
                    className={cn(ROW, "min-h-12 hover:bg-accent/60")}
                  >
                    <Icon
                      className={cn("size-5 text-text-secondary", current && "text-primary")}
                      aria-hidden="true"
                    />
                    <span className="flex-1 type-body font-medium">{item.label}</span>
                    <ChevronRight
                      className="size-4 shrink-0 text-text-tertiary"
                      aria-hidden="true"
                    />
                  </Link>
                  {tabs.length > 0 && (
                    <ul aria-label={`${item.label} screens`} className="flex flex-wrap pb-1 pl-7">
                      {tabs.map((tab) => (
                        <li key={tab.href}>
                          <Link
                            href={tab.href}
                            onClick={close}
                            aria-current={pathname === tab.href ? "page" : undefined}
                            className="flex min-h-11 items-center rounded-lg px-2 type-caption font-medium text-text-secondary outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:text-primary"
                          >
                            {tab.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
