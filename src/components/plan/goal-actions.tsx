"use client";

import * as React from "react";
import { Archive, ArchiveRestore, CircleCheck, LoaderCircle, Pause, Play, X } from "lucide-react";

import { ConfirmAction, InlineAction } from "@/components/forms/inline-action";
import { FormMessage } from "@/components/forms/form-parts";
import { GoalSeal } from "@/components/rewards/emblems";
import { Button } from "@/components/ui/button";
import { type GoalStatus, moneyFormatter } from "@/domain";
import { setGoalStatus } from "@/lib/actions/goals";
import type { EntryKit } from "@/lib/data/entry-kit";
import { IDLE, type FormState } from "@/lib/form-state";

/**
 * The quiet completion moment, in the style of the level-up (doc/DESIGN_PLAN.md, V2 Phase 3D): the
 * goal's seal is revealed once (`pp-emblem-reveal`, none under reduced motion) beside a message
 * that stays until dismissed. No burst; it covers nothing and blocks nothing.
 */
function GoalCelebration({
  title,
  savedLabel,
  onDismiss,
}: {
  title: string;
  savedLabel: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      data-testid="goal-celebration"
      className="flex items-center gap-4 border-y border-(--section-divider) py-4"
    >
      <GoalSeal size={56} className="pp-emblem-reveal" />
      <div className="min-w-0 flex-1">
        <p className="type-label text-text-secondary">Goal complete</p>
        <p className="type-heading">You did it: {title} is complete</p>
        <p className="type-body text-text-secondary">{savedLabel}</p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={onDismiss}>
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Status changes for one goal. Holds the celebration, which outlives the button that starts it. */
export function GoalStatusActions({
  goalId,
  title,
  status,
  reachedTarget,
  savedPaise,
  currency,
}: {
  goalId: string;
  title: string;
  status: GoalStatus;
  reachedTarget: boolean;
  savedPaise: number;
  currency: EntryKit["currency"];
}) {
  const money = moneyFormatter(currency);
  const [celebrating, setCelebrating] = React.useState(false);
  const [state, setState] = React.useState<FormState>(IDLE);
  const [pending, startTransition] = React.useTransition();
  const idle = { id: goalId };

  function complete() {
    const formData = new FormData();
    formData.set("id", goalId);
    formData.set("action", "complete");
    startTransition(async () => {
      try {
        const result = await setGoalStatus(IDLE, formData);
        setState(result);
        if (result.status === "success") setCelebrating(true);
      } catch {
        setState({ status: "error", message: "Couldn’t reach PocketPulse. Try again." });
      }
    });
  }

  return (
    <>
      {celebrating && (
        <GoalCelebration
          title={title}
          savedLabel={
            savedPaise > 0 ? (
              <>
                <span className="text-money-earmark money">{money(savedPaise)}</span> is still set
                aside. Release it, or record the purchase, when you use it.
              </>
            ) : (
              "Every step of it stays in this goal’s history."
            )
          }
          onDismiss={() => setCelebrating(false)}
        />
      )}
      {state.status === "error" && <FormMessage state={state} />}
      <div className="flex flex-wrap items-center gap-1" data-testid="goal-status-actions">
        {status === "active" && (
          <Button
            variant={reachedTarget ? "default" : "ghost"}
            size="sm"
            onClick={complete}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <CircleCheck aria-hidden="true" />
            )}
            Mark complete
          </Button>
        )}
        {status === "active" && (
          <InlineAction
            action={setGoalStatus}
            fields={{ ...idle, action: "pause" }}
            pendingLabel="Pausing…"
          >
            <Pause aria-hidden="true" />
            Pause
          </InlineAction>
        )}
        {status === "paused" && (
          <InlineAction
            action={setGoalStatus}
            fields={{ ...idle, action: "resume" }}
            pendingLabel="Resuming…"
          >
            <Play aria-hidden="true" />
            Resume
          </InlineAction>
        )}
        {(status === "completed" || status === "archived") && (
          <InlineAction
            action={setGoalStatus}
            fields={{ ...idle, action: "reopen" }}
            pendingLabel="Reopening…"
          >
            <ArchiveRestore aria-hidden="true" />
            {status === "archived" ? "Restore" : "Reopen"}
          </InlineAction>
        )}
        {status !== "archived" && (
          <ConfirmAction
            action={setGoalStatus}
            fields={{ ...idle, action: "archive" }}
            trigger={
              <Button variant="ghost" size="sm">
                <Archive aria-hidden="true" />
                Archive
              </Button>
            }
            title={`Archive ${title}?`}
            description={
              <>
                <p>It moves out of your active goals. Nothing is deleted.</p>
                <p>
                  {savedPaise > 0
                    ? `The ${money(savedPaise)} set aside stays set aside, so it still comes off safe-to-spend, until you release it.`
                    : "Its history stays, and you can restore it any time."}
                </p>
              </>
            }
            confirmLabel="Archive"
            pendingLabel="Archiving…"
          />
        )}
      </div>
    </>
  );
}
