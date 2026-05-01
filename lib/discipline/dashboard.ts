import {
  DEVIATION_WEIGHTS,
  DISCIPLINE_BLOCK_THRESHOLD,
  DISCIPLINE_WINDOW_DAYS,
  disciplineScore,
  disciplineWindowStart,
  overrideCooldownMultiplier,
} from "./score";

export type DashboardZone = "healthy" | "caution" | "restricted" | "locked";

export type DashboardSummary = {
  score: number;
  zone: DashboardZone;
  blocksNewPositions: boolean;
  cooldownMultiplier: 1 | 2 | 4;
  windowDays: number;
  totalDeviations: number;
  totalPenalty: number;
};

export type ByTypeBreakdown = {
  type: string;
  count: number;
  weight: number;
  penalty: number;
}[];

export type DailyTrendPoint = {
  date: string;
  byType: Record<string, number>;
  totalPenalty: number;
};

export type OverrideSeverity = "low" | "medium" | "high";

export type OverrideHeatmapPoint = {
  date: string;
  low: number;
  medium: number;
  high: number;
  total: number;
};

export type OverrideLifecycleSummary = {
  created: number;
  confirmed: number;
  executed: number;
  aborted: number;
  open: number;
};

export type DominantDeviationPattern = {
  type: string;
  count: number;
  weight: number;
  penalty: number;
  penaltyShare: number;
  dominant: boolean;
};

export function dashboardSummary(
  deviations: { type: string }[],
): DashboardSummary {
  const score = disciplineScore(deviations);
  const totalPenalty = deviations.reduce(
    (sum, d) => sum + (DEVIATION_WEIGHTS[d.type as keyof typeof DEVIATION_WEIGHTS] ?? 0),
    0,
  );

  return {
    score,
    zone: zoneFor(score),
    blocksNewPositions: score < DISCIPLINE_BLOCK_THRESHOLD,
    cooldownMultiplier: overrideCooldownMultiplier(score) as 1 | 2 | 4,
    windowDays: DISCIPLINE_WINDOW_DAYS,
    totalDeviations: deviations.length,
    totalPenalty,
  };
}

function zoneFor(score: number): DashboardZone {
  if (score < 40) return "locked";
  if (score < DISCIPLINE_BLOCK_THRESHOLD) return "restricted";
  if (score < 80) return "caution";
  return "healthy";
}

export function deviationsByType(
  deviations: { type: string }[],
): ByTypeBreakdown {
  const counts = new Map<string, number>();
  for (const d of deviations) {
    counts.set(d.type, (counts.get(d.type) ?? 0) + 1);
  }

  const rows: ByTypeBreakdown = [];
  for (const [type, count] of counts) {
    const weight =
      DEVIATION_WEIGHTS[type as keyof typeof DEVIATION_WEIGHTS] ?? 0;
    rows.push({ type, count, weight, penalty: count * weight });
  }

  rows.sort((a, b) => b.penalty - a.penalty || b.count - a.count);
  return rows;
}

export function dominantDeviationPatterns(
  deviations: { type: string }[],
  limit = 3,
): DominantDeviationPattern[] {
  const rows = deviationsByType(deviations).filter((row) => row.penalty > 0);
  const totalPenalty = rows.reduce((sum, row) => sum + row.penalty, 0);
  if (totalPenalty === 0) return [];

  return rows.slice(0, limit).map((row) => {
    const penaltyShare = Math.round((row.penalty / totalPenalty) * 100);
    return {
      ...row,
      penaltyShare,
      dominant: penaltyShare >= 40,
    };
  });
}

export type PatternHeadline = {
  title: string;
  copy: string;
};

const DISTRIBUTED_HEADLINE: PatternHeadline = {
  title: "none",
  copy: "Recent penalty is distributed across multiple deviation types.",
};

