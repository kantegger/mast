import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/view-pnl-flow — create a ViewPnLFlow in `pending` state.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    positionId?: string;
    reason?: string;
  } | null;

  if (!body?.positionId || !body.reason) {
    return NextResponse.json(
      { error: "positionId and reason are required." },
      { status: 400 },
    );
  }
  if (body.reason.trim().length < 20) {
    return NextResponse.json(
      { error: "reason must be at least 20 characters." },
      { status: 400 },
    );
  }

  const position = await prisma.position.findUnique({
    where: { id: body.positionId },
    select: { id: true },
  });
  if (!position) {
    return NextResponse.json({ error: "Position not found." }, { status: 404 });
  }

  const flow = await prisma.viewPnLFlow.create({
    data: {
      positionId: position.id,
      reason: body.reason.trim(),
      status: "pending",
    },
  });

  return NextResponse.json({
    id: flow.id,
    nextStep: "confirm to unlock for 60s",
  });
}
