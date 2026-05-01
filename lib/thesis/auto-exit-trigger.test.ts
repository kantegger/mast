import { describe, expect, it, vi } from "vitest";
import {
  pathsNeedingAutoExit,
  insertAutoExitTriggers,
} from "./auto-exit-trigger";

describe("pathsNeedingAutoExit", () => {
  it("returns no paths when no open positions exist", () => {
    expect(pathsNeedingAutoExit([], [])).toEqual([]);
  });

  it("returns the one distinct path when a single position is open", () => {
    expect(pathsNeedingAutoExit(["path-A"], [])).toEqual(["path-A"]);
  });

  it("deduplicates paths when multiple positions live on the same path", () => {
    expect(pathsNeedingAutoExit(["path-A", "path-A", "path-A"], [])).toEqual([
      "path-A",
    ]);
  });

  it("returns one entry per distinct path across multiple positions", () => {
    const result = pathsNeedingAutoExit(["path-A", "path-B", "path-A"], []);
    expect(result).toHaveLength(2);
    expect(new Set(result)).toEqual(new Set(["path-A", "path-B"]));
  });

  it("skips paths that already have a pending auto-inserted exit", () => {
    expect(pathsNeedingAutoExit(["path-A"], ["path-A"])).toEqual([]);
  });

  it("inserts on paths still missing while skipping paths already covered", () => {
    const result = pathsNeedingAutoExit(["path-A", "path-B"], ["path-A"]);
    expect(result).toEqual(["path-B"]);
  });
});

describe("insertAutoExitTriggers", () => {
  it("creates one Exit Trigger per distinct path with autoInserted=true and priority=1000", async () => {
    const created: Array<Record<string, unknown>> = [];
    const tx = {
      position: {
        findMany: vi.fn(async () => [
          { pathId: "path-A" },
          { pathId: "path-A" },
          { pathId: "path-B" },
        ]),
      },
      trigger: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: `trig-${created.length}`, ...data };
        }),
      },
    };
    const result = await insertAutoExitTriggers(
      tx as unknown as Parameters<typeof insertAutoExitTriggers>[0],
      "thesis-1",
    );

    expect(result).toHaveLength(2);
    expect(new Set(result.map((r) => r.pathId))).toEqual(
      new Set(["path-A", "path-B"]),
    );
    expect(result.every((r) => typeof r.triggerId === "string")).toBe(true);

    expect(created).toHaveLength(2);
    for (const data of created) {
      expect(data.type).toBe("exit");
      expect(data.priority).toBe(1000);
      expect(data.autoInserted).toBe(true);
      expect(data.status).toBe("pending");
      expect(data.pathStepId).toBeNull();
      expect(typeof data.conditionExpr).toBe("string");
    }
  });

  it("skips paths that already have a pending auto-inserted exit (idempotent)", async () => {
    const tx = {
      position: {
        findMany: vi.fn(async () => [
          { pathId: "path-A" },
          { pathId: "path-B" },
        ]),
      },
      trigger: {
        findMany: vi.fn(async () => [
          { pathId: "path-A" },
        ]),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "trig-new",
          ...data,
        })),
      },
    };

    const result = await insertAutoExitTriggers(
      tx as unknown as Parameters<typeof insertAutoExitTriggers>[0],
      "thesis-1",
    );

    expect(result).toEqual([
      { pathId: "path-B", triggerId: "trig-new" },
    ]);
    expect(tx.trigger.create).toHaveBeenCalledTimes(1);
  });

  it("returns [] and creates nothing when no positions are open on the thesis", async () => {
    const tx = {
      position: { findMany: vi.fn(async () => []) },
      trigger: {
        findMany: vi.fn(async () => []),
        create: vi.fn(),
      },
    };

    const result = await insertAutoExitTriggers(
      tx as unknown as Parameters<typeof insertAutoExitTriggers>[0],
      "thesis-1",
    );

    expect(result).toEqual([]);
    expect(tx.trigger.create).not.toHaveBeenCalled();
  });
});
