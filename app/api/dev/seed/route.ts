import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Demo data for local development only. Idempotent: clears prior demo rows
// (only ones with name starting with 'DEMO:') before inserting.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seeding is disabled in production." },
      { status: 403 },
    );
  }

  const demoTheses = await prisma.thesis.findMany({
    where: { name: { startsWith: "DEMO:" } },
    select: {
      id: true,
      paths: { select: { id: true, steps: { select: { id: true } } } },
      positions: { select: { id: true } },
    },
  });
  const thesisIds = demoTheses.map((t) => t.id);
  const pathIds = demoTheses.flatMap((t) => t.paths.map((p) => p.id));
  const pathStepIds = demoTheses.flatMap((t) =>
    t.paths.flatMap((p) => p.steps.map((s) => s.id)),
  );
  const positionIds = demoTheses.flatMap((t) => t.positions.map((p) => p.id));

  await prisma.trade.deleteMany({
    where: {
      OR: [
        { positionId: { in: positionIds } },
        { pathStepId: { in: pathStepIds } },
      ],
    },
  });
  await prisma.deviation.deleteMany({
    where: { positionId: { in: positionIds } },
  });
  await prisma.overrideFlow.deleteMany({
    where: { pathStepId: { in: pathStepIds } },
  });
  await prisma.viewPnLFlow.deleteMany({
    where: { positionId: { in: positionIds } },
  });
  await prisma.trigger.deleteMany({ where: { pathId: { in: pathIds } } });
  await prisma.pathStep.deleteMany({ where: { pathId: { in: pathIds } } });
  await prisma.position.deleteMany({ where: { thesisId: { in: thesisIds } } });
  await prisma.path.deleteMany({ where: { thesisId: { in: thesisIds } } });
  await prisma.variable.deleteMany({ where: { thesisId: { in: thesisIds } } });
  await prisma.thesis.deleteMany({ where: { id: { in: thesisIds } } });

  const thesis = await prisma.thesis.create({
    data: {
      name: "DEMO: Rates pause supports duration",
      description:
        "Fed pauses Q3, 10Y rallies, growth/long-duration assets re-rate.",
      status: "active",
      variables: {
        create: [
          {
            name: "Fed funds path",
            assumedDir: "flat",
            observedDir: "flat",
            isCore: true,
            aiBreakRisk: "low",
            status: "valid",
          },
          {
            name: "Core CPI YoY",
            assumedDir: "down",
            observedDir: "down",
            isCore: true,
            aiBreakRisk: "medium",
            status: "valid",
          },
          {
            name: "Unemployment rate",
            assumedDir: "up",
            isCore: false,
            aiBreakRisk: "low",
            status: "valid",
          },
        ],
      },
      paths: {
        create: [
          {
            type: "mid_term",
            name: "Build long-duration over 6 weeks",
            description: "Scale into duration as data confirms thesis.",
            status: "active",
            steps: {
              create: [
                {
                  order: 1,
                  description: "Initial 25% sizing on first dovish CPI print",
                  criteria: "CPI < 0.3% MoM",
                  status: "completed",
                },
                {
                  order: 2,
                  description: "Add 25% if Fed pause is confirmed",
                  criteria: "FOMC statement removes 'further increases'",
                  status: "active",
                },
                {
                  order: 3,
                  description: "Add 25% on second confirming CPI",
                  criteria: "Two consecutive CPI < 0.3% MoM",
                  status: "pending",
                },
                {
                  order: 4,
                  description: "Trim to 50% on first sign of stickiness",
                  criteria: "CPI > 0.4% or FOMC hawkish surprise",
                  status: "pending",
                },
              ],
            },
          },
        ],
      },
    },
    include: { paths: { include: { steps: true } } },
  });

  const path = thesis.paths[0]!;
  const activeStep = path.steps.find((s) => s.status === "active")!;
  const nextStep = path.steps.find((s) => s.order === 3)!;
  const trimStep = path.steps.find((s) => s.order === 4)!;

  await prisma.trigger.createMany({
    data: [
      {
        pathId: path.id,
        pathStepId: activeStep.id,
        type: "add",
        priority: 100,
        conditionKind: "manual",
        conditionExpr: "FOMC pause confirmed in statement",
        status: "pending",
      },
      {
        pathId: path.id,
        pathStepId: nextStep.id,
        type: "add",
        priority: 80,
        conditionKind: "manual",
        conditionExpr: "Second CPI < 0.3% MoM",
        status: "pending",
      },
      {
        pathId: path.id,
        pathStepId: trimStep.id,
        type: "reduce",
        priority: 90,
        conditionKind: "manual",
        conditionExpr: "CPI > 0.4% or FOMC hawkish surprise",
        status: "pending",
      },
    ],
  });

  await prisma.position.create({
    data: {
      thesisId: thesis.id,
      pathId: path.id,
      symbol: "TLT",
      side: "long",
      size: "250",
      costBasis: "92.50",
      riskBudget: "0.025",
      status: "open",
    },
  });

  return NextResponse.json({ ok: true, thesisId: thesis.id });
}
