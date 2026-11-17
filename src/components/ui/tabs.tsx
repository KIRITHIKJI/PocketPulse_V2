"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        // In-page sections: a quiet text row, so it never competes with a hub's underlined tabs.
        // `relative` keeps screen-reader-only text inside the scrolling row, so it can't widen the
        // page; on phones the row fades at the edge, like the hub tabs.
        "relative flex max-w-full [scrollbar-width:none] gap-1 overflow-x-auto max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] max-sm:pr-8 [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 type-body font-medium whitespace-nowrap text-text-secondary transition-colors duration-(--duration-quick) outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-(--finance-inset) data-[state=active]:text-foreground [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("flex flex-col gap-4 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
