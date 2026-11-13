import type { Metadata } from "next";

import { GreetAchievements } from "@/components/rewards/greet-achievements";
import { AchievementBadge } from "@/components/rewards/emblems";
import { ProgressHeader, ProgressUnavailable } from "@/components/rewards/progress-page";
import { DeepBand, Halo } from "@/components/rewards/rank-band";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { requestNow } from "@/lib/data/session";
import { type AchievementView, type ProgressView, dayOf, loadProgress } from "@/lib/rewards/view";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Achievements" };

const STATE_WORDS = { unlocked: "unlocked", in_progress: "in progress", locked: "locked" } as const;

/**
 * One badge in the collection: the badge and its name. Opening it shows the badge large with
 * what earns it, and the day it was unlocked or how far along it is.
 */
function Badge({ achievement: a, view }: { achievement: AchievementView; view: ProgressView }) {
  const unlocked = a.state === "unlocked";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="achievement"
          data-state={a.state}
          data-xp={a.xp}
          className="flex w-full flex-col items-center gap-2 rounded-xl px-1 py-2 transition-colors duration-(--duration-quick) outline-none hover:bg-(--progression-raised) focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <AchievementBadge
            icon={a.icon}
            unlocked={unlocked}
            size={112}
            className="size-20 lg:size-28"
          />
          <span
            className={cn(
              "type-caption font-medium text-balance",
              !unlocked && "text-(--progression-muted)",
            )}
          >
            {a.title}
            <span className="sr-only">, {STATE_WORDS[a.state]}</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent data-testid="achievement-detail">
        <DialogHeader>
          <DialogTitle>{a.title}</DialogTitle>
          <DialogDescription>{a.description}</DialogDescription>
        </DialogHeader>
        <div className="progression-deep relative flex justify-center overflow-hidden rounded-2xl py-8 [background:var(--progression-band-bg)]">
          <Halo className="size-[28rem]" />
          <AchievementBadge
            icon={a.icon}
            unlocked={unlocked}
            size={160}
            label={`${a.title} badge, ${STATE_WORDS[a.state]}`}
            className="relative"
          />
        </div>
        {unlocked ? (
          <p className="type-body" data-testid="achievement-earned">
            Unlocked {a.unlockedAt ? dayOf(a.unlockedAt, view) : ""} ·{" "}
            <span className="money">+{a.xp} XP</span>
          </p>
        ) : (
          <div className="flex flex-col gap-2" data-testid="achievement-progress">
            {a.target > 1 && (
              <Progress
                steps={a.target}
                value={a.progress}
                tone="neutral"
                aria-label={`${a.title} progress`}
              />
            )}
            <p className="type-body text-text-secondary">
              {a.target > 1 ? (
                <span className="money">
                  {a.progress} of {a.target}
                </span>
              ) : (
                "Not yet"
              )}{" "}
              · <span className="money">{a.xp} XP</span> when unlocked
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Achievements (doc/DESIGN_PLAN.md, V2 Phase 3D): the collection in the deep band, with its count
 * as the page's main number. Names only in the grid; a badge opens to say what earns it. Rare by
 * design, and once unlocked they stay unlocked.
 */
export default async function AchievementsPage() {
  const view = await loadProgress();
  const header = (
    <ProgressHeader
      title="Achievements"
      description="Earned from your own logging. Once unlocked, an achievement stays."
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

  const total = view.achievements.length;
  const unlocked = view.achievements.filter((a) => a.state === "unlocked").length;
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
        aria-labelledby="collection"
        className="flex flex-col items-center gap-8 pt-10 pb-8 lg:gap-10 lg:pt-12 lg:pb-10"
      >
        <div className="relative flex flex-col items-center gap-1 text-center">
          <Halo className="size-[36rem] lg:size-[52rem]" />
          <h2 id="collection" className="relative type-label text-(--progression-muted)">
            Collection
          </h2>
          {total === 0 ? (
            <>
              <p className="relative type-display">No achievements yet</p>
              <p className="relative max-w-sm type-body text-(--progression-muted)">
                Achievements appear here once they’re available. Your XP for each logged day still
                counts.
              </p>
            </>
          ) : (
            <>
              <p className="relative type-rank money" data-testid="achievement-count">
                {unlocked}
                <span className="text-(--progression-muted)"> of {total}</span>
              </p>
              <p className="relative type-caption text-(--progression-muted)">
                {unlocked === 0
                  ? "None yet. Open a badge to see what earns it."
                  : "Open a badge to see what earned it."}
              </p>
            </>
          )}
        </div>
        {total > 0 && (
          <ul className="relative flex w-full max-w-4xl flex-wrap justify-center gap-y-4 lg:gap-y-8">
            {view.achievements.map((a) => (
              <li key={a.code} className="w-1/3 min-w-0 sm:w-1/4">
                <Badge achievement={a} view={view} />
              </li>
            ))}
          </ul>
        )}
      </DeepBand>
    </>
  );
}
