"use client";

import * as React from "react";
import { Ellipsis } from "lucide-react";

import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { changeQuest } from "@/lib/actions/rewards";
import { IDLE } from "@/lib/form-state";
import { cn } from "@/lib/utils";

/**
 * A mission's overflow menu: Skip lives here, away from its one main action. Skipping costs
 * nothing, and the skipped row offers Bring back. The page refreshes from the server's answer.
 */
export function MissionMenu({
  code,
  title,
  className,
}: {
  code: string;
  title: string;
  className?: string;
}) {
  const { show } = useToast();
  const [pending, start] = React.useTransition();
  const skip = () =>
    start(async () => {
      const form = new FormData();
      form.set("code", code);
      form.set("optOut", "true");
      const result = await changeQuest(IDLE, form).catch(() => null);
      if (result?.status !== "success") {
        show({ tone: "error", message: result?.message ?? "Couldn’t save that. Try again." });
      }
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          loading={pending}
          aria-label={`More for the ${title} mission`}
          className={cn("text-current/70 hover:text-current", className)}
        >
          {!pending && <Ellipsis aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={skip}>Skip this mission</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
