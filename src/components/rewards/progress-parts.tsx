import Link from "next/link";
import type { Route } from "next";

import { InlineAction } from "@/components/forms/inline-action";
import { type MissionGlyphState, MissionGlyph } from "@/components/rewards/emblems";
import { MissionMenu } from "@/components/rewards/mission-menu";
import { DeepBand, Halo } from "@/components/rewards/rank-band";
import { ReviewWeekButton } from "@/components/rewards/review-week-button";
import { Button } from "@/components/ui/button";
import { changeQuest } from "@/lib/actions/rewards";
import type { MissionView } from "@/lib/rewards/view";
import { cn } from "@/lib/utils";

/** Where each mission is done. Every mission is a step of the job: log, look, sort, set aside. */
const MISSION_LINKS: Record<string, { href: Route; label: string }> = {
  log_today: { href: "/add", label: "Quick add" },
  review_today: { href: "/insights?period=today" as Route, label: "Look at today" },
  categorise_week: { href: "/categories?tab=uncategorized" as Route, label: "Open the queue" },
  set_aside_week: { href: "/goals", label: "Open goals" },
  set_a_goal: { href: "/goals", label: "Add a goal" },
  steady_logging: { href: "/add", label: "Quick add" },
  saving_habit: { href: "/goals", label: "Open goals" },
};

const CADENCE_LABELS = { daily: "Daily", weekly: "Weekly", once: "Long-term" } as const;

export function glyphState(mission: MissionView): MissionGlyphState {
  if (mission.skipped) return "skipped";
  if (mission.complete) return "done";
  return mission.progress > 0 ? "active" : "open";
}

/**
 * The open mission closest to done: the current objective. Ties go to the shorter cadence
 * (daily, then weekly, then long-term), then to the catalog order.
 */
export function currentObjective(missions: readonly MissionView[]): MissionView | null {
  const order = { daily: 0, weekly: 1, once: 2 } as const;
  return (
    missions
      .filter((m) => !m.skipped && !m.complete)
      .map((m, i) => ({ m, i }))
      .sort(
        (a, b) =>
          b.m.progress * a.m.target - a.m.progress * b.m.target ||
          order[a.m.cadence] - order[b.m.cadence] ||
          a.i - b.i,
      )[0]?.m ?? null
  );
}

/** The reward as an engraved tag: a fine metal edge, small spaced type. */
function XpTag({ xp, className }: { xp: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-md border border-(--emblem-line) px-2 type-label whitespace-nowrap money shadow-[inset_0_1px_0_0_var(--highlight-line)]",
        className,
      )}
    >
      +{xp} XP
    </span>
  );
}

/** The one main action of an open mission: where it's done, or the weekly review itself. */
function MainAction({ mission, onBand }: { mission: MissionView; onBand?: boolean }) {
  const band =
    onBand &&
    "border-(--progression-edge) text-(--progression-text) hover:bg-(--progression-raised) hover:text-(--progression-text)";
  if (mission.code === "weekly_review") return <ReviewWeekButton className={cn(band)} />;
  const link = MISSION_LINKS[mission.code];
  if (!link) return null;
  return (
    <Button size="sm" variant={onBand ? "outline" : "ghost"} className={cn(band)} asChild>
      <Link href={link.href}>{link.label}</Link>
    </Button>
  );
}

/** A thin bar in the XP ring's language: faint track, violet fill. Only for counted missions. */
function MissionBar({ mission }: { mission: MissionView }) {
  return (
    <div
      role="progressbar"
      aria-label={`${mission.title} progress`}
      aria-valuemin={0}
      aria-valuemax={mission.target}
      aria-valuenow={mission.progress}
      aria-valuetext={`${mission.progress} of ${mission.target}`}
      className="h-[3px] w-full max-w-xs overflow-hidden rounded-full bg-(--emblem-line)"
    >
      <div
        className="h-full rounded-full bg-(--emblem-accent)"
        style={{ width: `${(mission.progress / mission.target) * 100}%` }}
      />
    </div>
  );
}

/**
 * Missions' one dominant element (doc/DESIGN_PLAN.md, V2 Phase 3D): the current objective in the
 * deep band, with its glyph, what to do, its progress, its reward and its one action. Without an
 * open mission the band says why, calmly.
 */
