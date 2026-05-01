import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  computePnl,
  formatDecimal,
  isViewPnlExpired,
  remainingUnlockSeconds,
} from "@/lib/view-pnl-flow";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const now = new Date();
  const flow = await prisma.viewPnLFlow.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      currentPrice: true,
      expiresAt: true,
      position: {
        select: {
          id: true,
          symbol: true,
          side: true,
          size: true,
          costBasis: true,
        },
      },
    },
  });

  if (!flow) {
    return NextResponse.json({ error: "ViewPnLFlow not found." }, { status: 404 });
  }

  if (isViewPnlExpired(flow, now)) {
    await prisma.viewPnLFlow.update({
      where: { id: flow.id },
      data: { status: "expired" },
    });
    return NextResponse.json(
      { error: "ViewPnLFlow has expired. Start a new unlock request." },
      { status: 423 },
    );
  }

  if (flow.status !== "unlocked" || !flow.currentPrice) {
    return NextResponse.json(
      { error: "ViewPnLFlow is not unlocked." },
      { status: 403 },
    );
  }

  const pnl = computePnl({
    side: flow.position.side,
    size: flow.position.size,
    costBasis: flow.position.costBasis,
    currentPrice: flow.currentPrice,
  });

  return NextResponse.json({
    id: flow.id,
    positionId: flow.position.id,
    symbol: flow.position.symbol,
    pnl: formatDecimal(pnl),
    currentPrice: flow.currentPrice.toString(),
    remainingSeconds: remainingUnlockSeconds(flow.expiresAt, now),
  });
}
