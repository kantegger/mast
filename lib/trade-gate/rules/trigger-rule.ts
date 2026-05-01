import type { Rule, TradeIntent } from "../types";

// What trigger types authorise what intents.
const ALLOWED: Record<TradeIntent["intent"], readonly string[]> = {
  buy: ["entry"],
  add: ["add", "entry"],
  sell: ["exit", "reduce"],
  reduce: ["reduce", "exit"],
  exit: ["exit"],
};

// TriggerRule: every trade must reference a pending Trigger whose type
// authorises this intent. No spontaneous trades.
export const triggerRule: Rule = {
  id: "trigger-rule",

  async evaluate(intent, { prisma }) {
    if (!intent.triggerId) {
      return {
        kind: "blocked",
        ruleId: "trigger-rule",
        reason: `No trigger supplied. Every ${intent.intent} requires an explicit trigger.`,
      };
    }

    const trigger = await prisma.trigger.findUnique({
      where: { id: intent.triggerId },
      select: { id: true, pathId: true, type: true, status: true },
    });

    if (!trigger) {
      return {
        kind: "blocked",
        ruleId: "trigger-rule",
        reason: `Trigger ${intent.triggerId} does not exist.`,
      };
    }

    if (trigger.pathId !== intent.pathId) {
      return {
        kind: "blocked",
        ruleId: "trigger-rule",
        reason: `Trigger does not belong to the supplied Path.`,
      };
    }

    if (trigger.status !== "pending") {
      return {
        kind: "blocked",
        ruleId: "trigger-rule",
        reason: `Trigger is ${trigger.status}; only 'pending' triggers can authorise a trade.`,
      };
    }

    const allowedForIntent = ALLOWED[intent.intent];
    if (!allowedForIntent.includes(trigger.type)) {
      return {
        kind: "blocked",
        ruleId: "trigger-rule",
        reason: `Trigger of type '${trigger.type}' does not authorise intent '${intent.intent}'.`,
      };
    }

    return null;
  },
};
