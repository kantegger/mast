import { prisma } from "./db";

// De-financialized metrics. Deliberately omits realised/unrealised P&L,
// total return, and absolute capital change. P&L is only accessible via the
// ViewPnLFlow friction layer.

export type PositionMetrics = {
  positionId: string;
  symbol: string;
  side: "long" | "short";

  thesisHealth: {
    status: "active" | "broken_candidate" | "broken";
    coreVariableTotal: number;
    coreVariableValid: number;
    maxBreakRisk: "low" | "medium" | "high";
    label: string;
  };

  pathProgress: {
    totalSteps: number;
    completedSteps: number;
    activeStepDescription: string | null;
    percent: number;
    label: string;
  };

  distanceToTrigger: {
    pendingCount: number;
    nearestLabel: string | null;
    label: string;
  };

  riskExposure: {
    riskBudgetPct: number | null;
    label: string;
  };
};

const RISK_RANK = { low: 0, medium: 1, high: 2 } as const;

export async function getPositionMetrics(
  positionId: string,
): Promise<PositionMetrics | null> {
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: {
      thesis: {
        include: { variables: true },
      },
      path: {
        include: {
          steps: { orderBy: { order: "asc" } },
          triggers: {
            where: { status: "pending" },
            orderBy: { priority: "desc" },
          },
        },
      },
    },
  });

  if (!position) return null;

  const coreVariables = position.thesis.variables.filter((v) => v.isCore);
  const coreValid = coreVariables.filter((v) => v.status === "valid");
  const maxBreakRisk = position.thesis.variables.reduce<"low" | "medium" | "high">(
    (max, v) => (RISK_RANK[v.aiBreakRisk] > RISK_RANK[max] ? v.aiBreakRisk : max),
    "low",
  );

  const totalSteps = position.path.steps.length;
  const completedSteps = position.path.steps.filter(
    (s) => s.status === "completed",
  ).length;
  const activeStep = position.path.steps.find((s) => s.status === "active");
  const percent =
    totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);

  const pending = position.path.triggers;
  const nearest = pending[0] ?? null;

  const riskBudgetPct = position.riskBudget
    ? Number(position.riskBudget.toString()) * 100
    : null;

  return {
    positionId: position.id,
    symbol: position.symbol,
    side: position.side,

    thesisHealth: {
      status: position.thesis.status,
      coreVariableTotal: coreVariables.length,
      coreVariableValid: coreValid.length,
      maxBreakRisk,
      label:
        position.thesis.status === "broken"
          ? "Broken — exit only"
          : position.thesis.status === "broken_candidate"
            ? "At risk — review variables"
            : `${coreValid.length}/${coreVariables.length} core variables valid · max break risk: ${maxBreakRisk}`,
    },

    pathProgress: {
      totalSteps,
      completedSteps,
      activeStepDescription: activeStep?.description ?? null,
      percent,
      label: `${completedSteps}/${totalSteps} steps · ${percent}%`,
    },

    distanceToTrigger: {
      pendingCount: pending.length,
      nearestLabel: nearest
        ? `${nearest.type} · ${nearest.conditionExpr}`
        : null,
      label: nearest
        ? `Next: ${nearest.type} when ${nearest.conditionExpr}`
        : "No pending triggers",
    },

    riskExposure: {
      riskBudgetPct,
      label:
        riskBudgetPct === null
          ? "Risk budget not set"
          : `${riskBudgetPct.toFixed(2)}% of portfolio`,
    },
  };
}

export async function listPositionsWithMetrics(): Promise<PositionMetrics[]> {
  const positions = await prisma.position.findMany({
    where: { status: { in: ["open", "liquidating"] } },
    select: { id: true },
    orderBy: { openedAt: "desc" },
  });

  const metrics = await Promise.all(
    positions.map((p) => getPositionMetrics(p.id)),
  );

  return metrics.filter((m): m is PositionMetrics => m !== null);
}
