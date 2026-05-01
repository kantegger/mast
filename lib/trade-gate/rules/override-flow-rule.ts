import type { Rule } from "../types";

export const overrideFlowRule: Rule = {
  id: "override-flow-rule",

  async evaluate(intent, { prisma, now }) {
    if (!intent.overrideFlowId) return null;

    const flow = await prisma.overrideFlow.findUnique({
      where: { id: intent.overrideFlowId },
      select: {
        id: true,
        pathStepId: true,
        severity: true,
        cooldownSeconds: true,
        cooldownStartsAt: true,
        status: true,
        pathStep: { select: { pathId: true } },
      },
    });

    if (!flow) {
      return {
        kind: "blocked",
        ruleId: "override-flow-rule",
        reason: `OverrideFlow ${intent.overrideFlowId} does not exist.`,
      };
    }

    if (intent.pathStepId && !flow.pathStepId) {
      return {
        kind: "blocked",
        ruleId: "override-flow-rule",
        reason: "OverrideFlow must be bound to the same PathStep as the trade.",
      };
    }

    if (!intent.pathStepId && flow.pathStepId) {
      return {
        kind: "blocked",
        ruleId: "override-flow-rule",
        reason: "Trade must supply the PathStep bound to this OverrideFlow.",
      };
    }

    if (flow.pathStepId && flow.pathStepId !== intent.pathStepId) {
      return {
        kind: "blocked",
        ruleId: "override-flow-rule",
        reason: "OverrideFlow is not bound to the supplied PathStep.",
      };
    }

    if (flow.pathStep?.pathId && flow.pathStep.pathId !== intent.pathId) {
      return {
        kind: "blocked",
        ruleId: "override-flow-rule",
        reason: "OverrideFlow is not bound to the supplied Path.",
      };
    }

    if (flow.status === "confirmed") {
      return { kind: "allowed" };
    }

    if (flow.status === "cooldown") {
      return cooldownDecision(flow, now);
    }

    if (flow.status === "pending") {
      return {
        kind: "requires_override",
        ruleId: "override-flow-rule",
        severity: flow.severity,
        reason: "OverrideFlow is pending; confirm it to start or complete the friction flow.",
      };
    }

    return {
      kind: "blocked",
      ruleId: "override-flow-rule",
      reason: `OverrideFlow is ${flow.status}; it cannot authorize a trade.`,
    };
  },
};

function cooldownDecision(
  flow: {
    id: string;
    severity: "low" | "medium" | "high";
    cooldownSeconds: number;
    cooldownStartsAt: Date | null;
  },
  now: Date,
) {
  if (!flow.cooldownStartsAt) {
    return {
      kind: "cooldown" as const,
      overrideFlowId: flow.id,
      remainingSeconds: flow.cooldownSeconds,
    };
  }

  const elapsedSeconds = Math.floor(
    (now.getTime() - flow.cooldownStartsAt.getTime()) / 1000,
  );
  const remainingSeconds = Math.max(flow.cooldownSeconds - elapsedSeconds, 0);

  if (remainingSeconds > 0) {
    return {
      kind: "cooldown" as const,
      overrideFlowId: flow.id,
      remainingSeconds,
    };
  }

  return {
    kind: "requires_override" as const,
    ruleId: "override-flow-rule",
    severity: flow.severity,
    reason: "OverrideFlow cooldown has elapsed; confirm again before executing.",
  };
}
