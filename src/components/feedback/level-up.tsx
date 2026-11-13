"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { markLevelSeen } from "@/components/feedback/reward-feedback";
import { RankEmblem } from "@/components/rewards/emblems";
import { Button } from "@/components/ui/button";

export interface LevelUp {
  from: number;
  to: number;
  rank: string;
  rankChanged: boolean;
  /** Where the new level stands, from the server's status. */
  levelXp: number;
  levelSpan: number;
  progressBp: number;
}

/**
 * The one peak moment of the ladder: a new level (doc/DESIGN_PLAN.md, V2 Phase 3D). The page dims,
 * the deep panel rises and the rank emblem reveals once (280 ms each, nothing under reduced
 * motion). No confetti, no sound. It waits for the person: Continue, Escape or a tap outside
 * closes it, and focus comes back afterwards. Shown once per level on this device, and only when
 * nothing else is on screen (`lib/feedback-queue.ts`).
 */
export function LevelUpMoment({ levelUp, onDismiss }: { levelUp: LevelUp; onDismiss: () => void }) {
  React.useEffect(() => markLevelSeen(levelUp.to), [levelUp.to]);
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onDismiss()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="pp-dim-in fixed inset-0 z-[60] bg-black/60" />
        <DialogPrimitive.Content
          data-testid="level-up"
          className="fixed inset-x-4 top-1/2 z-[60] mx-auto flex max-w-sm -translate-y-1/2 flex-col outline-none"
        >
          <div className="pp-level-rise progression-deep relative flex flex-col items-center overflow-hidden rounded-3xl px-6 pt-9 pb-6 text-center text-(--progression-text) shadow-[inset_0_1px_0_0_var(--progression-edge),var(--surface-overlay-shadow)] [background:var(--progression-band-bg)]">
            <div className="relative size-36">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 size-[28rem] -translate-1/2 [mask-image:radial-gradient(closest-side,black_30%,transparent)] [background:var(--progression-halo)]"
              />
              <RankEmblem
                rank={levelUp.rank}
                size={144}
                label={`${levelUp.rank} rank emblem`}
                className="pp-emblem-reveal relative"
              />
            </div>
            <p className="relative mt-6 type-label text-(--progression-muted)">
              {levelUp.rankChanged ? "New rank" : "Level up"}
            </p>
            <DialogPrimitive.Title className="relative type-rank">
              {levelUp.rank}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="relative mt-2 type-body money">
              Level {levelUp.to}
              <span className="text-(--progression-muted)"> · </span>
              {levelUp.levelXp} / {levelUp.levelSpan} XP
              <span className="mt-1 block type-caption text-(--progression-muted)">
                Your logging habit got you here.
              </span>
            </DialogPrimitive.Description>
            <DialogPrimitive.Close asChild>
              <Button className="relative mt-6 w-full" autoFocus>
                Continue
              </Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
