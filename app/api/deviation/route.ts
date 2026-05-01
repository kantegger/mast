import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  deviationWeight,
  isManualDeviationType,
} from "@/lib/discipline/deviations";

type DeviationBody = {
  type?: string;
  description?: string;
  tradeId?: string;
  positionId?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as DeviationBody | null;
  const validation = await validateBody(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const deviation = await prisma.deviation.create({
    data: {
      type: validation.type,
      weight: deviationWeight(validation.type),
      description: validation.description,
      tradeId: validation.tradeId ?? null,
      positionId: validation.positionId ?? null,
    },
  });

  return NextResponse.json(
    {
      id: deviation.id,
      type: deviation.type,
      weight: deviation.weight,
      tradeId: deviation.tradeId,
      positionId: deviation.positionId,
    },
    { status: 201 },
  );
}

async function validateBody(
  body: DeviationBody | null,
): Promise<
  | {
      ok: true;
      type: "emotional" | "no_action";
      description: string;
      tradeId?: string;
      positionId?: string;
    }
  | { ok: false; error: string; status: number }
> {
  if (!body) return { ok: false, error: "Invalid JSON body.", status: 400 };

  const type = body.type?.trim();
  if (!type || !isManualDeviationType(type)) {
    return {
      ok: false,
      error: "type must be 'emotional' or 'no_action'.",
      status: 400,
    };
  }

  const description = body.description?.trim();
  if (!description || description.length < 10) {
    return {
      ok: false,
      error: "description must be at least 10 characters.",
      status: 400,
    };
  }

  const tradeId = body.tradeId?.trim();
  if (tradeId) {
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      select: { id: true },
    });
    if (!trade) {
      return { ok: false, error: "tradeId does not exist.", status: 404 };
    }
  }

  const positionId = body.positionId?.trim();
  if (positionId) {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      select: { id: true },
    });
    if (!position) {
      return { ok: false, error: "positionId does not exist.", status: 404 };
    }
  }

  return {
    ok: true,
    type,
    description,
    tradeId,
    positionId,
  };
}
