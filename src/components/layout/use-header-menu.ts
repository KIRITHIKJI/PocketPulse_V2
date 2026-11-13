"use client";

import * as React from "react";

import { lazyModule, useLazyModule } from "@/hooks/use-lazy-module";

const loadHeaderMenus = lazyModule(() => import("@/components/layout/header-menus"));

/**
 * One header menu's state. Until the menus' code is here, `openFirst` is the button's click
 * handler: it loads the code and opens the menu, or runs `fallback` if the code can't load at all.
 * Once loaded, the menu's own trigger handles presses and `openFirst` is undefined.
 */
export function useHeaderMenu(fallback: () => void) {
  const { module: menus, load } = useLazyModule(loadHeaderMenus);
  const [open, setOpen] = React.useState(false);
  const openFirst = menus
    ? undefined
    : async () => {
        if (await load()) setOpen(true);
        else fallback();
      };
  return { menus, open, setOpen, openFirst };
}
