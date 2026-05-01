import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ViewPnlUnlock } from "./view-pnl-unlock";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ViewPnlPage({ params }: PageProps) {
  const { id } = await params;
  const position = await prisma.position.findUnique({
    where: { id },
    select: {
      id: true,
      symbol: true,
      side: true,
      status: true,
      viewPnLFlows: {
        where: { status: "unlocked" },
        orderBy: { unlockedAt: "desc" },
        take: 1,
        select: { id: true, expiresAt: true },
      },
    },
  });

  if (!position) notFound();

  const latestUnlocked = position.viewPnLFlows[0];

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <header className="flex items-baseline justify-between">
        <div>
          <Link
            href="/positions"
            className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Positions
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            P&L Unlock
          </h1>
        </div>
        <p className="text-xs font-mono text-neutral-500">
          {position.symbol} · {position.side} · {position.status}
        </p>
      </header>

      <ViewPnlUnlock
        positionId={position.id}
        initialFlowId={latestUnlocked?.id ?? null}
        initialExpiresAt={latestUnlocked?.expiresAt?.toISOString() ?? null}
      />
    </main>
  );
}
