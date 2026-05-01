import { describe, expect, it } from "vitest";
import {
  computePnl,
  formatDecimal,
  isViewPnlExpired,
  normalizePositiveDecimal,
  remainingUnlockSeconds,
  viewPnlExpiresAt,
} from "./view-pnl-flow";

describe("view-pnl-flow helpers", () => {
  it("normalizes positive decimal input", () => {
    expect(normalizePositiveDecimal("93.25", "currentPrice")).toEqual({
      ok: true,
      value: "93.25",
    });
    expect(normalizePositiveDecimal("0", "currentPrice")).toEqual({
      ok: false,
      error: "currentPrice must be greater than 0.",
    });
    expect(normalizePositiveDecimal("abc", "currentPrice")).toEqual({
      ok: false,
      error: "currentPrice must be a positive decimal.",
    });
  });

  it("sets a 60-second unlock expiry", () => {
    expect(viewPnlExpiresAt(new Date("2026-05-02T00:00:00Z")).toISOString()).toBe(
      "2026-05-02T00:01:00.000Z",
    );
  });

  it("reports remaining unlock seconds with a zero floor", () => {
    const now = new Date("2026-05-02T00:00:30Z");
    expect(remainingUnlockSeconds(new Date("2026-05-02T00:01:00Z"), now)).toBe(30);
    expect(remainingUnlockSeconds(new Date("2026-05-01T23:59:00Z"), now)).toBe(0);
  });

  it("detects expired unlocked flows", () => {
    expect(
      isViewPnlExpired(
        { status: "unlocked", expiresAt: new Date("2026-05-02T00:00:00Z") },
        new Date("2026-05-02T00:00:00Z"),
      ),
    ).toBe(true);
    expect(
      isViewPnlExpired(
        { status: "pending", expiresAt: new Date("2026-05-02T00:00:00Z") },
        new Date("2026-05-02T00:00:00Z"),
      ),
    ).toBe(false);
  });

  it("computes long and short P&L", () => {
    expect(
      formatDecimal(
        computePnl({
          side: "long",
          size: "10",
          costBasis: "90",
          currentPrice: "93.25",
        }),
      ),
    ).toBe("32.50");
    expect(
      formatDecimal(
        computePnl({
          side: "short",
          size: "10",
          costBasis: "90",
          currentPrice: "93.25",
        }),
      ),
    ).toBe("-32.50");
  });
});
