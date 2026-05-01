import type { Rule } from "../types";

// ThesisStatusRule: when a Thesis is `broken`, only de-risking is allowed.
// `broken_candidate` is a soft warning surfaced in UI; it does not block here.
export const thesisStatusRule: Rule = {
  id: "thesis-status-rule",

  async evaluate(intent, { prisma }) {
    const thesis = await prisma.thesis.findUnique({
      where: { id: intent.thesisId },
      select: { id: true, status: true },
    });

    if (!thesis) {
      return {
        kind: "blocked",
        ruleId: "thesis-status-rule",
        reason: `Thesis ${intent.thesisId} does not exist.`,
      };
    }

    if (thesis.status === "broken") {
      const isDeRisking =
        intent.intent === "reduce" ||
        intent.intent === "exit" ||
        intent.intent === "sell";

      if (!isDeRisking) {
        return {
          kind: "blocked",
          ruleId: "thesis-status-rule",
          reason: `Thesis is broken; only reduce/exit/sell are permitted. Use the auto-inserted Exit Trigger.`,
          details: { thesisStatus: thesis.status },
        };
      }
    }

    return null;
  },
};
