import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { evaluateTrade, type GateDecision, type TradeIntent } from "@/lib/trade-gate";
import { Prisma } from "@/lib/generated/prisma/client";
import { isOverrideFlowReuseError } from "@/lib/api-hardening";
import {
  deviationWeight,
  earlyExitDescription,
  unplannedTradeDescription,
} from "@/lib/discipline/deviations";
import {
  nextPathStepStatus,
  type PathStepStatus,
  type TriggerStatus,
} from "@/lib/path-step/transitions";

const INTENTS = new Set(["buy", "sell", "add", "reduce", "exit"]);
const SIDES = new Set(["long", "short"]);

type TradeBody = {
  thesisId?: string;
  pathId?: string;
  pathStepId?: string;
  triggerId?: string;
  positionId?: string;
  symbol?: string;
  side?: "long" | "short";
  intent?: TradeIntent["intent"];
  size?: string | number;
  price?: string | number;
  overrideFlowId?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as TradeBody | null;
  const validation = validateBody(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const intent = validation.intent;
  const now = new Date();
  const decision = await evaluateTrade(intent, { prisma, now });

  if (!intent.positionId && decision.kind !== "allowed") {
    await prisma.deviation.create({
      data: {
        tradeId: null,
        positionId: null,
        type: "unplanned_trade",
        weight: deviationWeight("unplanned_trade"),
        description: unplannedTradeDescription(decisionReason(decision)),
      },
    });

    return NextResponse.json(
      {
        decision,
        error:
          "TradeGate blocked this opening trade before a Position existed, so no Trade row was created.",
      },
      { status: decisionStatus(decision) },
    );
  }

  const result = await prisma
    .$transaction(async (tx) => {
      const positionId =
        intent.positionId ??
        (
          await tx.position.create({
            data: {
              thesisId: intent.thesisId,
              pathId: intent.pathId,
              symbol: intent.symbol,
              side: intent.side,
              size: "0",
              costBasis: intent.price ?? "0",
              status: "open",
            },
            select: { id: true },
          })
        ).id;

      const trade = await tx.trade.create({
        data: {
          positionId,
          pathStepId: intent.pathStepId ?? null,
          triggerId: intent.triggerId ?? null,
          intent: intent.intent,
          size: intent.size,
          price: intent.price ?? null,
          status: tradeStatusFor(decision),
          gateDecisionKind: decision.kind,
          gateDecisionReason: decisionReason(decision),
          overrideFlowId: decision.kind === "allowed" ? intent.overrideFlowId ?? null : null,
          executedAt: decision.kind === "allowed" ? now : null,
        },
      });

      if (decision.kind === "allowed") {
        await applyExecutedTrade(tx, {
          tradeId: trade.id,
          positionId,
          pathStepId: intent.pathStepId,
          triggerId: intent.triggerId,
          pathId: intent.pathId,
          intent: intent.intent,
          size: intent.size,
          now,
        });

        if (intent.overrideFlowId) {
          await tx.overrideFlow.update({
            where: { id: intent.overrideFlowId },
            data: { status: "executed", executedAt: now },
          });
        }
      } else if (trade.status === "gated") {
        await tx.deviation.create({
          data: {
            tradeId: trade.id,
            positionId,
            type: "unplanned_trade",
            weight: deviationWeight("unplanned_trade"),
            description: unplannedTradeDescription(decisionReason(decision)),
          },
        });
      }

      return trade;
    })
    .catch((error: unknown) => {
      if (isOverrideFlowReuseError(error)) {
        return null;
      }
      throw error;
    });

  if (!result) {
    return NextResponse.json(
      {
        error:
          "OverrideFlow has already been used by another trade. Refresh and review the latest trade state.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      tradeId: result.id,
      status: result.status,
      gateDecisionKind: result.gateDecisionKind,
      gateDecisionReason: result.gateDecisionReason,
      decision,
    },
    { status: decision.kind === "allowed" ? 201 : decisionStatus(decision) },
  );
}

function validateBody(body: TradeBody | null):
  | { ok: true; intent: TradeIntent }
  | { ok: false; error: string } {
  if (!body) return { ok: false, error: "Invalid JSON body." };

  const required = ["thesisId", "pathId", "symbol", "side", "intent", "size"] as const;
  for (const field of required) {
    if (!body[field]) return { ok: false, error: `${field} is required.` };
  }

  if (!SIDES.has(body.side!)) {
    return { ok: false, error: "side must be 'long' or 'short'." };
  }

  if (!INTENTS.has(body.intent!)) {
    return {
      ok: false,
      error: "intent must be buy, sell, add, reduce, or exit.",
    };
  }

  const size = normalizePositiveDecimal(body.size, "size");
  if (!size.ok) return size;

  const price = body.price === undefined ? undefined : normalizePositiveDecimal(body.price, "price");
  if (price && !price.ok) return price;

  if (!body.positionId && body.intent !== "buy") {
    return {
      ok: false,
      error: "positionId is required unless intent is 'buy'.",
    };
  }

  if (!body.positionId && body.intent === "buy" && !price?.value) {
    return {
      ok: false,
      error: "price is required when opening a new position.",
    };
  }

  return {
    ok: true,
    intent: {
      thesisId: body.thesisId!,
      pathId: body.pathId!,
      pathStepId: body.pathStepId,
      triggerId: body.triggerId,
      positionId: body.positionId,
      symbol: body.symbol!.trim().toUpperCase(),
      side: body.side!,
      intent: body.intent!,
      size: size.value,
      price: price?.value,
      overrideFlowId: body.overrideFlowId,
    },
  };
}

function normalizePositiveDecimal(
  value: string | number | undefined,
  field: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { ok: false, error: `${field} must be a positive decimal.` };
  }

  if (new Prisma.Decimal(text).lte(0)) {
    return { ok: false, error: `${field} must be greater than 0.` };
  }

  return { ok: true, value: text };
}

function tradeStatusFor(decision: GateDecision) {
  if (decision.kind === "allowed") return "executed";
  if (decision.kind === "cooldown") return "cooldown";
  return "gated";
}

function decisionReason(decision: GateDecision) {
  if (decision.kind === "allowed") return null;
  if (decision.kind === "cooldown") {
    return `OverrideFlow ${decision.overrideFlowId} has ${decision.remainingSeconds}s remaining.`;
  }
  return decision.reason;
}

function decisionStatus(decision: GateDecision) {
  if (decision.kind === "cooldown") return 423;
  if (decision.kind === "requires_override") return 409;
  return 403;
}

async function applyExecutedTrade(
  tx: Prisma.TransactionClient,
  args: {
    tradeId: string;
    positionId: string;
    pathId: string;
    pathStepId?: string;
    triggerId?: string;
    intent: TradeIntent["intent"];
    size: string;
    now: Date;
  },
) {
  const isEarlyExit = await shouldRecordEarlyExit(tx, {
    pathId: args.pathId,
    triggerId: args.triggerId,
    intent: args.intent,
  });

  if (args.triggerId) {
    await tx.trigger.update({
      where: { id: args.triggerId },
      data: { status: "fired", firedAt: args.now },
    });
  }

  if (isEarlyExit) {
    await tx.deviation.create({
      data: {
        tradeId: args.tradeId,
        positionId: args.positionId,
        type: "early_exit",
        weight: deviationWeight("early_exit"),
        description: earlyExitDescription(args.pathId),
      },
    });
  }

  if (args.pathStepId) {
    const [step, triggers] = await Promise.all([
      tx.pathStep.findUniqueOrThrow({
        where: { id: args.pathStepId },
        select: { status: true },
      }),
      tx.trigger.findMany({
        where: { pathStepId: args.pathStepId },
        select: { status: true },
      }),
    ]);

    const next = nextPathStepStatus(
      step.status as PathStepStatus,
      triggers.map((t) => t.status as TriggerStatus),
    );

    if (next !== step.status) {
      await tx.pathStep.update({
        where: { id: args.pathStepId },
        data: { status: next },
      });
    }
  }

  const position = await tx.position.findUniqueOrThrow({
    where: { id: args.positionId },
    select: { size: true },
  });

  const currentSize = new Prisma.Decimal(position.size);
  const tradeSize = new Prisma.Decimal(args.size);
  const nextSize =
    args.intent === "buy" || args.intent === "add"
      ? currentSize.plus(tradeSize)
      : args.intent === "exit"
        ? new Prisma.Decimal(0)
        : Prisma.Decimal.max(currentSize.minus(tradeSize), new Prisma.Decimal(0));

  await tx.position.update({
    where: { id: args.positionId },
    data: {
      size: nextSize.toString(),
      status: nextSize.eq(0) ? "closed" : "open",
      closedAt: nextSize.eq(0) ? args.now : null,
    },
  });
}

async function shouldRecordEarlyExit(
  tx: Prisma.TransactionClient,
  args: {
    pathId: string;
    triggerId?: string;
    intent: TradeIntent["intent"];
  },
) {
  if (args.intent !== "exit") return false;

  if (args.triggerId) {
    const trigger = await tx.trigger.findUnique({
      where: { id: args.triggerId },
      select: { type: true },
    });
    if (trigger?.type === "exit") return false;
  }

  const firedExitTriggers = await tx.trigger.count({
    where: {
      pathId: args.pathId,
      type: "exit",
      status: "fired",
    },
  });

  return firedExitTriggers === 0;
}
