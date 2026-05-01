import { describe, expect, it } from "vitest";
import {
  dashboardSummary,
  dominantDeviationPatterns,
  dominantPatternHeadline,
  deviationsByType,
  deviationsDailyTrend,
  overrideHeatmap,
  overrideLifecycleSummary,
} from "./dashboard";

const NOW = new Date("2026-05-01T12:00:00Z");
const day = (iso: string) => new Date(iso);

describe("dashboardSummary", () => {
  it("reports a healthy zone, no restrictions, multiplier 1 when score >= 80", () => {
    const out = dashboardSummary([{ type: "early_exit" }]);
    expect(out.score).toBe(98);
    expect(out.zone).toBe("healthy");
    expect(out.blocksNewPositions).toBe(false);
    expect(out.cooldownMultiplier).toBe(1);
    expect(out.totalDeviations).toBe(1);
    expect(out.totalPenalty).toBe(2);
    expect(out.windowDays).toBe(30);
  });

  it("reports a caution zone when score is 60-79 (no behavior change yet)", () => {
    // 8 emotional × 4 = 32 → score 68
    const out = dashboardSummary(
      Array.from({ length: 8 }, () => ({ type: "emotional" })),
    );
    expect(out.score).toBe(68);
    expect(out.zone).toBe("caution");
    expect(out.blocksNewPositions).toBe(false);
    expect(out.cooldownMultiplier).toBe(1);
  });

  it("reports a restricted zone when score is 40-59 (×2 cooldown, blocks new positions)", () => {
    // 14 emotional × 4 = 56 → score 44
    const out = dashboardSummary(
      Array.from({ length: 14 }, () => ({ type: "emotional" })),
    );
    expect(out.score).toBe(44);
    expect(out.zone).toBe("restricted");
    expect(out.blocksNewPositions).toBe(true);
    expect(out.cooldownMultiplier).toBe(2);
  });

  it("reports a locked zone when score is below 40 (×4 cooldown)", () => {
    // 20 emotional × 4 = 80 → score 20
    const out = dashboardSummary(
      Array.from({ length: 20 }, () => ({ type: "emotional" })),
    );
    expect(out.score).toBe(20);
    expect(out.zone).toBe("locked");
    expect(out.blocksNewPositions).toBe(true);
    expect(out.cooldownMultiplier).toBe(4);
  });

  it("ignores unknown deviation types in the penalty calculation", () => {
    const out = dashboardSummary([
      { type: "emotional" },
      { type: "made_up_thing" },
    ]);
    expect(out.score).toBe(96);
    expect(out.totalDeviations).toBe(2);
    expect(out.totalPenalty).toBe(4);
  });
});

describe("deviationsByType", () => {
  it("groups deviations by type with count, weight, and total penalty", () => {
    const out = deviationsByType([
      { type: "emotional" },
      { type: "emotional" },
      { type: "early_exit" },
      { type: "unplanned_trade" },
      { type: "unplanned_trade" },
      { type: "unplanned_trade" },
    ]);

    expect(out).toEqual([
      { type: "unplanned_trade", count: 3, weight: 3, penalty: 9 },
      { type: "emotional", count: 2, weight: 4, penalty: 8 },
      { type: "early_exit", count: 1, weight: 2, penalty: 2 },
    ]);
  });

  it("orders entries by total penalty descending so the worst patterns surface first", () => {
    const out = deviationsByType([
      { type: "early_exit" },
      { type: "early_exit" },
      { type: "early_exit" },
      { type: "early_exit" },
      { type: "early_exit" },
      { type: "emotional" },
    ]);

    expect(out[0].type).toBe("early_exit");
    expect(out[0].penalty).toBe(10);
    expect(out[1].type).toBe("emotional");
    expect(out[1].penalty).toBe(4);
  });

  it("returns [] when there are no deviations", () => {
    expect(deviationsByType([])).toEqual([]);
  });

  it("preserves unknown types with weight 0 so the user can see them surface", () => {
    const out = deviationsByType([
      { type: "made_up_thing" },
      { type: "made_up_thing" },
    ]);
    expect(out).toEqual([
      { type: "made_up_thing", count: 2, weight: 0, penalty: 0 },
    ]);
  });
});

