import { describe, expect, it } from "vitest";
import {
  deviationWeight,
  earlyExitDescription,
  isManualDeviationType,
  unplannedTradeDescription,
} from "./deviations";

describe("deviation helpers", () => {
  it("maps known deviation types to their discipline weights", () => {
    expect(deviationWeight("early_exit")).toBe(2);
    expect(deviationWeight("emotional")).toBe(4);
  });

  it("returns zero for unknown deviation types", () => {
    expect(deviationWeight("future_type")).toBe(0);
  });

  it("allows only manual self-tag types through the manual endpoint", () => {
    expect(isManualDeviationType("emotional")).toBe(true);
    expect(isManualDeviationType("no_action")).toBe(true);
    expect(isManualDeviationType("early_exit")).toBe(false);
  });

  it("builds stable automatic deviation descriptions", () => {
    expect(unplannedTradeDescription("No trigger supplied.")).toContain(
      "No trigger supplied.",
    );
    expect(earlyExitDescription("path-1")).toContain("path-1");
  });
});
