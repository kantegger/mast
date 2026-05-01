import { describe, expect, it, vi } from "vitest";
import { evaluateTrade } from "./pipeline";
import type { GateContext, Rule, TradeIntent } from "./types";
import { pathRule } from "./rules/path-rule";
import { thesisStatusRule } from "./rules/thesis-status-rule";
import { triggerRule } from "./rules/trigger-rule";
import { overrideFlowRule } from "./rules/override-flow-rule";
import { disciplineRule } from "./rules/discipline-rule";

const baseIntent: TradeIntent = {
  thesisId: "thesis-1",
  pathId: "path-1",
  pathStepId: "step-1",
  triggerId: "trigger-1",
  positionId: "position-1",
  symbol: "TLT",
  side: "long",
  intent: "add",
  size: "25",
  price: "93.10",
};

function ctx(prisma: unknown): GateContext {
  return { prisma: prisma as GateContext["prisma"], now: new Date("2026-04-30T00:00:00Z") };
}

describe("evaluateTrade", () => {
  it("returns the first rule decision and does not evaluate later rules", async () => {
    const first: Rule = {
      id: "first",
      evaluate: vi.fn(async () => ({
        kind: "blocked",
        ruleId: "first",
        reason: "first block",
      }) as const),
    };
    const second: Rule = {
      id: "second",
      evaluate: vi.fn(async () => ({
        kind: "blocked",
        ruleId: "second",
        reason: "second block",
      }) as const),
    };

    const decision = await evaluateTrade(baseIntent, ctx({}), [first, second]);

    expect(decision).toEqual({
      kind: "blocked",
      ruleId: "first",
      reason: "first block",
    });
    expect(second.evaluate).not.toHaveBeenCalled();
  });

  it("allows the trade when no rule objects", async () => {
    await expect(evaluateTrade(baseIntent, ctx({}), [])).resolves.toEqual({
      kind: "allowed",
    });
  });

  it("does not allow OverrideFlow to bypass low-discipline new-position blocking", async () => {
    const decision = await evaluateTrade(
      {
        ...baseIntent,
        intent: "buy",
        positionId: undefined,
        overrideFlowId: "flow-1",
      },
      ctx({
        deviation: {
          findMany: vi.fn(async () =>
            Array.from({ length: 14 }, () => ({ type: "emotional" })),
          ),
        },
      }),
    );

    expect(decision).toMatchObject({
      kind: "blocked",
      ruleId: "discipline-rule",
    });
  });
});

describe("pathRule", () => {
  it("blocks missing paths", async () => {
    const decision = await pathRule.evaluate(
      baseIntent,
      ctx({ path: { findUnique: vi.fn(async () => null) } }),
    );

    expect(decision).toMatchObject({ kind: "blocked", ruleId: "path-rule" });
  });

  it("passes active paths and pending steps", async () => {
    const decision = await pathRule.evaluate(
      baseIntent,
      ctx({
        path: {
          findUnique: vi.fn(async () => ({
            id: "path-1",
            thesisId: "thesis-1",
            status: "active",
          })),
        },
        pathStep: {
          findUnique: vi.fn(async () => ({
            id: "step-1",
            pathId: "path-1",
            status: "pending",
          })),
        },
      }),
    );

    expect(decision).toBeNull();
  });
});

describe("triggerRule", () => {
  it("blocks trades without a trigger", async () => {
    const decision = await triggerRule.evaluate(
      { ...baseIntent, triggerId: undefined },
      ctx({}),
    );

    expect(decision).toEqual({
      kind: "blocked",
      ruleId: "trigger-rule",
      reason: "No trigger supplied. Every add requires an explicit trigger.",
    });
  });

  it("passes pending triggers whose type authorises the intent", async () => {
    const decision = await triggerRule.evaluate(
      baseIntent,
      ctx({
        trigger: {
          findUnique: vi.fn(async () => ({
            id: "trigger-1",
            pathId: "path-1",
            type: "add",
            status: "pending",
          })),
        },
      }),
    );

    expect(decision).toBeNull();
  });

  it("blocks trigger types that do not authorise the intent", async () => {
    const decision = await triggerRule.evaluate(
      baseIntent,
      ctx({
        trigger: {
          findUnique: vi.fn(async () => ({
            id: "trigger-1",
            pathId: "path-1",
            type: "reduce",
            status: "pending",
          })),
        },
      }),
    );

    expect(decision).toMatchObject({
      kind: "blocked",
      ruleId: "trigger-rule",
    });
  });
});

describe("thesisStatusRule", () => {
  it("blocks buy/add when thesis is broken", async () => {
    const decision = await thesisStatusRule.evaluate(
      baseIntent,
      ctx({
        thesis: {
          findUnique: vi.fn(async () => ({ id: "thesis-1", status: "broken" })),
        },
      }),
    );

    expect(decision).toMatchObject({
      kind: "blocked",
      ruleId: "thesis-status-rule",
    });
  });

  it("allows de-risking when thesis is broken", async () => {
    const decision = await thesisStatusRule.evaluate(
      { ...baseIntent, intent: "exit" },
      ctx({
        thesis: {
          findUnique: vi.fn(async () => ({ id: "thesis-1", status: "broken" })),
        },
      }),
    );

    expect(decision).toBeNull();
  });
});

