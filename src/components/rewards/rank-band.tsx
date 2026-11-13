import Link from "next/link";

import { RankEmblem } from "@/components/rewards/emblems";
import type { PlayerStatus } from "@/lib/rewards/feedback";

const QUARTERS = [0, 90, 180, 270];

/**
 * The XP ring: a thin circle around the emblem, starting at 12 o'clock, with a faint track and a
 * mark at each quarter. It fills once on load (`pp-xp-ring`; reduced motion shows it full at once).
 */
function XpRing({ status }: { status: PlayerStatus }) {
  const filled = Math.min(100, status.progressBp / 100);
  return (
    <svg viewBox="0 0 296 296" className="absolute inset-0 size-full" aria-hidden="true">
      <circle
        cx="148"
        cy="148"
        r="144"
        fill="none"
        stroke="var(--emblem-line)"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
      {QUARTERS.map((deg) => (
        <line
          key={deg}
          x1="148"
          y1="-1"
          x2="148"
          y2="11"
          transform={`rotate(${deg} 148 148)`}
          stroke="var(--progression-muted)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {filled > 0 && (
        <circle
          cx="148"
          cy="148"
          r="144"
          fill="none"
          stroke="var(--emblem-accent)"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - filled}
          transform="rotate(-90 148 148)"
          className="pp-xp-ring"
        />
      )}
    </svg>
  );
}

/**
 * Player status's one dominant visual (doc/DESIGN_PLAN.md, V2 Phase 3C): a deep band with the rank
 * emblem inside the XP ring, the rank name, and the level line. Stays deep in the light theme.
 * Every figure is the stored status, as before.
 */
export function RankBand({ status }: { status: PlayerStatus }) {
  const fresh = status.xp === 0;
  const next = status.level + 1;
  return (
    <section
      aria-labelledby="player-rank"
      className="progression-deep relative -mx-4 flex flex-col items-center overflow-hidden px-4 pt-10 pb-9 text-(--progression-text) shadow-[inset_0_1px_0_0_var(--progression-edge)] [background:var(--progression-band-bg)] sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:pt-12 lg:pb-11"
    >
      <div
        role="progressbar"
        aria-label={`XP towards level ${next}`}
        aria-valuemin={0}
        aria-valuemax={status.levelSpan}
        aria-valuenow={status.levelXp}
        aria-valuetext={`${status.levelXp} of ${status.levelSpan} XP`}
        className="relative size-[172px] lg:size-[296px]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 size-[44rem] -translate-1/2 [mask-image:radial-gradient(closest-side,black_30%,transparent)] [background:var(--progression-halo)] lg:size-[64rem]"
        />
        <XpRing status={status} />
        <RankEmblem
          rank={status.rank}
          size={240}
          label={`${status.rank} rank emblem`}
          className="absolute inset-[5.4%] size-[89.2%]"
        />
      </div>
      <p className="relative mt-6 type-label text-(--progression-muted) lg:mt-8">Rank</p>
      <h2 id="player-rank" className="relative type-rank" data-testid="reward-rank">
        {status.rank}
      </h2>
      <p className="relative mt-2 type-body money" data-testid="reward-level">
        Level {status.level}
        <span className="text-(--progression-muted)"> · </span>
        <span data-testid="reward-level-xp">
          {status.levelXp} / {status.levelSpan} XP
        </span>
      </p>
      <p
        className="relative mt-1 type-caption text-(--progression-muted)"
        data-testid="reward-to-next"
      >
        {fresh ? (
          <>
            Your first logged day earns 10 XP.{" "}
            <Link
              href="/add"
              className="-my-3 inline-flex min-h-11 items-center rounded-md px-1 font-medium text-(--progression-text) underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Quick add
            </Link>
          </>
        ) : (
          <>
            <span className="money">{status.levelSpan - status.levelXp}</span> XP to level {next}
          </>
        )}
      </p>
    </section>
  );
}
