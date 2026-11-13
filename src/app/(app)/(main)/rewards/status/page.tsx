import type { Metadata } from "next";

import { DataList, DataRow, Section, Stat, StatRow } from "@/components/layout/primitives";
import { ProgressHeader, ProgressUnavailable } from "@/components/rewards/progress-page";
import { AchievementBadge, RankEmblem } from "@/components/rewards/emblems";
import { RankBand } from "@/components/rewards/rank-band";
import { dayOf, loadProgress } from "@/lib/rewards/view";

export const metadata: Metadata = { title: "Player status" };

const days = (n: number) => (n === 1 ? "day" : "days");

/**
 * Player status (doc/DESIGN_PLAN.md, V2 Phase 3C): one deep band with the rank emblem inside the
 * XP ring, then the habit figures in one quiet row and the milestones so far. Nothing here is
 * about money, and every figure is the stored reward status.
 */
export default async function PlayerStatusPage() {
  const view = await loadProgress();
  const header = (
    <ProgressHeader
      title="Player status"
      description="Your logging habit over time. XP comes from logging, sorting and reviewing, never from spending less."
      view={view}
    />
  );
  if (!view) {
    return (
      <>
        {header}
        <ProgressUnavailable />
      </>
    );
  }
  const { status } = view;

  return (
    <>
      {header}
      <RankBand status={status} />

      <div className="flex flex-col gap-3">
        <StatRow className="grid-cols-3 items-end gap-x-4">
          <Stat
            label="Current streak"
            value={
              <span data-testid="streak-daily">{`${status.streakDays} ${days(status.streakDays)}`}</span>
            }
          />
          <Stat
            label="Longest streak"
            value={
              <span data-testid="streak-longest">{`${view.longestStreak} ${days(view.longestStreak)}`}</span>
            }
          />
          <Stat
            label="Lifetime XP"
            value={<span data-testid="lifetime-xp">{`${status.xp} XP`}</span>}
          />
        </StatRow>
        <p className="type-caption text-text-secondary">
          A streak is only a count. A day off is fine, and your longest stays.
        </p>
      </div>

      {view.milestones.length > 0 && (
        <Section title="Milestones">
          <DataList data-testid="milestones">
            {view.milestones.map((m, i) => (
              <DataRow
                key={`${m.kind}:${m.title}:${i}`}
                leading={
                  m.kind === "level" ? (
                    <RankEmblem rank={m.rank ?? ""} size={32} />
                  ) : (
                    <AchievementBadge icon={m.icon ?? null} unlocked size={32} />
                  )
                }
                title={m.title}
                value={
                  <span className="type-caption text-text-secondary">{dayOf(m.at, view)}</span>
                }
              />
            ))}
          </DataList>
        </Section>
      )}
    </>
  );
}
