import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applyThesisTransition } from "@/lib/thesis/apply-transition";

const STATUSES = new Set(["valid", "invalid"]);
const DIRECTIONS = new Set(["up", "down", "flat"]);
const RISKS = new Set(["low", "medium", "high"]);

type PatchBody = {
  status?: "valid" | "invalid";
  observedDir?: "up" | "down" | "flat" | null;
  aiBreakRisk?: "low" | "medium" | "high";
  notes?: string | null;
};

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as PatchBody | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validatePatch(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const exists = await prisma.variable.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Variable not found." }, { status: 404 });
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.variable.update({
      where: { id },
      data: validation.data,
      select: {
        id: true,
        thesisId: true,
        name: true,
        isCore: true,
        status: true,
        assumedDir: true,
        observedDir: true,
        aiBreakRisk: true,
        notes: true,
        updatedAt: true,
      },
    });

    const thesisTransition = await applyThesisTransition(
      tx,
      updated.thesisId,
      now,
    );

    return { variable: updated, thesisTransition };
  });

  return NextResponse.json(result);
}

function validatePatch(
  body: PatchBody,
):
  | { ok: true; data: PatchBody }
  | { ok: false; error: string } {
  const data: PatchBody = {};
  let touched = false;

  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) {
      return { ok: false, error: "status must be 'valid' or 'invalid'." };
    }
    data.status = body.status;
    touched = true;
  }
  if (body.observedDir !== undefined) {
    if (body.observedDir !== null && !DIRECTIONS.has(body.observedDir)) {
      return {
        ok: false,
        error: "observedDir must be 'up', 'down', 'flat', or null.",
      };
    }
    data.observedDir = body.observedDir;
    touched = true;
  }
  if (body.aiBreakRisk !== undefined) {
    if (!RISKS.has(body.aiBreakRisk)) {
      return {
        ok: false,
        error: "aiBreakRisk must be 'low', 'medium', or 'high'.",
      };
    }
    data.aiBreakRisk = body.aiBreakRisk;
    touched = true;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return { ok: false, error: "notes must be a string or null." };
    }
    data.notes = body.notes;
    touched = true;
  }

  if (!touched) {
    return {
      ok: false,
      error:
        "At least one of status, observedDir, aiBreakRisk, notes must be supplied.",
    };
  }

  return { ok: true, data };
}
