import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isViewPnlExpired,
  normalizePositiveDecimal,
  remainingUnlockSeconds,
  viewPnlExpiresAt,
} from "@/lib/view-pnl-flow";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as {
    currentPrice?: string | number;
  } | null;
  const currentPrice = normalizePositiveDecimal(body?.currentPrice, "currentPrice");

  if (!currentPrice.ok) {
    return NextResponse.json({ error: currentPrice.error }, { status: 400 });
  }

  const now = new Date();
  const flow = await prisma.viewPnLFlow.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      currentPrice: true,
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
      { status: 409 },
    );
  }

  if (flow.status === "unlocked") {
    return NextResponse.json({
      id: flow.id,
      status: flow.status,
      currentPrice: flow.currentPrice?.toString() ?? null,
      remainingSeconds: remainingUnlockSeconds(flow.expiresAt, now),
      nextStep: "GET /api/view-pnl-flow/{id}/pnl",
    });
  }

  if (flow.status === "expired") {
    return NextResponse.json(
      { error: "ViewPnLFlow is expired. Start a new unlock request." },
      { status: 409 },
    );
  }

  const expiresAt = viewPnlExpiresAt(now);
  const updated = await prisma.viewPnLFlow.updateMany({
    where: { id: flow.id, status: "pending" },
    data: {
      status: "unlocked",
      currentPrice: currentPrice.value,
      unlockedAt: now,
      expiresAt,
    },
  });

  if (updated.count !== 1) {
    return NextResponse.json(
      { error: "ViewPnLFlow could not be confirmed. Refresh and retry." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    id: flow.id,
    status: "unlocked",
    currentPrice: currentPrice.value,
    remainingSeconds: remainingUnlockSeconds(expiresAt, now),
    nextStep: "GET /api/view-pnl-flow/{id}/pnl",
  });
}
