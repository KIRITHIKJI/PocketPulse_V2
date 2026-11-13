import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";

import { DataList, DataRow, Section } from "@/components/layout/primitives";
import { AchievementBadge, RankEmblem } from "@/components/rewards/emblems";
import { GreetAchievements } from "@/components/rewards/greet-achievements";
import { ProgressHeader, ProgressUnavailable } from "@/components/rewards/progress-page";
import { WeekStrip } from "@/components/rewards/week-strip";
import { DeepBand, Halo } from "@/components/rewards/rank-band";
import { parseInstant, rankFor } from "@/domain";
import { requestNow } from "@/lib/data/session";
import { type ProgressView, dayOf, loadProgress } from "@/lib/rewards/view";

export const metadata: Metadata = { title: "Rewards" };

/** Highest level looked at for the next rank; the top rank starts well below it. */
const LEVEL_CEILING = 100;

type Item = {
  key: string;
  kind: "rank" | "achievement";
  name: string;
  /** The rank, or the achievement's icon: what its mark draws. */
  mark: string | null;
  /** When it was earned; for the next rank, the level that reaches it. */
  meta: string;
  owned: boolean;
};

/**
 * What the user holds: every rank reached after Starter (dated by the award that crossed into
 * it) and every unlocked achievement, newest first, then the next rank as the one item not yet
 * owned. Counted from the stored milestones; nothing here is worked out anew.
 */
function inventory(view: ProgressView): Item[] {
  const reached = new Map<string, string>();
  for (const m of [...view.milestones].reverse()) {
    if (m.kind === "level" && m.rank && m.rank !== rankFor(1) && !reached.has(m.rank)) {
      reached.set(m.rank, m.at);
    }
  }
  const owned: (Item & { at: string })[] = [
    ...[...reached].map(([rank, at]) => ({
      key: `rank:${rank}`,
      kind: "rank" as const,
      name: rank,
      mark: rank,
      meta: dayOf(at, view),
      owned: true,
      at,
    })),
    ...view.achievements
      .filter((a) => a.unlockedAt)
      .map((a) => ({
        key: `achievement:${a.code}`,
        kind: "achievement" as const,
        name: a.title,
        mark: a.icon,
        meta: dayOf(a.unlockedAt!, view),
        owned: true,
        at: a.unlockedAt!,
      })),
  ].sort((a, b) => parseInstant(b.at) - parseInstant(a.at));

  const { level, rank } = view.status;
  let next: Item | null = null;
  for (let n = level + 1; n <= LEVEL_CEILING && !next; n += 1) {
    if (rankFor(n) !== rank) {
      next = {
        key: `next:${rankFor(n)}`,
        kind: "rank",
        name: rankFor(n),
        mark: rankFor(n),
        meta: `At level ${n}`,
        owned: false,
      };
    }
  }
  return next ? [...owned, next] : owned;
}

function InventoryItem({ item }: { item: Item }) {
  const mark =
    item.kind === "rank" ? (
      <RankEmblem rank={item.mark ?? ""} size={88} className="size-18 lg:size-22" />
    ) : (
      <AchievementBadge icon={item.mark} unlocked size={88} className="size-18 lg:size-22" />
    );
  return (
    <li
      className="flex w-24 flex-col items-center gap-1.5 text-center lg:w-28"
      data-testid="inventory-item"
      data-owned={item.owned}
    >
      <span className={item.owned ? undefined : "opacity-35"}>{mark}</span>
      <span
        className={
          item.owned
            ? "type-caption font-medium text-balance"
            : "type-caption font-medium text-(--progression-muted)"
        }
      >
        {item.owned ? item.name : `Next: ${item.name}`}
        <span className="sr-only">
          {item.kind === "rank" ? " rank" : " achievement"}
          {item.owned ? ", earned" : ", not yet earned"}
        </span>
      </span>
      <span className="type-caption text-(--progression-muted)">{item.meta}</span>
    </li>
  );
}

/**
 * Rewards (doc/DESIGN_PLAN.md, V2 Phase 3D): the inventory of what logging has earned, in the
 * deep band, with the lifetime XP as its figure. Then this week's logged days and the XP log.
 * Nothing here is bought, claimed or timed.
 */
