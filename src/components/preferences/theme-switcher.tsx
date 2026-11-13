"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { usePersistPreferences } from "@/components/providers/preference-sync";
import { useHeaderMenu } from "@/components/layout/use-header-menu";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import type { ThemePreference } from "@/lib/validation/settings";

export const THEME_OPTIONS = [
  { value: "dark", label: "Midnight", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "Match device", icon: Monitor },
] as const;

/**
 * Compact header control; the Settings page offers the same choice as a segmented control.
 * Signed in, the choice is also saved to the profile so other devices follow it.
 */
export function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const persist = usePersistPreferences();
  const hydrated = useHydrated();
  const choose = (value: string) => {
    setTheme(value);
    persist?.({ theme: value as ThemePreference });
  };
  const Icon = hydrated && resolvedTheme === "light" ? Sun : Moon;
  // Without the menu's code at all (offline, never saved), the button switches dark and light.
  const { menus, open, setOpen, openFirst } = useHeaderMenu(() =>
    choose(resolvedTheme === "light" ? "dark" : "light"),
  );

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Change theme"
      aria-haspopup="menu"
      data-testid="theme-switcher"
      onClick={openFirst}
    >
      <Icon className="size-[1.15rem]" />
    </Button>
  );
  if (!menus) return trigger;
  return (
    <menus.ThemeMenu
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      value={hydrated ? (theme ?? "dark") : "dark"}
      onChoose={choose}
    />
  );
}
