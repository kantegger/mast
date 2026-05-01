import { describe, expect, it } from "vitest";
import { isOverrideFlowReuseError } from "../../../lib/api-hardening";

describe("trade route hardening", () => {
  it("identifies override-flow unique violations from Prisma metadata arrays", () => {
    expect(
      isOverrideFlowReuseError({
        code: "P2002",
        meta: { target: ["overrideFlowId"] },
      }),
    ).toBe(true);
  });

  it("identifies override-flow unique violations from constraint names", () => {
    expect(
      isOverrideFlowReuseError({
        code: "P2002",
        meta: { target: "Trade_overrideFlowId_key" },
      }),
    ).toBe(true);
  });

  it("identifies override-flow unique violations under the Prisma 7 driver adapter", () => {
    expect(
      isOverrideFlowReuseError({
        code: "P2002",
        meta: { modelName: "Trade" },
        message:
          "\nInvalid `tx.trade.create()` invocation ...\nUnique constraint failed on the fields: (`overrideFlowId`)",
      }),
    ).toBe(true);
  });

  it("ignores unrelated unique violations", () => {
    expect(
      isOverrideFlowReuseError({
        code: "P2002",
        meta: { target: ["pathId", "order"] },
      }),
    ).toBe(false);
  });

  it("ignores messages that mention overrideFlowId without a matching unique constraint failure", () => {
    expect(
      isOverrideFlowReuseError({
        code: "P2002",
        meta: { modelName: "OtherTable" },
        message:
          "Unique constraint failed on the fields: (`otherId`). Related payload included overrideFlowId.",
      }),
    ).toBe(false);
  });
});
