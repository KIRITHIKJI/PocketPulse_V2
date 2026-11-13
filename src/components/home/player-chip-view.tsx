"use client";

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";

import { useLiveStatus, useRewardFeedback } from "@/components/feedback/reward-feedback";
import { Panel } from "@/components/layout/primitives";
import { RankEmblem } from "@/components/rewards/emblems";
import type { PlayerStatus } from "@/lib/rewards/feedback";
import type { TodayMission } from "@/lib/rewards/status";

/**
 * The sidebar's slim level line: the small rank emblem, level and rank, a thin XP bar. It starts from the
 * server's stored status and follows the newer one a save brings back.
 */
export function PlayerChipView({ initial }: { initial: PlayerStatus }) {
  const status = useLiveStatus(initial);
  const fresh = status.xp === 0;
  const toNext = status.levelSpan - status.levelXp;
  return (
    <Link
      href="/rewards/status"
      data-testid="sidebar-player-chip"
      className="flex h-10 items-center gap-2.5 rounded-lg px-2 outline-none hover:bg-sidebar-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:h-11"
    >
      <RankEmblem rank={status.rank} size={24} />
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

/**
 * Home's progression strip: streak and today's mission, linking to Player status. The level
 * shows here only below laptop width; on laptops the sidebar's level line is on screen, and the
 * level appears once per page. A mission a save just finished is marked done at once.
 */
export function ProgressStripView({
  initial,
  mission,
}: {
  initial: PlayerStatus;
  mission: TodayMission | null;
}) {
  const status = useLiveStatus(initial);
  const { missionsDone } = useRewardFeedback();
  const done = mission !== null && (mission.done || missionsDone.includes(mission.code));
  return (
    <Panel
      asChild
      className="flex-row items-center gap-3 py-3 transition-colors duration-(--duration-quick) outline-none hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Link href="/rewards/status" data-testid="player-chip">
        <RankEmblem rank={status.rank} size={32} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2 type-body">
            <span className="flex shrink-0 items-center gap-2 whitespace-nowrap lg:hidden">
              <span className="font-semibold">Level {status.level}</span>
              <span className="text-rank">{status.rank}</span>
              <span className="text-text-tertiary" aria-hidden="true">
                ·
              </span>
            </span>
            <span className="truncate">
              {status.streakDays > 0 ? `${status.streakDays}-day logging streak` : "No streak yet"}
            </span>
          </span>
          {mission && (
            <span className="flex min-w-0 items-center gap-1.5 type-caption text-text-secondary">
              <span className="truncate">Today: {mission.title}</span>
              {done ? (
                <span className="flex shrink-0 items-center gap-1 text-feedback-success">
                  <Check className="size-3.5" aria-hidden="true" />
                  done
                </span>
              ) : (
                <span className="shrink-0 money">· +{mission.xp} XP</span>
              )}
            </span>
          )}
        </span>
        <span className="hidden shrink-0 type-caption text-text-secondary sm:inline">Player</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </Panel>
  );
}
