import { describe, expect, it } from "vitest";
import { nextThesisStatus, type VariableSnapshot } from "./transitions";

const okCore: VariableSnapshot = {
  isCore: true,
  status: "valid",
  assumedDir: "up",
  observedDir: "up",
  aiBreakRisk: "low",
};

const okNonCore: VariableSnapshot = {
  isCore: false,
  status: "valid",
  assumedDir: "up",
  observedDir: "up",
  aiBreakRisk: "low",
};

describe("nextThesisStatus", () => {
  it("stays active when every variable is valid, on-direction, and low risk", () => {
    expect(nextThesisStatus("active", [okCore, okNonCore])).toBe("active");
  });

  it("breaks when a core variable is invalid", () => {
    expect(
      nextThesisStatus("active", [{ ...okCore, status: "invalid" }]),
    ).toBe("broken");
  });

  it("does NOT break when a non-core variable is invalid (status alone is not enough)", () => {
    expect(
      nextThesisStatus("active", [{ ...okNonCore, status: "invalid" }]),
    ).toBe("active");
  });

  it("breaks when ANY variable has aiBreakRisk='high', core or not", () => {
    expect(
      nextThesisStatus("active", [{ ...okNonCore, aiBreakRisk: "high" }]),
    ).toBe("broken");
    expect(
      nextThesisStatus("active", [{ ...okCore, aiBreakRisk: "high" }]),
    ).toBe("broken");
  });

  it("flags broken_candidate on literal up→down reversal", () => {
    expect(
      nextThesisStatus("active", [
        { ...okCore, assumedDir: "up", observedDir: "down" },
      ]),
    ).toBe("broken_candidate");
  });

  it("flags broken_candidate on literal down→up reversal", () => {
    expect(
      nextThesisStatus("active", [
        { ...okCore, assumedDir: "down", observedDir: "up" },
      ]),
    ).toBe("broken_candidate");
  });

  it("does NOT flag candidate on up→flat (stall, not reversal)", () => {
    expect(
      nextThesisStatus("active", [
        { ...okCore, assumedDir: "up", observedDir: "flat" },
      ]),
    ).toBe("active");
  });

  it("does NOT flag candidate on flat→up or flat→down (drift, not reversal)", () => {
    expect(
      nextThesisStatus("active", [
        { ...okCore, assumedDir: "flat", observedDir: "up" },
      ]),
    ).toBe("active");
    expect(
      nextThesisStatus("active", [
        { ...okCore, assumedDir: "flat", observedDir: "down" },
      ]),
    ).toBe("active");
  });

  it("treats observedDir = null as no signal", () => {
    expect(
      nextThesisStatus("active", [{ ...okCore, observedDir: null }]),
    ).toBe("active");
  });

  it("keeps broken terminal even when every variable looks healthy", () => {
    expect(nextThesisStatus("broken", [okCore])).toBe("broken");
  });

  it("escalates broken_candidate to broken when a core variable becomes invalid", () => {
    expect(
      nextThesisStatus("broken_candidate", [
        { ...okCore, status: "invalid" },
      ]),
    ).toBe("broken");
  });

  it("returns broken_candidate to active when every reversal has resolved", () => {
    expect(nextThesisStatus("broken_candidate", [okCore, okNonCore])).toBe(
      "active",
    );
  });

  it("prefers broken over broken_candidate when both signals fire", () => {
    expect(
      nextThesisStatus("active", [
        { ...okCore, status: "invalid" },
        { ...okNonCore, assumedDir: "up", observedDir: "down" },
      ]),
    ).toBe("broken");
  });

  // Boundary: a thesis with no variables has no signals to act on. Mirrors the
  // path-step transition's "no triggers → keep current" choice so that absence
  // of evidence does not silently transition status.
  it("keeps the current status when the thesis has no variables", () => {
    expect(nextThesisStatus("active", [])).toBe("active");
    expect(nextThesisStatus("broken_candidate", [])).toBe("broken_candidate");
  });
});
