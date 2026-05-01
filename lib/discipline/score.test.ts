import { describe, expect, it } from "vitest";
import {
  disciplineScore,
  disciplineWindowStart,
  overrideCooldownMultiplier,
} from "./score";

describe("disciplineScore", () => {
  it("subtracts known deviation weights from 100", () => {
    expect(
      disciplineScore([
        { type: "unplanned_trade" },
        { type: "emotional" },
        { type: "early_exit" },
        { type: "no_action" },
      ]),
    ).toBe(88);
  });

  it("ignores unknown deviation types", () => {
    expect(disciplineScore([{ type: "typo_from_future" }])).toBe(100);
  });

  it("floors the score at 0", () => {
    expect(
      disciplineScore(Array.from({ length: 40 }, () => ({ type: "emotional" }))),
    ).toBe(0);
  });
});

describe("disciplineWindowStart", () => {
  it("uses a 30-day rolling window by default", () => {
    expect(
      disciplineWindowStart(new Date("2026-05-01T00:00:00.000Z")).toISOString(),
    ).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("overrideCooldownMultiplier", () => {
  it("keeps normal discipline users at the base cooldown", () => {
    expect(overrideCooldownMultiplier(60)).toBe(1);
  });

  it("doubles cooldowns below 60", () => {
    expect(overrideCooldownMultiplier(59)).toBe(2);
  });

  it("quadruples cooldowns below 40", () => {
    expect(overrideCooldownMultiplier(39)).toBe(4);
  });
});