export default async function RewardsPage() {
  const view = await loadProgress();
  const header = (
    <ProgressHeader
      title="Rewards"
      description="What your logging has earned. XP never comes from spending less."
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

  const items = inventory(view);
  const owned = items.filter((i) => i.owned);
  const achievements = owned.filter((i) => i.kind === "achievement").length;
  const toFind = view.achievements.length - achievements;
  const fresh = view.status.xp === 0;

  return (
    <>
      {header}
      <GreetAchievements
        now={requestNow()}
        unlocked={view.achievements.flatMap((a) =>
          a.unlockedAt ? [{ code: a.code, title: a.title, unlockedAt: a.unlockedAt }] : [],
        )}
      />

      <DeepBand
        aria-labelledby="inventory"
        className="flex flex-col items-center gap-8 pt-10 pb-9 text-center lg:gap-10 lg:pt-12 lg:pb-11"
      >
        <div className="relative flex flex-col items-center gap-1">
          <Halo className="size-[36rem] lg:size-[52rem]" />
          <h2 id="inventory" className="relative type-label text-(--progression-muted)">
            Earned so far
          </h2>
          <p className="relative type-rank money" data-testid="reward-xp">
            {view.status.xp} XP
          </p>
          <p className="relative type-body text-(--progression-muted)">
            Level <span className="money">{view.status.level}</span> ·{" "}
            <span className="money">{achievements}</span>{" "}
            {achievements === 1 ? "achievement" : "achievements"}
          </p>
        </div>

        {owned.length === 0 && (
          <p
            className="relative max-w-sm type-body text-(--progression-muted)"
            data-testid="inventory-empty"
          >
            {fresh
              ? "Nothing earned yet. Your first logged day earns 10 XP."
              : "No badges or new ranks yet. They come from your own logging."}{" "}
            {fresh && (
              <Link
                href="/add"
                className="-my-3 inline-flex min-h-11 items-center rounded-md px-1 font-medium underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Quick add
              </Link>
            )}
          </p>
        )}
        <ul className="relative flex flex-wrap justify-center gap-x-2 gap-y-6 lg:gap-x-8">
          {items.map((item) => (
            <InventoryItem key={item.key} item={item} />
          ))}
        </ul>
        {toFind > 0 && (
          <Link
            href="/rewards/achievements"
            className="relative -my-3 inline-flex min-h-11 items-center rounded-md px-2 type-caption text-(--progression-muted) underline-offset-4 outline-none hover:text-(--progression-text) hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="money">{toFind}</span>&nbsp;
            {toFind === 1 ? "achievement" : "achievements"} still to find
          </Link>
        )}
      </DeepBand>

      <Section title="This week" divided={false}>
        <WeekStrip week={view.week} today={view.today} />
      </Section>

      <Section
        title="XP log"
        meta="The 20 newest awards."
        action={
          <details className="group relative">
            <summary className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-text-secondary outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Info className="size-4" aria-hidden="true" />
              <span className="sr-only">How XP works</span>
            </summary>
            <p className="absolute top-full right-0 z-10 w-72 rounded-xl border border-(--panel-border) bg-popover p-3 type-caption text-popover-foreground shadow-(--surface-overlay-shadow)">
              XP comes from logging, categorising, reviewing and setting money aside, never from
              spending less. Undoing or deleting an entry takes back that day’s XP and mission
              progress. Achievements stay once unlocked, with their XP.
            </p>
          </details>
        }
      >
        {view.history.length === 0 ? (
          <p className="type-body text-text-secondary">
            No XP yet. Each award shows here: what earned it, and when.
          </p>
        ) : (
          <DataList data-testid="xp-history">
            {view.history.map((row) => (
              <DataRow
                key={row.key}
                title={row.label}
                detail={dayOf(row.at, view)}
                value={<span className="type-caption text-text-secondary">+{row.xp} XP</span>}
              />
            ))}
          </DataList>
        )}
      </Section>
    </>
  );
}
