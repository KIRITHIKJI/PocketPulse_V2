import * as React from "react";
import type { Route } from "next";
import Link from "next/link";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/*
 * Layout primitives for the V2 redesign (doc/DESIGN_PLAN.md, V2 Phase 3A). The rule: a box with
 * a border is only for content that really is a separate object (`Panel`). Sections of a page are
 * separated by space and hairline dividers (`Section`, `StatRow`, `DataList`), never by more boxes.
 * Server components, no client code. `PageHeader` with `tabs` is the page header with hub tabs.
 */

/**
 * The top of a screen that leads with one figure: a small uppercase scope label, the hero number
 * and one quiet line. No box. `aside` sits beside it on wide screens (a second figure, an action).
 */
export function Hero({
  label,
  value,
  meta,
  aside,
  className,
  ...props
}: Omit<React.ComponentProps<"section">, "children"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  meta?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section
      data-slot="hero"
      className={cn("flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="type-label text-text-secondary">{label}</p>
        <p className="type-hero money">{value}</p>
        {meta ? <p className="type-body text-text-secondary">{meta}</p> : null}
      </div>
      {aside ? <div className="flex min-w-0 flex-col gap-1">{aside}</div> : null}
    </section>
  );
}

/**
 * A plain section: an optional title row (title, one meta line, one trailing action), then its
 * content. `divided` draws a hairline above it, so consecutive sections read apart without boxes.
 */
export function Section({
  title,
  titleId,
  meta,
  action,
  divided = true,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode;
  titleId?: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  divided?: boolean;
}) {
  const id = React.useId();
  const headingId = titleId ?? id;
  return (
    <section
      data-slot="section"
      aria-labelledby={title ? headingId : undefined}
      className={cn(
        "flex flex-col gap-stack",
        divided && "border-t border-(--section-divider) pt-section",
        className,
      )}
      {...props}
    >
      {title || action ? (
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title ? (
              <h2 id={headingId} className="type-heading">
                {title}
              </h2>
            ) : null}
            {meta ? <p className="type-caption text-text-secondary">{meta}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** A compact panel: the one bordered box, for content that is a separate object. */
export function Panel({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="panel"
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-(--panel-border) bg-(--panel-bg) p-4 shadow-(--panel-shadow)",
        className,
      )}
      {...props}
    />
  );
}

/** A row of figures separated by vertical hairlines (stacked with horizontal ones on phones). */
export function StatRow({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="stat-row"
      className={cn(
        "grid grid-cols-2 gap-y-4 sm:flex sm:divide-x sm:divide-(--section-divider) [&>div]:sm:px-6 [&>div:first-child]:sm:pl-0",
        className,
      )}
      {...props}
    />
  );
}

export function Stat({
  label,
  value,
  meta,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="stat" className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <dt className="type-label text-text-secondary">{label}</dt>
      <dd className="type-heading money">{value}</dd>
      {meta ? <dd className="type-caption text-text-secondary">{meta}</dd> : null}
    </div>
  );
}

/** A list of rows divided by hairlines: no box per row. */
export function DataList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="data-list"
      className={cn("flex flex-col divide-y divide-(--section-divider)", className)}
      {...props}
    />
  );
}

/**
 * One row: a leading mark, a title with one line under it, and a trailing value (tabular).
 * With `href` the whole row is the link.
 */
export function DataRow({
  leading,
  title,
  detail,
  value,
  href,
  className,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  value?: React.ReactNode;
  href?: Route;
  className?: string;
}) {
  const row = cn(
    "flex min-h-14 items-center gap-3 py-2.5",
    href &&
      "-mx-2 rounded-lg px-2 outline-none transition-colors duration-(--duration-quick) hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50",
    className,
  );
  const body = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-body font-medium">{title}</span>
        {detail ? (
          <span className="truncate type-caption text-text-secondary">{detail}</span>
        ) : null}
      </span>
      {value ? <span className="shrink-0 type-body money">{value}</span> : null}
    </>
  );
  return (
    <li data-slot="data-row">
      {href ? (
        <Link href={href} className={row}>
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}
