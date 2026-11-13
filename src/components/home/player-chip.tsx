import Link from "next/link";

import { PlayerChipView, ProgressStripView } from "@/components/home/player-chip-view";
import { Panel } from "@/components/layout/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlayerStatus, getTodayMission } from "@/lib/rewards/status";

/**
 * Home's progression strip: level (phones only; the sidebar shows it on laptops), streak and
 * today's mission. It opens Player status (`/rewards/status`). Streamed after the money figures,
 * and never larger than them.
 */
export async function PlayerChip() {
  let status;
  let mission;
  try {
    [status, mission] = await Promise.all([
      getPlayerStatus(),
      // The mission is a nicety: without it the strip still shows the level and streak.
      getTodayMission().catch(() => null),
    ]);
  } catch {
    // Progress is secondary: a failed read leaves a quiet link instead of breaking Home.
    return (
      <Panel asChild>
        <Link href="/rewards/status" data-testid="player-chip" data-state="error">
          <span className="type-body text-muted-foreground">
            Your progress couldn’t load. Open Player status.
          </span>
        </Link>
      </Panel>
    );
  }

  return <ProgressStripView initial={status} mission={mission} />;
}

export function PlayerChipSkeleton() {
  return (
    <Panel
      aria-busy="true"
      className="flex-row items-center gap-3 py-3"
      data-testid="player-chip-loading"
    >
      <span className="sr-only">Loading your progress…</span>
      <div className="flex flex-1 flex-col gap-1.5" aria-hidden="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>
    </Panel>
  );
}

/** The sidebar's compact chip. Streamed after the page; a failed read just leaves it out. */
export async function SidebarPlayerChip() {
  const status = await getPlayerStatus().catch(() => null);
  return status ? <PlayerChipView initial={status} /> : null;
}

export function SidebarPlayerChipSkeleton() {
  return (
    <div aria-hidden="true" className="flex h-10 items-center gap-2.5 px-2">
      <Skeleton className="size-6 rounded-md" />
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-1 w-12 rounded-full" />
    </div>
  );
}
