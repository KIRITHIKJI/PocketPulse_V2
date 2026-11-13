"use client";

import * as React from "react";

import { saveLoadedAssets } from "@/lib/offline/pwa";

/**
 * A module that isn't part of the shell's first JavaScript: one shared load, and a failed load
 * can be tried again. Create it at module level: `const sheets = lazyModule(() => import(...))`.
 */
export function lazyModule<T>(importer: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | null = null;
  return () => {
    loading ??= importer().catch((error: unknown) => {
      loading = null;
      throw error;
    });
    return loading;
  };
}

/**
 * Loads a `lazyModule` once the browser is idle after the page is up, then has the worker save
 * the file, so it still works offline later. `load()` gets it at once when it's wanted sooner; it
 * resolves to null only when the code can't be fetched at all, and the caller falls back.
 */
export function useLazyModule<T>(load: () => Promise<T>) {
  const [module, setModule] = React.useState<T | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const start = () =>
      load()
        .then((loaded) => {
          if (cancelled) return;
          setModule(() => loaded);
          saveLoadedAssets();
        })
        .catch(() => {
          // Offline before it was ever saved: `load()` tries again when it's wanted.
        });
    const idle = window.requestIdleCallback?.(start, { timeout: 3_000 });
    const timer = idle === undefined ? window.setTimeout(start, 1_500) : undefined;
    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [load]);

  const get = React.useCallback(async (): Promise<T | null> => {
    try {
      const loaded = await load();
      setModule(() => loaded);
      return loaded;
    } catch {
      return null;
    }
  }, [load]);

  return { module, load: get };
}
