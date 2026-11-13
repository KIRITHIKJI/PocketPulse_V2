"use client";

import { lazyModule, useLazyModule } from "@/hooks/use-lazy-module";

const loadNavSheets = lazyModule(() => import("@/components/layout/nav-sheets"));

/**
 * The navigation sheets (Add, More), loaded after the page is up rather than with the shell.
 * `open()` resolves to false only when the code can't be fetched at all; callers then navigate.
 */
export function useNavSheets() {
  const { module: sheets, load } = useLazyModule(loadNavSheets);
  return { sheets, open: async () => (await load()) !== null };
}
