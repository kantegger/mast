import type { Prisma } from "@/lib/generated/prisma/client";
import {
  nextThesisStatus,
  type ThesisStatus,
  type VariableSnapshot,
} from "./transitions";
import { insertAutoExitTriggers } from "./auto-exit-trigger";

export type ThesisTransitionResult = {
  from: ThesisStatus;
  to: ThesisStatus;
  changed: boolean;
  autoInsertedTriggers: Array<{ pathId: string; triggerId: string }>;
};

// Loads the thesis with its variables, computes the next status from
// nextThesisStatus, and applies the side effects:
//   - if status changed: update thesis (status, brokenAt when going to broken)
//   - if new status is `broken`: insertAutoExitTriggers
//
// Idempotent: safe to call after every Variable update; no-op when nothing
// would change.
export async function applyThesisTransition(
  tx: Prisma.TransactionClient,
  thesisId: string,
  now: Date,
): Promise<ThesisTransitionResult> {
  const thesis = await tx.thesis.findUniqueOrThrow({
    where: { id: thesisId },
    select: {
      id: true,
      status: true,
      variables: {
        select: {
          isCore: true,
          status: true,
          assumedDir: true,
          observedDir: true,
          aiBreakRisk: true,
        },
      },
    },
  });

  const from = thesis.status as ThesisStatus;
  const to = nextThesisStatus(from, thesis.variables as VariableSnapshot[]);

  if (to === from) {
    return { from, to, changed: false, autoInsertedTriggers: [] };
  }

  await tx.thesis.update({
    where: { id: thesisId },
    data: {
      status: to,
      ...(to === "broken" ? { brokenAt: now } : {}),
    },
  });

  const autoInsertedTriggers =
    to === "broken" ? await insertAutoExitTriggers(tx, thesisId) : [];

  return { from, to, changed: true, autoInsertedTriggers };
}
