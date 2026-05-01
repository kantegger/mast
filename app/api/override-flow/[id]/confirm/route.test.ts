import { describe, expect, it } from "vitest";
import { nextConfirmationStage } from "../../../../../lib/api-hardening";

describe("override-flow confirm hardening", () => {
  it("moves final confirmation to the spec's fourth stage", () => {
    expect(nextConfirmationStage(3, 4)).toBe(4);
  });

  it("keeps confirmation stages monotonic", () => {
    expect(nextConfirmationStage(4, 2)).toBe(4);
  });
});