describe("dominantDeviationPatterns", () => {
  it("returns the top patterns by penalty share with a dominant flag", () => {
    const out = dominantDeviationPatterns([
      { type: "emotional" },
      { type: "emotional" },
      { type: "emotional" },
      { type: "unplanned_trade" },
      { type: "unplanned_trade" },
      { type: "early_exit" },
    ]);

    expect(out).toEqual([
      {
        type: "emotional",
        count: 3,
        weight: 4,
        penalty: 12,
        penaltyShare: 60,
        dominant: true,
      },
      {
        type: "unplanned_trade",
        count: 2,
        weight: 3,
        penalty: 6,
        penaltyShare: 30,
        dominant: false,
      },
      {
        type: "early_exit",
        count: 1,
        weight: 2,
        penalty: 2,
        penaltyShare: 10,
        dominant: false,
      },
    ]);
  });

  it("limits the number of patterns returned", () => {
    const out = dominantDeviationPatterns(
      [
        { type: "emotional" },
        { type: "unplanned_trade" },
        { type: "early_exit" },
        { type: "no_action" },
      ],
      2,
    );

    expect(out.map((row) => row.type)).toEqual(["emotional", "unplanned_trade"]);
  });

  it("ignores unknown zero-weight types and returns [] when no penalty exists", () => {
    expect(dominantDeviationPatterns([{ type: "made_up_thing" }])).toEqual([]);
  });
});

describe("dominantPatternHeadline", () => {
  it("returns a 'distributed' headline when no patterns exist", () => {
    expect(dominantPatternHeadline([])).toEqual({
      title: "none",
      copy: "Recent penalty is distributed across multiple deviation types.",
    });
  });

  it("returns a 'distributed' headline when patterns exist but none are dominant", () => {
    const patterns = dominantDeviationPatterns([
      { type: "emotional" },
      { type: "unplanned_trade" },
      { type: "no_action" },
      { type: "early_exit" },
    ]);
    // Penalties 4/3/3/2 → shares 33%/25%/25%/17% — none ≥ 40%.
    expect(patterns.every((p) => !p.dominant)).toBe(true);
    expect(dominantPatternHeadline(patterns)).toEqual({
      title: "none",
      copy: "Recent penalty is distributed across multiple deviation types.",
    });
  });

  it("names the single dominant pattern with its share", () => {
    const patterns = dominantDeviationPatterns([
      { type: "emotional" },
      { type: "emotional" },
      { type: "emotional" },
      { type: "early_exit" },
    ]);
    // emotional 12 (86%) vs early_exit 2 (14%).
    expect(dominantPatternHeadline(patterns)).toEqual({
      title: "emotional",
      copy: "emotional accounts for 86% of recent penalty.",
    });
  });

  it("names BOTH patterns with their shares when two cross the dominance threshold", () => {
    const patterns = dominantDeviationPatterns([
      { type: "emotional" },
      { type: "unplanned_trade" },
      { type: "unplanned_trade" },
    ]);
    // emotional 4 (40%) and unplanned_trade 6 (60%) — both ≥ 40%.
    expect(patterns.filter((p) => p.dominant).map((p) => p.type)).toEqual([
      "unplanned_trade",
      "emotional",
    ]);
    expect(dominantPatternHeadline(patterns)).toEqual({
      title: "unplanned_trade + emotional",
      copy: "unplanned_trade (60%) and emotional (40%) jointly dominate recent penalty.",
    });
  });
});

