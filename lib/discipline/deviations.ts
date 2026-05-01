import { DEVIATION_WEIGHTS } from "./score";

export const MANUAL_DEVIATION_TYPES = ["emotional", "no_action"] as const;

type DeviationType = keyof typeof DEVIATION_WEIGHTS;
type ManualDeviationType = (typeof MANUAL_DEVIATION_TYPES)[number];

export function deviationWeight(type: string) {
  return DEVIATION_WEIGHTS[type as DeviationType] ?? 0;
}

export function isManualDeviationType(type: string): type is ManualDeviationType {
  return MANUAL_DEVIATION_TYPES.includes(type as ManualDeviationType);
}

export function unplannedTradeDescription(reason: string | null) {
  return `TradeGate blocked attempted trade: ${reason ?? "trade gated"}`;
}

export function earlyExitDescription(pathId: string) {
  return `Exit executed before any exit trigger fired on Path ${pathId}.`;
}
