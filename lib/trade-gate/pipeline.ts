import type { GateContext, GateDecision, Rule, TradeIntent } from "./types";
import { pathRule } from "./rules/path-rule";
import { triggerRule } from "./rules/trigger-rule";
import { thesisStatusRule } from "./rules/thesis-status-rule";
import { disciplineRule } from "./rules/discipline-rule";
import { overrideFlowRule } from "./rules/override-flow-rule";

// Rule order matters. DisciplineRule runs first because low-score new-position
// blocking is not overrideable. OverrideFlow is the legal escape hatch for the
// remaining upstream blocks.
const DEFAULT_RULES: readonly Rule[] = [
  disciplineRule,
  overrideFlowRule,
  pathRule,
  triggerRule,
  thesisStatusRule,
];

export async function evaluateTrade(
  intent: TradeIntent,
  ctx: GateContext,
  rules: readonly Rule[] = DEFAULT_RULES,
): Promise<GateDecision> {
  for (const rule of rules) {
    const decision = await rule.evaluate(intent, ctx);
    if (decision) return decision;
  }
  return { kind: "allowed" };
}