describe("deviationsDailyTrend", () => {
  it("returns one bucket per day across the window, oldest first", () => {
    const out = deviationsDailyTrend([], NOW, 7);
    expect(out).toHaveLength(7);
    expect(out[0].date).toBe("2026-04-25");
    expect(out[6].date).toBe("2026-05-01");
    for (const point of out) {
      expect(point.totalPenalty).toBe(0);
      expect(point.byType).toEqual({});
    }
  });

  it("buckets deviations into UTC-day rows with type counts and penalty totals", () => {
    const out = deviationsDailyTrend(
      [
        { type: "emotional", createdAt: day("2026-04-30T03:00:00Z") },
        { type: "emotional", createdAt: day("2026-04-30T22:30:00Z") },
        { type: "unplanned_trade", createdAt: day("2026-04-30T15:00:00Z") },
        { type: "early_exit", createdAt: day("2026-05-01T08:00:00Z") },
      ],
      NOW,
      3,
    );

    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ date: "2026-04-29", byType: {}, totalPenalty: 0 });
    expect(out[1]).toEqual({
      date: "2026-04-30",
      byType: { emotional: 2, unplanned_trade: 1 },
      totalPenalty: 11, // 2*4 + 1*3
    });
    expect(out[2]).toEqual({
      date: "2026-05-01",
      byType: { early_exit: 1 },
      totalPenalty: 2,
    });
  });

  it("ignores deviations outside the window", () => {
    const out = deviationsDailyTrend(
      [
        { type: "emotional", createdAt: day("2026-03-01T00:00:00Z") }, // pre-window
        { type: "emotional", createdAt: day("2026-05-01T00:00:00Z") }, // in window
      ],
      NOW,
      30,
    );

    const lastDay = out[out.length - 1];
    expect(lastDay.date).toBe("2026-05-01");
    expect(lastDay.byType).toEqual({ emotional: 1 });

    const totalAcrossWindow = out.reduce((s, p) => s + p.totalPenalty, 0);
    expect(totalAcrossWindow).toBe(4); // only the in-window emotional
  });
});

describe("overrideHeatmap", () => {
  it("returns one bucket per day with severity counts", () => {
    const out = overrideHeatmap(
      [
        { severity: "low", createdAt: day("2026-04-30T03:00:00Z") },
        { severity: "medium", createdAt: day("2026-04-30T15:00:00Z") },
        { severity: "medium", createdAt: day("2026-04-30T22:00:00Z") },
        { severity: "high", createdAt: day("2026-05-01T08:00:00Z") },
      ],
      NOW,
      3,
    );

    expect(out).toEqual([
      { date: "2026-04-29", low: 0, medium: 0, high: 0, total: 0 },
      { date: "2026-04-30", low: 1, medium: 2, high: 0, total: 3 },
      { date: "2026-05-01", low: 0, medium: 0, high: 1, total: 1 },
    ]);
  });

  it("ignores unknown severities and flows outside the window", () => {
    const out = overrideHeatmap(
      [
        { severity: "high", createdAt: day("2026-03-01T00:00:00Z") },
        { severity: "urgent", createdAt: day("2026-05-01T00:00:00Z") },
        { severity: "low", createdAt: day("2026-05-01T01:00:00Z") },
      ],
      NOW,
      30,
    );

    const total = out.reduce((sum, point) => sum + point.total, 0);
    expect(total).toBe(1);
    expect(out[out.length - 1]).toMatchObject({ low: 1, total: 1 });
  });
});

describe("overrideLifecycleSummary", () => {
  it("counts created, confirmed, executed, aborted, and currently open flows", () => {
    const out = overrideLifecycleSummary(
      [
        {
          status: "executed",
          createdAt: day("2026-04-30T00:00:00Z"),
          confirmedAt: day("2026-04-30T01:00:00Z"),
          executedAt: day("2026-05-01T00:00:00Z"),
          abortedAt: null,
        },
        {
          status: "aborted",
          createdAt: day("2026-03-01T00:00:00Z"),
          confirmedAt: null,
          executedAt: null,
          abortedAt: day("2026-04-30T00:00:00Z"),
        },
        {
          status: "cooldown",
          createdAt: day("2026-05-01T00:00:00Z"),
          confirmedAt: null,
          executedAt: null,
          abortedAt: null,
        },
      ],
      NOW,
      30,
    );

    expect(out).toEqual({
      created: 2,
      confirmed: 1,
      executed: 1,
      aborted: 1,
      open: 1,
    });
  });
});