// Maps the dominant flags (≥40% share, set in dominantDeviationPatterns) to
// the headline shown above the bars. The bars already paint each dominant
// pattern red; this keeps the textual headline aligned with that signal so a
// 60/40 split doesn't read as a single-dominant case.
export function dominantPatternHeadline(
  patterns: DominantDeviationPattern[],
): PatternHeadline {
  const dominants = patterns.filter((p) => p.dominant);
  if (dominants.length === 0) return DISTRIBUTED_HEADLINE;

  if (dominants.length === 1) {
    const [only] = dominants;
    return {
      title: only.type,
      copy: `${only.type} accounts for ${only.penaltyShare}% of recent penalty.`,
    };
  }

  const title = dominants.map((p) => p.type).join(" + ");
  const named = dominants.map((p) => `${p.type} (${p.penaltyShare}%)`);
  const copy = `${joinAnd(named)} jointly dominate recent penalty.`;
  return { title, copy };
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function deviationsDailyTrend(
  deviations: { type: string; createdAt: Date }[],
  now: Date,
  days: number,
): DailyTrendPoint[] {
  const points: DailyTrendPoint[] = [];
  const today = utcDayKey(now);
  const start = utcDayKey(disciplineWindowStart(now, days - 1));

  // Build empty buckets for every day in [start, today].
  const startDate = parseDayKey(start);
  for (let i = 0; i < days; i++) {
    const d = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate() + i,
      ),
    );
    points.push({ date: utcDayKey(d), byType: {}, totalPenalty: 0 });
  }

  const indexByDate = new Map(points.map((p, i) => [p.date, i]));

  for (const d of deviations) {
    const key = utcDayKey(d.createdAt);
    if (key < start || key > today) continue;
    const idx = indexByDate.get(key);
    if (idx === undefined) continue;

    const point = points[idx];
    point.byType[d.type] = (point.byType[d.type] ?? 0) + 1;
    point.totalPenalty +=
      DEVIATION_WEIGHTS[d.type as keyof typeof DEVIATION_WEIGHTS] ?? 0;
  }

  return points;
}

export function overrideHeatmap(
  flows: { severity: string; createdAt: Date }[],
  now: Date,
  days: number,
): OverrideHeatmapPoint[] {
  const points: OverrideHeatmapPoint[] = [];
  const today = utcDayKey(now);
  const start = utcDayKey(disciplineWindowStart(now, days - 1));

  const startDate = parseDayKey(start);
  for (let i = 0; i < days; i++) {
    const d = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate() + i,
      ),
    );
    points.push({ date: utcDayKey(d), low: 0, medium: 0, high: 0, total: 0 });
  }

  const indexByDate = new Map(points.map((p, i) => [p.date, i]));

  for (const flow of flows) {
    const key = utcDayKey(flow.createdAt);
    if (key < start || key > today) continue;
    const idx = indexByDate.get(key);
    if (idx === undefined || !isOverrideSeverity(flow.severity)) continue;

    const point = points[idx];
    point[flow.severity] += 1;
    point.total += 1;
  }

  return points;
}

export function overrideLifecycleSummary(
  flows: {
    status: string;
    createdAt: Date;
    confirmedAt: Date | null;
    executedAt: Date | null;
    abortedAt: Date | null;
  }[],
  now: Date,
  days: number,
): OverrideLifecycleSummary {
  const today = utcDayKey(now);
  const start = utcDayKey(disciplineWindowStart(now, days - 1));

  const inWindow = (date: Date | null) => {
    if (!date) return false;
    const key = utcDayKey(date);
    return key >= start && key <= today;
  };

  return {
    created: flows.filter((flow) => inWindow(flow.createdAt)).length,
    confirmed: flows.filter((flow) => inWindow(flow.confirmedAt)).length,
    executed: flows.filter((flow) => inWindow(flow.executedAt)).length,
    aborted: flows.filter((flow) => inWindow(flow.abortedAt)).length,
    open: flows.filter((flow) => flow.status === "pending" || flow.status === "cooldown")
      .length,
  };
}

function isOverrideSeverity(value: string): value is OverrideSeverity {
  return value === "low" || value === "medium" || value === "high";
}

function utcDayKey(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
