import { describe, expect, it } from "vitest";
import { nextPathStepStatus } from "./transitions";

describe("nextPathStepStatus", () => {
  it("keeps a pending step pending while every trigger is still pending", () => {
    expect(nextPathStepStatus("pending", ["pending", "pending"])).toBe("pending");
  });

  it("promotes pending to active once any trigger has fired", () => {
    expect(nextPathStepStatus("pending", ["fired", "pending"])).toBe("active");
  });

  it("completes the step once every trigger has fired", () => {
    expect(nextPathStepStatus("active", ["fired", "fired", "fired"])).toBe(
      "completed",
    );
  });

  it("completes the step when triggers are a mix of fired, expired, and cancelled", () => {
    expect(
      nextPathStepStatus("active", ["fired", "expired", "cancelled"]),
    ).toBe("completed");
  });

  it("never revives a completed step", () => {
    expect(nextPathStepStatus("completed", ["pending", "pending"])).toBe(
      "completed",
    );
    expect(nextPathStepStatus("completed", ["fired"])).toBe("completed");
  });

  it("never revives a skipped step", () => {
    expect(nextPathStepStatus("skipped", ["pending"])).toBe("skipped");
    expect(nextPathStepStatus("skipped", ["fired", "fired"])).toBe("skipped");
  });

  // Boundary case the user did not enumerate, but the helper has to define a
  // behavior: a step with zero triggers must NOT auto-complete via vacuous
  // truth. We hold the current status until a trigger exists to drive the
  // transition. Documented + tested so the choice is intentional, not a quirk
  // of `Array.prototype.every`.
  it("keeps the current status when the step has no triggers yet", () => {
    expect(nextPathStepStatus("pending", [])).toBe("pending");
    expect(nextPathStepStatus("active", [])).toBe("active");
  });
});
