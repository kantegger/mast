import type { PrismaClient } from "../generated/prisma/client";

// What the caller wants to do. Numeric fields are strings to preserve
// Decimal precision across the JSON / form boundary.
export type TradeIntent = {
  thesisId: string;
  pathId: string;
  pathStepId?: string;
  triggerId?: string;
  positionId?: string; // omitted when opening a new position
  symbol: string;
  side: "long" | "short";
  intent: "buy" | "sell" | "add" | "reduce" | "exit";
  size: string;
  price?: string;
  overrideFlowId?: string;
};

export type GateDecision =
  | { kind: "allowed" }
  | {
      kind: "blocked";
      ruleId: string;
      reason: string;
      details?: Record<string, unknown>;
    }
  | {
      kind: "requires_override";
      ruleId: string;
      severity: "low" | "medium" | "high";
      reason: string;
    }
  | {
      kind: "cooldown";
      overrideFlowId: string;
      remainingSeconds: number;
    };

export type GateContext = {
  prisma: PrismaClient;
  now: Date;
};

// A rule returns a GateDecision when it has an opinion, or null to pass through
// to the next rule. The pipeline's first non-null wins. Most rules block or ask
// for friction; OverrideFlowRule may return "allowed" to short-circuit once a
// confirmed override has been verified against the intent context.
export type Rule = {
  id: string;
  evaluate: (
    intent: TradeIntent,
    ctx: GateContext,
  ) => Promise<GateDecision | null>;
};
