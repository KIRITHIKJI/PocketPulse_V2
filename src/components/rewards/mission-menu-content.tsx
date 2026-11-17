"use client";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/*
 * The mission overflow menu itself. This module loads on first open, or once the browser is idle
 * (`mission-menu.tsx`), so the menu library isn't part of the Missions page's first JavaScript.
 */
export function MissionDropdown({
  trigger,
  open,
  onOpenChange,
  onSkip,
}: {
  /** The row's "⋯" button; it becomes the menu's trigger. */
  trigger: React.ReactElement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSkip: () => void;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onSkip}>Skip this mission</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
