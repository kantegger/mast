import type { Rule } from "../types";

// PathRule: a Trade must reference an active Path; if a PathStep is referenced
// it must belong to that Path and be 'pending' or 'active'.
// 'sell'/'reduce'/'exit' may omit pathStepId (handled by ThesisStatusRule when
// triggered by an auto-inserted exit).
export const pathRule: Rule = {
  id: "path-rule",

  async evaluate(intent, { prisma }) {
    const path = await prisma.path.findUnique({
      where: { id: intent.pathId },
      select: { id: true, thesisId: true, status: true },
    });

    if (!path) {
      return {
        kind: "blocked",
        ruleId: "path-rule",
        reason: `Path ${intent.pathId} does not exist.`,
      };
    }

    if (path.thesisId !== intent.thesisId) {
      return {
        kind: "blocked",
        ruleId: "path-rule",
        reason: `Path ${intent.pathId} does not belong to thesis ${intent.thesisId}.`,
      };
    }

    if (path.status !== "active") {
      return {
        kind: "blocked",
        ruleId: "path-rule",
        reason: `Path is ${path.status}; only 'active' paths accept trades.`,
      };
    }

    if (intent.pathStepId) {
      const step = await prisma.pathStep.findUnique({
        where: { id: intent.pathStepId },
        select: { id: true, pathId: true, status: true },
      });

      if (!step) {
        return {
          kind: "blocked",
          ruleId: "path-rule",
          reason: `PathStep ${intent.pathStepId} does not exist.`,
        };
      }

      if (step.pathId !== intent.pathId) {
        return {
          kind: "blocked",
          ruleId: "path-rule",
          reason: `PathStep does not belong to the supplied Path.`,
        };
      }

      if (step.status !== "active" && step.status !== "pending") {
        return {
          kind: "blocked",
          ruleId: "path-rule",
          reason: `PathStep is ${step.status}; only 'pending' or 'active' steps accept trades.`,
        };
      }
    }

    return null;
  },
};
