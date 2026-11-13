"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { useNavSheets } from "@/components/layout/use-nav-sheets";
import { cn } from "@/lib/utils";

const LOOKS = {
  /** The sidebar's one primary action. */
  sidebar:
    "h-10 w-full gap-2 rounded-lg px-4 text-sm font-medium hover:bg-(--button-primary-bg-hover) pointer-coarse:h-11",
  /** Docked in the middle of the phone bar. */
  dock: "size-12 rounded-2xl shadow-(--surface-raised-shadow) active:scale-95",
} as const;

/**
 * The one Add action. It opens the Add sheet (Quick add, Type it, Say it, Full form). If the
 * sheet's code can't load at all (offline before it was ever saved), it goes to Quick add instead.
 */
export function AddButton({ look }: { look: keyof typeof LOOKS }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sheets, open: load } = useNavSheets();
  const [open, setOpen] = React.useState(false);
  const onAdd = pathname === "/add" || pathname.startsWith("/add/");

  async function show() {
    if (await load()) setOpen(true);
    else router.push("/add");
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={look === "dock" ? "Add expense" : undefined}
        data-testid={`add-button-${look}`}
        className={cn(
          "inline-flex shrink-0 items-center justify-center bg-(--button-primary-bg) text-(--button-primary-text) transition-[background-color,transform] duration-(--duration-instant) outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          LOOKS[look],
          look === "dock" && onAdd && "ring-2 ring-primary/40",
        )}
      >
        <Plus className={look === "dock" ? "size-6" : "size-4"} aria-hidden="true" />
        {look === "sidebar" && "Add expense"}
      </button>
      {sheets && <sheets.AddSheet open={open} onOpenChange={setOpen} pathname={pathname} />}
    </>
  );
}
