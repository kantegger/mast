import type { Rule } from "../types";
import {
  DISCIPLINE_BLOCK_THRESHOLD,
  disciplineScore,
  disciplineWindowStart,
} from "../../discipline/score";

export const disciplineRule: Rule = {
  id: "discipline-rule",
  async evaluate(intent, ctx) {
    const since = disciplineWindowStart(ctx.now);
    const deviations = await ctx.prisma.deviation.findMany({
      where: { createdAt: { gte: since } },
      select: { type: true },
    });
    const score = disciplineScore(deviations);

    if (score < DISCIPLINE_BLOCK_THRESHOLD && !intent.positionId && intent.intent === "buy") {
      return {
        kind: "blocked",
        ruleId: "discipline-rule",
        reason:
          "Discipline score is below 60; opening a new Position is blocked until recent deviations decay.",
        details: {
          score,
          threshold: DISCIPLINE_BLOCK_THRESHOLD,
          windowDays: 30,
        },
      };
    }

    return null;
  },
};
