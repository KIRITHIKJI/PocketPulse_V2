"use client";

import * as React from "react";
import { Ellipsis } from "lucide-react";

import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { lazyModule, useLazyModule } from "@/hooks/use-lazy-module";
import { changeQuest } from "@/lib/actions/rewards";
import { IDLE } from "@/lib/form-state";
import { cn } from "@/lib/utils";

const loadMenu = lazyModule(() => import("@/components/rewards/mission-menu-content"));

/**
 * A mission's overflow menu: Skip lives here, away from its one main action. Skipping costs
 * nothing, and the skipped row offers Bring back. The page refreshes from the server's answer.
 * Until the menu's code is here, "⋯" loads it and opens the menu; if it can't load at all
 * (offline before it was ever saved), Skip shows as a plain button beside "⋯" instead.
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
  const { module: menu, load } = useLazyModule(loadMenu);
  const [open, setOpen] = React.useState(false);
  const [plain, setPlain] = React.useState(false);
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
  const openFirst = menu
    ? undefined
    : async () => {
        if (await load()) setOpen(true);
        else setPlain((shown) => !shown);
      };

  const trigger = (
    <Button
      size="icon-sm"
      variant="ghost"
      loading={pending}
      aria-label={`More for the ${title} mission`}
      aria-haspopup="menu"
      onClick={openFirst}
      className={cn("text-current/70 hover:text-current", className)}
    >
      {!pending && <Ellipsis aria-hidden="true" />}
    </Button>
  );

  if (menu) {
    return (
      <menu.MissionDropdown trigger={trigger} open={open} onOpenChange={setOpen} onSkip={skip} />
    );
  }
  return (
    <>
      {plain && (
        <Button size="sm" variant="ghost" onClick={skip} disabled={pending}>
          Skip this mission
        </Button>
      )}
      {trigger}
    </>
  );
}
