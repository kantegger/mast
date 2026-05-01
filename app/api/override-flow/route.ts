import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  disciplineScore,
  disciplineWindowStart,
  overrideCooldownMultiplier,
} from "@/lib/discipline/score";

const COOLDOWN: Record<"low" | "medium" | "high", number> = {
  low: 0,
  medium: 300,
  high: 900,
};

// POST /api/override-flow — create an OverrideFlow in `pending` state.
// Confirmation and cooldown enforcement live at
// POST /api/override-flow/[id]/confirm. Execution is always mediated by
// TradeGate via POST /api/trade with overrideFlowId attached.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    pathStepId?: string;
    severity?: "low" | "medium" | "high";
    overrideType?: string;
    reason?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { pathStepId, severity, overrideType, reason } = body;

  if (!pathStepId || pathStepId.trim().length === 0) {
    return NextResponse.json(
      { error: "pathStepId is required. OverrideFlow must be bound to a PathStep." },
      { status: 400 },
    );
  }
  if (!severity || !(severity in COOLDOWN)) {
    return NextResponse.json(
      { error: "severity must be 'low', 'medium', or 'high'." },
      { status: 400 },
    );
  }
  if (!overrideType || overrideType.trim().length === 0) {
    return NextResponse.json(
      { error: "overrideType is required." },
      { status: 400 },
    );
  }
  if (!reason || reason.trim().length < 30) {
    return NextResponse.json(
      { error: "reason must be at least 30 characters." },
      { status: 400 },
    );
  }

  const now = new Date();
  const deviations = await prisma.deviation.findMany({
    where: { createdAt: { gte: disciplineWindowStart(now) } },
    select: { type: true },
  });
  const score = disciplineScore(deviations);
  const cooldownMultiplier = overrideCooldownMultiplier(score);
  const cooldownSeconds = COOLDOWN[severity] * cooldownMultiplier;

  const flow = await prisma.overrideFlow.create({
    data: {
      pathStepId: pathStepId.trim(),
      severity,
      cooldownSeconds,
      reason: reason.trim(),
      overrideType: overrideType.trim(),
      confirmationStage: 1,
      status: "pending",
    },
  });

  return NextResponse.json({
    id: flow.id,
    severity: flow.severity,
    cooldownSeconds: flow.cooldownSeconds,
    disciplineScore: score,
    cooldownMultiplier,
    nextStep:
      flow.cooldownSeconds === 0
        ? "confirm"
        : `confirm to start ${flow.cooldownSeconds}s cooldown`,
  });
}
