"use client";

import Link from "next/link";
import { CalendarCheck, ChevronRight } from "lucide-react";

import { useLiveStatus } from "@/components/feedback/reward-feedback";
import { Progress } from "@/components/ui/progress";
import { Surface } from "@/components/ui/surface";
import type { PlayerStatus } from "@/lib/rewards/feedback";

/**
 * The chip's face. It starts from the server's stored status and follows the newer one a save
 * brings back, so XP, level and streak move right after logging without reloading Home.
 */
export function PlayerChipView({
  initial,
  compact = false,
}: {
  initial: PlayerStatus;
  /** The sidebar's form: level, rank and the XP bar only. */
  compact?: boolean;
}) {
  const status = useLiveStatus(initial);
  const fresh = status.xp === 0;
  if (compact) {
    // One slim line: level mark, level and rank, a thin XP bar. The full picture is on Player.
    const toNext = status.levelSpan - status.levelXp;
    return (
      <Link
        href="/rewards/status"
        data-testid="sidebar-player-chip"
        className="flex h-10 items-center gap-2.5 rounded-lg px-2 outline-none hover:bg-sidebar-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:h-11"
      >
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-md border border-(--metal-line) bg-(--level-mark-bg) type-caption font-semibold text-(--level-mark-fg) money"
        >
          {status.level}
        </span>
        <span className="min-w-0 flex-1 truncate type-caption">
          <span className="font-semibold">Level {status.level}</span>
          <span className="text-text-tertiary"> · </span>
          <span className="text-rank">{status.rank}</span>
          <span className="sr-only">
            {fresh ? ". Log to earn XP" : `. ${toNext} XP to the next level`}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-progress-track"
        >
          <span
            className="block h-full rounded-full bg-progress-xp"
            style={{ width: `${Math.min(100, status.progressBp / 100)}%` }}
          />
        </span>
      </Link>
    );
  }
  return (
    <Surface variant="interactive" asChild className="gap-3">
      <Link href="/rewards/status" data-testid="player-chip">
        <span className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-progress-xp/40 bg-primary-soft type-body font-semibold text-progress-xp">
            {status.level}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="type-body font-semibold">
              Level {status.level} · <span className="text-rank">{status.rank}</span>
            </span>
            <span className="type-caption text-muted-foreground">
              {fresh
                ? "Log your first expense to start earning XP"
                : `${status.levelSpan - status.levelXp} XP to level ${status.level + 1}`}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </span>
        <Progress
          bp={status.progressBp}
          tone="xp"
          aria-label="XP towards the next level"
          valueText={`${status.levelXp} of ${status.levelSpan} XP`}
        />
        <span className="flex items-center gap-1.5 type-caption text-muted-foreground">
          <CalendarCheck className="size-3.5" aria-hidden="true" />
          {status.streakDays > 0
            ? `${status.streakDays}-day logging streak`
            : "No streak yet. Any day you log starts one."}
          <span className="ml-auto money" data-testid="player-chip-xp">
            {status.xp} XP
          </span>
        </span>
      </Link>
    </Surface>
  );
}
