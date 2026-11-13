"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";

import { THEME_OPTIONS } from "@/components/preferences/theme-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/*
 * The header's two menus. This module loads after the page is up (`use-header-menus.ts`): until
 * then each trigger is a plain button that loads it and opens the menu, so the menu library isn't
 * part of the shell's first JavaScript.
 */

type MenuProps = {
  /** The header's button; it becomes the menu's trigger. */
  trigger: React.ReactElement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ThemeMenu({
  trigger,
  open,
  onOpenChange,
  value,
  onChoose,
}: MenuProps & { value: string; onChoose: (value: string) => void }) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={onChoose}>
          {THEME_OPTIONS.map(({ value: option, label, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={option} value={option}>
              <OptionIcon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AccountDropdown({
  trigger,
  open,
  onOpenChange,
  email,
  pending,
  onSignOut,
}: MenuProps & { email: string | null; pending: boolean; onSignOut: () => void }) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-72">
        <DropdownMenuLabel className="truncate">{email ?? "Signed in"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={onSignOut}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
