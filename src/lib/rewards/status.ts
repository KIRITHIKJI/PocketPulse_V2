import "server-only";

import { cache } from "react";

import { type LocalDate, OPT_OUT_PERIOD, daysBetween, totalXp } from "@/domain";
import { DataLoadError } from "@/lib/data/errors";
import { getProfile } from "@/lib/data/queries";
import { requestNow, requestToday, requireSession } from "@/lib/data/session";
import { type PlayerStatus, playerStatus } from "@/lib/rewards/feedback";
import { rewardCatalog } from "@/lib/rewards/sync";

export type { PlayerStatus };

/**
 * The compact status for Home: stored XP (revoked awards excluded) and the stored streak. Read
 * only, with the user's own client; the server's reward sync is what keeps them current.
 */
export const getPlayerStatus = cache(async (): Promise<PlayerStatus> => {
  const { supabase } = await requireSession();
  const [events, streak, profile] = await Promise.all([
    supabase.from("xp_events").select("xp, revoked_at"),
    supabase.from("streak_state").select("current_daily, last_logged_date").maybeSingle(),
    getProfile(),
  ]);
  const error = events.error ?? streak.error;
  if (error) throw new DataLoadError("your progress", error.code);

  const xp = totalXp(
    (events.data ?? []).map((e) => ({
      xp: Number(e.xp),
      revokedAt: (e.revoked_at as string | null) ?? null,
    })),
  );
  const last = (streak.data?.last_logged_date as LocalDate | null | undefined) ?? null;
  const today = requestToday(profile.timeZone);
  const current = last !== null && daysBetween(last, today) <= 1;
  return playerStatus(xp, current ? Number(streak.data?.current_daily ?? 0) : 0, requestNow());
});

export interface TodayMission {
  code: string;
  title: string;
  xp: number;
  /** True when every daily mission is done; the mission is then the last one finished. */
  done: boolean;
}

/**
 * Today's mission for Home's progress strip: the first daily mission not done yet, or the last one
 * once all are done. Read from the progress the last reward sync stored (no ledger read, like the
 * status above). Null when every daily mission is skipped.
 */
export const getTodayMission = cache(async (): Promise<TodayMission | null> => {
  const { supabase } = await requireSession();
  const profile = await getProfile();
  const today = requestToday(profile.timeZone);
  const [catalog, rows] = await Promise.all([
    rewardCatalog(),
    supabase
      .from("user_quests")
      .select("quest_code, period_key, completed_at, opted_out_at")
      .in("period_key", [today, OPT_OUT_PERIOD]),
  ]);
  if (rows.error) throw new DataLoadError("your missions", rows.error.code);
  const codes = (period: string, column: "completed_at" | "opted_out_at") =>
    new Set(
      (rows.data ?? [])
        .filter((row) => row.period_key === period && row[column] !== null)
        .map((row) => row.quest_code as string),
    );
  const skipped = codes(OPT_OUT_PERIOD, "opted_out_at");
  const done = codes(today, "completed_at");
  const daily = catalog.quests.filter((q) => q.cadence === "daily" && !skipped.has(q.code));
  const next = daily.find((q) => !done.has(q.code));
  const mission = next ?? daily.at(-1);
  if (!mission) return null;
  return { code: mission.code, title: mission.title, xp: mission.xp, done: !next };
});