export function ObjectiveBand({
  mission,
  hasMissions,
}: {
  mission: MissionView | null;
  hasMissions: boolean;
}) {
  if (!mission) {
    return (
      <DeepBand
        aria-labelledby="current-objective"
        className="flex flex-col items-center gap-2 py-12 text-center lg:py-14"
        data-testid="objective-empty"
      >
        <Halo className="size-[36rem]" />
        <p className="relative type-label text-(--progression-muted)">Current objective</p>
        <h2 id="current-objective" className="relative type-display">
          {hasMissions ? "All caught up" : "No missions yet"}
        </h2>
        <p className="relative max-w-sm type-body text-(--progression-muted)">
          {hasMissions
            ? "Every open mission is done or skipped. New daily missions arrive at midnight."
            : "Missions appear here once they’re available. Logging still earns XP for each day you log."}
        </p>
      </DeepBand>
    );
  }
  const multi = mission.target > 1;
  return (
    <DeepBand
      aria-labelledby="current-objective"
      className="flex flex-col items-center gap-6 py-10 text-center lg:flex-row lg:justify-center lg:gap-14 lg:px-14 lg:py-12 lg:text-left"
      data-testid="mission"
      data-code={mission.code}
      data-state="open"
      data-current=""
    >
      <div className="relative size-28 shrink-0 lg:size-44">
        <Halo className="size-[32rem] lg:size-[48rem]" />
        <MissionGlyph
          code={mission.code}
          state="active"
          size={176}
          className="relative size-full"
        />
      </div>
      <div className="relative flex max-w-lg min-w-0 flex-col items-center gap-2 lg:items-start">
        <p className="type-label text-(--progression-muted)">
          Current objective · {CADENCE_LABELS[mission.cadence]}
        </p>
        <h2 id="current-objective" className="type-display">
          {mission.title}
          <span className="sr-only">, open</span>
        </h2>
        <p className="max-w-md type-body text-(--progression-muted)">{mission.description}</p>
        {multi && (
          <div className="mt-2 flex w-full max-w-xs flex-col items-center gap-1.5 lg:items-start">
            <MissionBar mission={mission} />
            <p className="type-caption text-(--progression-muted) money">
              {mission.progress} of {mission.target}
            </p>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <XpTag xp={mission.xp} className="text-(--progression-text)" />
          <MainAction mission={mission} onBand />
          <MissionMenu
            code={mission.code}
            title={mission.title}
            className="hover:bg-(--progression-raised)"
          />
        </div>
      </div>
    </DeepBand>
  );
}

/**
 * A journal entry: the glyph on the rail, what to do, progress, the reward as an engraved tag,
 * one main action and an overflow menu holding Skip. Done entries dim and carry a seal.
 */
export function MissionRow({ mission }: { mission: MissionView }) {
  const state = glyphState(mission);
  const glyph = (
    <span className="relative z-[1] shrink-0 rounded-full bg-background">
      <MissionGlyph code={mission.code} state={state} size={40} />
    </span>
  );
  if (mission.skipped) {
    return (
      <li
        className="flex min-h-14 items-center gap-3 py-2.5"
        data-testid="mission"
        data-code={mission.code}
        data-state="skipped"
      >
        {glyph}
        <span className="min-w-0 flex-1 type-body text-text-secondary">
          {mission.title} · Skipped
        </span>
        <InlineAction
          action={changeQuest}
          fields={{ code: mission.code, optOut: "false" }}
          pendingLabel="Saving…"
          aria-label={`Bring back the ${mission.title} mission`}
        >
          Bring back
        </InlineAction>
      </li>
    );
  }
  const status = mission.complete
    ? "Completed"
    : mission.target > 1
      ? `${mission.progress} of ${mission.target}`
      : null;
  const toSort = mission.complete && mission.toSort > 0 && (
    <Button size="sm" variant="ghost" asChild>
      <Link href={MISSION_LINKS.categorise_week!.href} data-testid="mission-to-sort">
        <span className="money">{mission.toSort}</span> new{" "}
        {mission.toSort === 1 ? "entry" : "entries"} to sort
      </Link>
    </Button>
  );
  const actions = !mission.complete && (
    <>
      <MainAction mission={mission} />
      <MissionMenu code={mission.code} title={mission.title} />
    </>
  );
  return (
    <li
      className="flex gap-3 py-3"
      data-testid="mission"
      data-code={mission.code}
      data-state={mission.complete ? "done" : "open"}
    >
      {glyph}
      {/* Phones: text and tag, then the actions on their own line. Wider: the tag and the
          actions stack on the right, beside the text, so no line is left mostly empty. */}
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5 sm:row-span-2">
          <h3 className={cn("type-body font-semibold", mission.complete && "text-text-secondary")}>
            {mission.title}
            <span className="sr-only">{mission.complete ? ", done" : ", open"}</span>
          </h3>
          <p className="type-caption text-text-secondary">{mission.description}</p>
          {status && <p className="type-caption text-text-secondary money">{status}</p>}
        </div>
        <XpTag
          xp={mission.xp}
          className={cn(
            "justify-self-end",
            mission.complete ? "text-text-secondary opacity-70" : "text-foreground",
          )}
        />
        {(actions || toSort) && (
          <div className="col-span-2 flex flex-wrap items-center justify-end gap-1 sm:col-span-1 sm:col-start-2 sm:-mr-2">
            {toSort}
            {actions}
          </div>
        )}
      </div>
    </li>
  );
}
