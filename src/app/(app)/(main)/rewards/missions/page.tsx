import type { Metadata } from "next";

import { ProgressHeader, ProgressUnavailable } from "@/components/rewards/progress-page";
import { MissionRow, ObjectiveBand, currentObjective } from "@/components/rewards/progress-parts";
import { MISSION_GROUPS } from "@/domain";
import { loadProgress } from "@/lib/rewards/view";

export const metadata: Metadata = { title: "Missions" };

/**
 * Missions (doc/DESIGN_PLAN.md, V2 Phase 3D): the current objective in the deep band, then the
 * other missions as journal entries on a rail, daily, weekly and long-term. All optional: Skip
 * (in each entry's menu) costs nothing, and Bring back undoes it.
 */
export default async function MissionsPage() {
  const view = await loadProgress();
  const header = (
    <ProgressHeader
      title="Missions"
      description="Small, optional steps: log, look, sort, set aside. None asks you to spend or save an amount."
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

  const objective = currentObjective(view.missions);
  const groups = MISSION_GROUPS.map((group) => {
    const missions = view.missions.filter((m) => m.cadence === group.cadence);
    const open = missions.filter((m) => !m.skipped);
    return {
      ...group,
      total: missions.length,
      open: open.length,
      done: open.filter((m) => m.complete).length,
      // The current objective leads the page; its entry isn't repeated in the journal.
      rows: missions.filter((m) => m.code !== objective?.code),
    };
  }).filter((g) => g.total > 0);

  return (
    <>
      {header}
      <ObjectiveBand mission={objective} hasMissions={view.missions.length > 0} />

      {groups.length > 0 && (
        <div className="flex w-full max-w-3xl flex-col gap-section">
          {groups.map((group) => (
            <section
              key={group.cadence}
              aria-labelledby={`missions-${group.cadence}-title`}
              data-testid={`missions-${group.cadence}`}
              className="flex flex-col gap-1"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-(--section-divider) pb-2">
                <h2
                  id={`missions-${group.cadence}-title`}
                  className="type-label text-text-secondary"
                >
                  {group.label}
                </h2>
                <p className="type-caption text-text-secondary">
                  <span className="money">
                    {group.done} of {group.open}
                  </span>{" "}
                  done · {group.resets}
                </p>
              </div>
              {group.open === 0 && (
                <p className="py-2 type-caption text-text-secondary">
                  All skipped. That’s fine; bring one back whenever you like.
                </p>
              )}
              {group.rows.length > 0 && (
                <ol className="relative flex flex-col before:absolute before:top-5 before:bottom-5 before:left-5 before:w-px before:bg-(--section-divider)">
                  {group.rows.map((m) => (
                    <MissionRow key={m.code} mission={m} />
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
