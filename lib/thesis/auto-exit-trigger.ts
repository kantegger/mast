import type { Prisma } from "@/lib/generated/prisma/client";

// Pure helper. Given the paths of every open position on a thesis and the
// paths that already have a pending auto-inserted Exit Trigger, returns the
// distinct list of paths still needing one.
export function pathsNeedingAutoExit(
  openPositionPaths: readonly string[],
  pathsWithExistingPendingAutoExit: readonly string[],
): string[] {
  const distinct = Array.from(new Set(openPositionPaths));
  const covered = new Set(pathsWithExistingPendingAutoExit);
  return distinct.filter((p) => !covered.has(p));
}

// Idempotent insertion wrapper. For each distinct Path of an open Position on
// `thesisId`, ensures one pending autoInserted Exit Trigger exists. Skips
// paths already covered. Returns the (pathId, triggerId) of every trigger
// inserted in this call so logs and endpoint responses can name them.
export async function insertAutoExitTriggers(
  tx: Prisma.TransactionClient,
  thesisId: string,
): Promise<Array<{ pathId: string; triggerId: string }>> {
  const openPositions = await tx.position.findMany({
    where: { thesisId, status: { in: ["open", "liquidating"] } },
    select: { pathId: true },
  });

  const distinctPaths = Array.from(new Set(openPositions.map((p) => p.pathId)));
  if (distinctPaths.length === 0) return [];

  const existing = await tx.trigger.findMany({
    where: {
      pathId: { in: distinctPaths },
      type: "exit",
      autoInserted: true,
      status: "pending",
    },
    select: { pathId: true },
  });

  const todo = pathsNeedingAutoExit(
    distinctPaths,
    existing.map((t) => t.pathId),
  );

  const inserted: Array<{ pathId: string; triggerId: string }> = [];
  for (const pathId of todo) {
    const trigger = await tx.trigger.create({
      data: {
        pathId,
        pathStepId: null,
        type: "exit",
        priority: 1000,
        conditionKind: "manual",
        conditionExpr: "Thesis broken — auto-inserted Exit Trigger",
        status: "pending",
        autoInserted: true,
      },
      select: { id: true },
    });
    inserted.push({ pathId, triggerId: trigger.id });
  }

  return inserted;
}
