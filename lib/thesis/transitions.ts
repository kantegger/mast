// Thesis state machine: derived from the variables it depends on.
// Pure helper, mirrors lib/path-step/transitions.ts. The route is responsible
// for converting Prisma enum values to/from these string literals.
//
// Rules (spec §4.1, §4.2):
//   - `broken` is terminal — never revives
//   - any var with `isCore && status === 'invalid'` → broken
//   - any var with `aiBreakRisk === 'high'`        → broken (core or not)
//   - any var with literal `up↔down` reversal       → broken_candidate
//   - otherwise (and a non-empty variable list)    → active
//   - empty variable list → keep current (no signals = no transition)

export type ThesisStatus = "active" | "broken_candidate" | "broken";
export type Direction = "up" | "down" | "flat";

export type VariableSnapshot = {
  isCore: boolean;
  status: "valid" | "invalid";
  assumedDir: Direction;
  observedDir: Direction | null;
  aiBreakRisk: "low" | "medium" | "high";
};

export function nextThesisStatus(
  current: ThesisStatus,
  vars: readonly VariableSnapshot[],
): ThesisStatus {
  if (current === "broken") return "broken";
  if (vars.length === 0) return current;

  const hardBreak = vars.some(
    (v) => (v.isCore && v.status === "invalid") || v.aiBreakRisk === "high",
  );
  if (hardBreak) return "broken";

  if (vars.some(isLiteralReversal)) return "broken_candidate";

  return "active";
}

function isLiteralReversal(v: VariableSnapshot): boolean {
  if (v.observedDir === null) return false;
  if (v.assumedDir === "up" && v.observedDir === "down") return true;
  if (v.assumedDir === "down" && v.observedDir === "up") return true;
  return false;
}
