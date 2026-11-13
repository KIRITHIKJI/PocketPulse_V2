import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AchievementBadge, RANK_ORDER, RankEmblem, rankTier } from "@/components/rewards/emblems";
import { rankFor } from "@/domain";

describe("RankEmblem", () => {
  it("knows every rank the domain hands out, in order", () => {
    const seen = [...new Set(Array.from({ length: 40 }, (_, i) => rankFor(i + 1)))];
    expect(seen).toEqual([...RANK_ORDER]);
    for (let level = 1; level <= 40; level += 1) {
      expect(rankTier(rankFor(level))).toBe(RANK_ORDER.indexOf(rankFor(level) as never));
    }
  });

  it("adds a layer at each rank, large and small", () => {
    for (const size of [24, 240]) {
      const counts = RANK_ORDER.map((rank) => {
        const { container } = render(<RankEmblem rank={rank} size={size} />);
        return container.querySelectorAll("svg *").length;
      });
      // Never fewer parts at a higher rank.
      for (let i = 1; i < counts.length; i += 1)
        expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
      expect(counts[4]).toBeGreaterThan(counts[0]!);
    }
  });

  it("has an accessible name when labelled, and is hidden when the rank is written beside it", () => {
    render(<RankEmblem rank="Planner" size={240} label="Rank emblem: Planner" />);
    expect(screen.getByRole("img", { name: "Rank emblem: Planner" })).toHaveAttribute(
      "data-rank-tier",
      "2",
    );
    const { container } = render(<RankEmblem rank="Planner" size={24} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("falls back to the first rank for a name it doesn't know", () => {
    expect(rankTier("Unknown")).toBe(0);
  });

  it("is drawn from tokens, not fixed colours", () => {
    const { container } = render(<RankEmblem rank="Steward" size={240} />);
    const colours = [...container.querySelectorAll("[fill],[stroke]")].flatMap((el) =>
      ["fill", "stroke"].map((a) => el.getAttribute(a)).filter((v) => v && v !== "none"),
    );
    for (const c of colours) expect(c).toMatch(/^var\(--emblem-/);
  });
});

describe("AchievementBadge", () => {
  // Every achievement in the seeded catalog has its own glyph.
  const seed = readFileSync("supabase/migrations/20261026000500_seed_defaults.sql", "utf8");
  const block = seed.slice(
    seed.indexOf("insert into public.achievements"),
    seed.indexOf("insert into public.quests"),
  );
  const icons = [...block.matchAll(/'([a-z-]+)', \d+\)/g)].map((m) => m[1]!);

  it("covers every achievement in the catalog with a distinct glyph", () => {
    expect(icons).toHaveLength(7);
    const drawn = icons.map((icon) => {
      const { container } = render(<AchievementBadge icon={icon} unlocked size={96} />);
      return container.querySelector("g")!.innerHTML;
    });
    const { container } = render(<AchievementBadge icon="no-such-icon" unlocked size={96} />);
    const fallback = container.querySelector("g")!.innerHTML;
    expect(new Set(drawn).size).toBe(icons.length);
    for (const d of drawn) expect(d).not.toBe(fallback);
  });

  it("draws locked as a dim outline with no fill and no accent", () => {
    render(
      <AchievementBadge
        icon="flame"
        unlocked={false}
        size={96}
        label="7-Day Logging Streak, locked"
      />,
    );
    const badge = screen.getByRole("img", { name: "7-Day Logging Streak, locked" });
    expect(badge).toHaveAttribute("data-state", "locked");
    expect(badge.querySelector('[fill="var(--emblem-accent)"]')).toBeNull();
    expect(badge.querySelector('[fill="var(--emblem-lo)"]')).toBeNull();
  });

  it("marks unlocked with the cut metal and the accent", () => {
    render(
      <AchievementBadge icon="flame" unlocked size={24} label="7-Day Logging Streak, unlocked" />,
    );
    const badge = screen.getByRole("img", { name: "7-Day Logging Streak, unlocked" });
    expect(badge.querySelector('[fill="var(--emblem-accent)"]')).not.toBeNull();
  });
});