describe("overrideFlowRule", () => {
  it("passes through when no overrideFlowId is supplied", async () => {
    const decision = await overrideFlowRule.evaluate(baseIntent, ctx({}));

    expect(decision).toBeNull();
  });

  it("allows a confirmed flow bound to the same path and step", async () => {
    const decision = await overrideFlowRule.evaluate(
      { ...baseIntent, overrideFlowId: "flow-1" },
      ctx({
        overrideFlow: {
          findUnique: vi.fn(async () => ({
            id: "flow-1",
            pathStepId: "step-1",
            severity: "medium",
            cooldownSeconds: 300,
            cooldownStartsAt: null,
            status: "confirmed",
            pathStep: { pathId: "path-1" },
          })),
        },
      }),
    );

    expect(decision).toEqual({ kind: "allowed" });
  });

  it("blocks a confirmed flow bound to a different step", async () => {
    const decision = await overrideFlowRule.evaluate(
      { ...baseIntent, overrideFlowId: "flow-1" },
      ctx({
        overrideFlow: {
          findUnique: vi.fn(async () => ({
            id: "flow-1",
            pathStepId: "other-step",
            severity: "medium",
            cooldownSeconds: 300,
            cooldownStartsAt: null,
            status: "confirmed",
            pathStep: { pathId: "path-1" },
          })),
        },
      }),
    );

    expect(decision).toMatchObject({
      kind: "blocked",
      ruleId: "override-flow-rule",
    });
  });

  it("blocks legacy unbound flows from authorizing step-bound trades", async () => {
    const decision = await overrideFlowRule.evaluate(
      { ...baseIntent, overrideFlowId: "flow-1" },
      ctx({
        overrideFlow: {
          findUnique: vi.fn(async () => ({
            id: "flow-1",
            pathStepId: null,
            severity: "low",
            cooldownSeconds: 0,
            cooldownStartsAt: null,
            status: "confirmed",
            pathStep: null,
          })),
        },
      }),
    );

    expect(decision).toEqual({
      kind: "blocked",
      ruleId: "override-flow-rule",
      reason: "OverrideFlow must be bound to the same PathStep as the trade.",
    });
  });

  it("blocks step-bound flows when the trade omits pathStepId", async () => {
    const decision = await overrideFlowRule.evaluate(
      { ...baseIntent, pathStepId: undefined, overrideFlowId: "flow-1" },
      ctx({
        overrideFlow: {
          findUnique: vi.fn(async () => ({
            id: "flow-1",
            pathStepId: "step-1",
            severity: "low",
            cooldownSeconds: 0,
            cooldownStartsAt: null,
            status: "confirmed",
            pathStep: { pathId: "path-1" },
          })),
        },
      }),
    );

    expect(decision).toEqual({
      kind: "blocked",
      ruleId: "override-flow-rule",
      reason: "Trade must supply the PathStep bound to this OverrideFlow.",
    });
  });

  it("returns cooldown while the flow is still cooling down", async () => {
    const decision = await overrideFlowRule.evaluate(
      { ...baseIntent, overrideFlowId: "flow-1" },
      ctx({
        overrideFlow: {
          findUnique: vi.fn(async () => ({
            id: "flow-1",
            pathStepId: "step-1",
            severity: "medium",
            cooldownSeconds: 300,
            cooldownStartsAt: new Date("2026-04-29T23:58:00Z"),
            status: "cooldown",
            pathStep: { pathId: "path-1" },
          })),
        },
      }),
    );

    expect(decision).toEqual({
      kind: "cooldown",
      overrideFlowId: "flow-1",
      remainingSeconds: 180,
    });
  });

  it("requires a second confirmation after cooldown elapses", async () => {
    const decision = await overrideFlowRule.evaluate(
      { ...baseIntent, overrideFlowId: "flow-1" },
      ctx({
        overrideFlow: {
          findUnique: vi.fn(async () => ({
            id: "flow-1",
            pathStepId: "step-1",
            severity: "medium",
            cooldownSeconds: 300,
            cooldownStartsAt: new Date("2026-04-29T23:54:00Z"),
            status: "cooldown",
            pathStep: { pathId: "path-1" },
          })),
        },
      }),
    );

    expect(decision).toMatchObject({
      kind: "requires_override",
      ruleId: "override-flow-rule",
    });
  });
});

describe("disciplineRule", () => {
  it("blocks new position creation when discipline score is below 60", async () => {
    const decision = await disciplineRule.evaluate(
      { ...baseIntent, intent: "buy", positionId: undefined },
      ctx({
        deviation: {
          findMany: vi.fn(async () =>
            Array.from({ length: 14 }, () => ({ type: "emotional" })),
          ),
        },
      }),
    );

    expect(decision).toMatchObject({
      kind: "blocked",
      ruleId: "discipline-rule",
      details: { score: 44 },
    });
  });

  it("passes non-opening trades even when discipline score is below 60", async () => {
    const decision = await disciplineRule.evaluate(
      baseIntent,
      ctx({
        deviation: {
          findMany: vi.fn(async () =>
            Array.from({ length: 14 }, () => ({ type: "emotional" })),
          ),
        },
      }),
    );

    expect(decision).toBeNull();
  });

  it("uses the recent 30-day deviation window", async () => {
    const findMany = vi.fn(async () => []);

    await disciplineRule.evaluate(
      { ...baseIntent, intent: "buy", positionId: undefined },
      ctx({ deviation: { findMany } }),
    );

    expect(findMany).toHaveBeenCalledWith({
      where: { createdAt: { gte: new Date("2026-03-31T00:00:00.000Z") } },
      select: { type: true },
    });
  });
});
