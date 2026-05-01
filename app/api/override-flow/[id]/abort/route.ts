import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const flow = await prisma.overrideFlow.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!flow) {
    return NextResponse.json({ error: "OverrideFlow not found." }, { status: 404 });
  }

  if (flow.status === "executed") {
    return NextResponse.json(
      { error: "OverrideFlow is executed; it cannot be aborted." },
      { status: 409 },
    );
  }

  if (flow.status === "aborted") {
    return NextResponse.json({ id: flow.id, status: flow.status });
  }

  const aborted = await prisma.overrideFlow.update({
    where: { id: flow.id },
    data: { status: "aborted", abortedAt: new Date() },
  });

  return NextResponse.json({ id: aborted.id, status: aborted.status });
}
