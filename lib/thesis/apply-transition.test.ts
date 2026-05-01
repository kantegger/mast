import { describe, expect, it, vi } from "vitest";
import { applyThesisTransition } from "./apply-transition";

function makeTx(opts: {
  thesis: { id: string; status: "active" | "broken_candidate" | "broken" };
  variables: Array<{
    isCore: boolean;
    status: "valid" | "invalid";
    assumedDir: "up" | "down" | "flat";
    observedDir: "up" | "down" | "flat" | null;
    aiBreakRisk: "low" | "medium" | "high";
  }>;
  openPositions?: Array<{ pathId: string }>;
}) {
  const updateThesis = vi.fn(async () => opts.thesis);
  const createTrigger = vi.fn(async ({ data }: { data: { pathId: string } }) => ({
    id: `trig-for-${data.pathId}`,
  }));

  return {
    tx: {
      thesis: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: opts.thesis.id,
          status: opts.thesis.status,
          variables: opts.variables,
        })),
        update: updateThesis,
      },
      position: {
        findMany: vi.fn(async () => opts.openPositions ?? []),
      },
      trigger: {
        findMany: vi.fn(async () => []),
        create: createTrigger,
      },
    },
    updateThesis,
    createTrigger,
  };
}

describe("applyThesisTransition", () => {
  it("returns no-change when the computed status matches the current one", async () => {
    const { tx, updateThesis, createTrigger } = makeTx({
      thesis: { id: "thesis-1", status: "active" },
      variables: [
        {
          isCore: true,
          status: "valid",
          assumedDir: "up",
          observedDir: "up",
          aiBreakRisk: "low",
        },
      ],
    });

    const result = await applyThesisTransition(
      tx as unknown as Parameters<typeof applyThesisTransition>[0],
      "thesis-1",
      new Date("2026-05-01T00:00:00Z"),
    );

    expect(result).toEqual({
      from: "active",
      to: "active",
      changed: false,
      autoInsertedTriggers: [],
    });
    expect(updateThesis).not.toHaveBeenCalled();
    expect(createTrigger).not.toHaveBeenCalled();
  });

  it("updates the thesis status and inserts auto-exit triggers when transitioning to broken", async () => {
    const { tx, updateThesis, createTrigger } = makeTx({
      thesis: { id: "thesis-1", status: "active" },
      variables: [
        {
          isCore: true,
          status: "invalid",
          assumedDir: "up",
          observedDir: "up",
          aiBreakRisk: "low",
        },
      ],
      openPositions: [{ pathId: "path-A" }, { pathId: "path-B" }],
    });
    const now = new Date("2026-05-01T00:00:00Z");

    const result = await applyThesisTransition(
      tx as unknown as Parameters<typeof applyThesisTransition>[0],
      "thesis-1",
      now,
    );

    expect(result.from).toBe("active");
    expect(result.to).toBe("broken");
    expect(result.changed).toBe(true);
    expect(result.autoInsertedTriggers).toHaveLength(2);

    expect(updateThesis).toHaveBeenCalledWith({
      where: { id: "thesis-1" },
      data: { status: "broken", brokenAt: now },
    });
    expect(createTrigger).toHaveBeenCalledTimes(2);
  });

  it("updates status without inserting triggers when transitioning to broken_candidate", async () => {
    const { tx, updateThesis, createTrigger } = makeTx({
      thesis: { id: "thesis-1", status: "active" },
      variables: [
        {
          isCore: false,
          status: "valid",
          assumedDir: "up",
          observedDir: "down",
          aiBreakRisk: "low",
        },
      ],
      openPositions: [{ pathId: "path-A" }],
    });

    const result = await applyThesisTransition(
      tx as unknown as Parameters<typeof applyThesisTransition>[0],
      "thesis-1",
      new Date(),
    );

    expect(result.to).toBe("broken_candidate");
    expect(result.changed).toBe(true);
    expect(result.autoInsertedTriggers).toEqual([]);
    expect(updateThesis).toHaveBeenCalledOnce();
    expect(createTrigger).not.toHaveBeenCalled();
  });
});
