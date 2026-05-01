import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextConfirmationStage } from "@/lib/api-hardening";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const CONFIRMATION_STAGE = {
  requested: 1,
  cooldownStarted: 2,
  cooldownElapsed: 3,
  confirmed: 4,
} as const;

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const now = new Date();

  const flow = await prisma.overrideFlow.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      cooldownSeconds: true,
      cooldownStartsAt: true,
      confirmationStage: true,
    },
  });

  if (!flow) {
    return NextResponse.json({ error: "OverrideFlow not found." }, { status: 404 });
  }

  if (flow.status === "aborted" || flow.status === "executed") {
    return NextResponse.json(
      { error: `OverrideFlow is ${flow.status}; it cannot be confirmed.` },
      { status: 409 },
    );
  }

  if (flow.status === "confirmed") {
    await prisma.overrideFlow.updateMany({
      where: {
        id: flow.id,
        status: "confirmed",
        confirmationStage: { lt: CONFIRMATION_STAGE.confirmed },
      },
      data: { confirmationStage: CONFIRMATION_STAGE.confirmed },
    });

    return NextResponse.json({
      id: flow.id,
      status: flow.status,
      confirmationStage: Math.max(flow.confirmationStage, CONFIRMATION_STAGE.confirmed),
      nextStep: "execute trade with overrideFlowId",
    });
  }

  if (flow.status === "pending") {
    if (flow.cooldownSeconds === 0) {
      const confirmed = await prisma.overrideFlow.updateMany({
        where: { id: flow.id, status: "pending" },
        data: {
          status: "confirmed",
          confirmationStage: nextConfirmationStage(
            flow.confirmationStage,
            CONFIRMATION_STAGE.confirmed,
          ),
          confirmedAt: now,
        },
      });

      if (confirmed.count !== 1) {
        return confirmConflictResponse(flow.id);
      }

      return NextResponse.json({
        id: flow.id,
        status: "confirmed",
        confirmationStage: nextConfirmationStage(
          flow.confirmationStage,
          CONFIRMATION_STAGE.confirmed,
        ),
        nextStep: "execute trade with overrideFlowId",
      });
    }

    const cooling = await prisma.overrideFlow.updateMany({
      where: { id: flow.id, status: "pending" },
      data: {
        status: "cooldown",
        confirmationStage: nextConfirmationStage(
          flow.confirmationStage,
          CONFIRMATION_STAGE.cooldownStarted,
        ),
        cooldownStartsAt: now,
      },
    });

    if (cooling.count !== 1) {
      return confirmConflictResponse(flow.id);
    }

    return NextResponse.json({
      id: flow.id,
      status: "cooldown",
      confirmationStage: nextConfirmationStage(
        flow.confirmationStage,
        CONFIRMATION_STAGE.cooldownStarted,
      ),
      remainingSeconds: flow.cooldownSeconds,
      nextStep: "wait for cooldown, then confirm again",
    });
  }

  const remainingSeconds = remainingCooldownSeconds(flow, now);
  if (remainingSeconds > 0) {
    return NextResponse.json(
      {
        id: flow.id,
        status: flow.status,
        confirmationStage: Math.max(
          flow.confirmationStage,
          CONFIRMATION_STAGE.cooldownStarted,
        ),
        remainingSeconds,
        nextStep: "wait for cooldown, then confirm again",
      },
      { status: 423 },
    );
  }

  const confirmed = await prisma.overrideFlow.updateMany({
    where: { id: flow.id, status: "cooldown" },
    data: {
      status: "confirmed",
      confirmationStage: nextConfirmationStage(
        flow.confirmationStage,
        CONFIRMATION_STAGE.confirmed,
      ),
      confirmedAt: now,
    },
  });

  if (confirmed.count !== 1) {
    return confirmConflictResponse(flow.id);
  }

  return NextResponse.json({
    id: flow.id,
    status: "confirmed",
    confirmationStage: nextConfirmationStage(
      flow.confirmationStage,
      CONFIRMATION_STAGE.confirmed,
    ),
    nextStep: "execute trade with overrideFlowId",
  });
}

async function confirmConflictResponse(id: string) {
  const latest = await prisma.overrideFlow.findUnique({
    where: { id },
    select: { id: true, status: true, confirmationStage: true },
  });

  if (!latest) {
    return NextResponse.json({ error: "OverrideFlow not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      id: latest.id,
      status: latest.status,
      confirmationStage: latest.confirmationStage,
      error: `OverrideFlow is ${latest.status}; confirm did not change it.`,
    },
    { status: 409 },
  );
}

function remainingCooldownSeconds(
  flow: { cooldownSeconds: number; cooldownStartsAt: Date | null },
  now: Date,
) {
  if (!flow.cooldownStartsAt) return flow.cooldownSeconds;
  const elapsedSeconds = Math.floor(
    (now.getTime() - flow.cooldownStartsAt.getTime()) / 1000,
  );
  return Math.max(flow.cooldownSeconds - elapsedSeconds, 0);
}
