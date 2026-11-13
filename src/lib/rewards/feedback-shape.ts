/**
 * The shape of a sync's reward feedback and the player status it carries, plus the one check the
 * browser needs. Kept apart from `./feedback`, which works these out on the server with the
 * domain layer, so the signed-in shell doesn't load the domain layer and its validation library.
 */

export interface PlayerStatus {
  xp: number;
  level: number;
  rank: string;
  /** XP into this level, and how much the level holds. */
  levelXp: number;
  levelSpan: number;
  progressBp: number;
  /** Days in a row with something logged, counting today or yesterday as current. */
  streakDays: number;
  /** Server time it was read, so the newest of two copies wins. */
  asOf: number;
}

export interface RewardFeedback {
  /** XP from routine awards (a logged day, a week with money set aside). Shown as a quiet line. */
  routineXp: number;
  routineReasons: string[];
  /** Missions that moved but aren't done, for a small progress note ("Steady habit · 7 of 20"). */
  progress: { code: string; title: string; progress: number; target: number }[];
  missionsCompleted: { code: string; title: string; xp: number }[];
  achievements: { code: string; title: string; description: string; xp: number }[];
  levelUp: { from: number; to: number; rank: string; rankChanged: boolean } | null;
  status: PlayerStatus;
}

/** True when the feedback has anything to show at all. */
export function hasFeedback(f: RewardFeedback): boolean {
  return (
    f.routineXp > 0 ||
    f.progress.length > 0 ||
    f.missionsCompleted.length > 0 ||
    f.achievements.length > 0 ||
    f.levelUp !== null
  );
}
