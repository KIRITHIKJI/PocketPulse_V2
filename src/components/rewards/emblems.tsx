import { cn } from "@/lib/utils";

/**
 * Rank emblems and achievement badges (doc/DESIGN_PLAN.md, V2 Phase 3C): inline SVG, cut metal lit
 * from the top left, colours from the `--emblem-*` tokens so both themes follow (and the deep
 * progression band, through `.progression-deep`). Higher ranks add hairline layers, never colour.
 * Drawn on a 240 grid; at 32 px and below a simpler drawing with thicker lines is used.
 */

const C = 120;
const SMALL_PX = 32;

/** A point `r` from the centre, `deg` clockwise from 12 o'clock. */
function at(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [
    Math.round((C + r * Math.cos(a)) * 100) / 100,
    Math.round((C + r * Math.sin(a)) * 100) / 100,
  ];
}

function points(list: [number, number][]): string {
  return list.map((p) => p.join(",")).join(" ");
}

function regular(sides: number, r: number, offset = 0): [number, number][] {
  return Array.from({ length: sides }, (_, i) => at(r, offset + (i * 360) / sides));
}

/**
 * Triangles from the centre to each edge, each lit by how much its edge faces the top left: the
 * cut-metal look. Returns the base shape (dark) and the facets (light at varying strength).
 */
function facets(outline: [number, number][]) {
  return outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    const mx = (a[0] + b[0]) / 2 - C;
    const my = (a[1] + b[1]) / 2 - C;
    const light = (1 + (-mx - my) / ((Math.hypot(mx, my) || 1) * Math.SQRT2)) / 2;
    return {
      points: points([[C, C], a, b]),
      opacity: Math.round((0.12 + 0.88 * light) * 100) / 100,
    };
  });
}

function Cut({ outline }: { outline: [number, number][] }) {
  return (
    <>
      <polygon points={points(outline)} fill="var(--emblem-lo)" />
      {facets(outline).map((f) => (
        <polygon key={f.points} points={f.points} fill="var(--emblem-hi)" fillOpacity={f.opacity} />
      ))}
    </>
  );
}

/** The ranks from `rankFor` in the domain, lowest first. The emblem gains a layer at each. */
export const RANK_ORDER = ["Starter", "Tracker", "Planner", "Strategist", "Steward"] as const;

export function rankTier(rank: string): number {
  return Math.max(0, RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number]));
}

const diamond = (r: number) => regular(4, r);
const PULSE = "M72 124H98L108 98L126 152L136 124H156";

/** Large drawing: Tracker adds a frame, Planner an inner line, Strategist a ring, Steward bronze. */
function SigilLarge({ tier }: { tier: number }) {
  return (
    <>
      {tier >= 3 && <circle cx={C} cy={C} r={112} fill="none" stroke="var(--emblem-mid)" />}
      {tier >= 1 && (
        <polygon points={points(diamond(104))} fill="none" stroke="var(--emblem-mid)" />
      )}
      <Cut outline={diamond(92)} />
      <polygon points={points(diamond(92))} fill="none" stroke="var(--emblem-line)" />
      <polygon points={points(diamond(68))} fill="var(--emblem-well)" />
      {tier >= 2 && (
        <polygon
          points={points(diamond(60))}
          fill="none"
          stroke={tier >= 4 ? "var(--emblem-bronze)" : "var(--emblem-line)"}
        />
      )}
      <path
        d={PULSE}
        fill="none"
        stroke="var(--emblem-hi)"
        strokeWidth={5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={166} cy={124} r={5.5} fill="var(--emblem-accent)" />
    </>
  );
}

/** 24–32 px: Planner adds the frame, Strategist and Steward a ring, Steward a bronze well edge. */
function SigilSmall({ tier }: { tier: number }) {
  const framed = tier >= 2;
  const well = framed ? 66 : 78;
  const k = well / 78;
  const x = (dx: number) => Math.round((C + dx * k) * 100) / 100;
  const y = (dy: number) => Math.round((124 + dy * k) * 100) / 100;
  return (
    <>
      {tier >= 3 ? (
        <circle cx={C} cy={C} r={112} fill="none" stroke="var(--emblem-mid)" strokeWidth={9} />
      ) : (
        framed && (
          <polygon
            points={points(diamond(114))}
            fill="none"
            stroke="var(--emblem-mid)"
            strokeWidth={9}
          />
        )
      )}
      <Cut outline={diamond(framed ? 94 : 112)} />
      <polygon
        points={points(diamond(well))}
        fill="var(--emblem-well)"
        stroke={tier >= 4 ? "var(--emblem-bronze)" : "none"}
        strokeWidth={9}
      />
      <path
        d={`M${x(-54)} 124H${x(-24)}L${x(-12)} ${y(-32)}L${x(10)} ${y(34)}L${x(22)} 124H${x(38)}`}
        fill="none"
        stroke="var(--emblem-hi)"
        strokeWidth={16}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(52)} cy={124} r={12} fill="var(--emblem-accent)" />
    </>
  );
}

interface NameProps {
  /** The accessible name. Leave it out where the rank is already written beside the emblem. */
  label?: string;
}

function a11y(label: string | undefined) {
  return label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
}

/** The rank emblem: the pulse line cut into a metal diamond. */
export function RankEmblem({
  rank,
  size,
  label,
  className,
}: NameProps & { rank: string; size: number; className?: string }) {
  const tier = rankTier(rank);
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      data-rank-tier={tier}
      {...a11y(label)}
    >
      {size <= SMALL_PX ? <SigilSmall tier={tier} /> : <SigilLarge tier={tier} />}
    </svg>
  );
}

/**
 * One engraved glyph per achievement in the catalog, keyed by its `icon` (see the seed in
 * `supabase/migrations/20261026000500_seed_defaults.sql`). Lines only, on the 240 grid.
 */
const GLYPHS: Record<string, React.ReactNode> = {
  // First 10 entries: lines in a ledger, the last one ticked.
  "list-checks": <path d="M88 96H152M88 120H152M88 144H120M132 142l10 10 18-22" />,
  // 7 days in a row: seven equal marks on one line.
  flame: (
    <path d="M84 102V134M96 102V134M108 102V134M120 102V134M132 102V134M144 102V134M156 102V134M78 148H162" />
  ),
  // Every expense sorted: four cells, all filled.
  "search-check": (
    <path
      d="M92 92h24v24H92zM124 92h24v24h-24zM92 124h24v24H92zM124 124h24v24h-24z"
      fill="currentColor"
    />
  ),
  // Money set aside: a mark dropping into a tray.
  "piggy-bank": <path d="M86 116V150H154V116M120 86l12 12-12 12-12-12z" />,
  // A month within budget: four bars under the limit line.
  target: (
    <>
      <path d="M78 94H162" strokeDasharray="8 7" />
      <path d="M92 152V124M110 152V108M128 152V118M146 152V104" />
    </>
  ),
  // Looked behind 5 insights: a lens.
  "scan-search": <path d="M137 113a25 25 0 1 1-50 0a25 25 0 1 1 50 0M131 131l22 22" />,
  // A week reviewed: a week's frame with a tick.
  "calendar-check": <path d="M84 92H156V148H84ZM84 108H156M104 128l10 10 20-20" />,
};
const FALLBACK_GLYPH = <path d="M120 96l24 24-24 24-24-24z" />;

const HEX = regular(6, 104);
const HEX_WELL = regular(6, 76);

/**
 * An achievement badge: a cut metal hexagon with the achievement's glyph. Locked is a dim
 * outline with no fill and no accent.
 */
export function AchievementBadge({
  icon,
  unlocked,
  size,
  label,
  className,
}: NameProps & { icon: string | null; unlocked: boolean; size: number; className?: string }) {
  const small = size <= SMALL_PX;
  const glyph = GLYPHS[icon ?? ""] ?? FALLBACK_GLYPH;
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      data-state={unlocked ? "unlocked" : "locked"}
      {...a11y(label)}
    >
      {unlocked ? (
        <>
          <Cut outline={HEX} />
          <polygon points={points(HEX)} fill="none" stroke="var(--emblem-line)" />
          <polygon points={points(HEX_WELL)} fill="var(--emblem-well)" />
          {!small && <polygon points={points(HEX_WELL)} fill="none" stroke="var(--emblem-line)" />}
          <circle cx={C} cy={176} r={small ? 9 : 5} fill="var(--emblem-accent)" />
        </>
      ) : (
        <polygon
          points={points(HEX)}
          fill="none"
          stroke="var(--emblem-mid)"
          strokeOpacity={0.7}
          strokeWidth={small ? 12 : 3}
        />
      )}
      <g
        fill="none"
        color={unlocked ? "var(--emblem-hi)" : "var(--emblem-mid)"}
        stroke="currentColor"
        strokeWidth={small ? 16 : 7}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={unlocked ? 1 : 0.6}
      >
        {glyph}
      </g>
    </svg>
  );
}
