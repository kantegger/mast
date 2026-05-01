import Link from "next/link";
import { listPositionsWithMetrics, type PositionMetrics } from "@/lib/position-metrics";

// Server Component — fetches on the server, never ships P&L data to the client.
export default async function PositionsPage() {
  const positions = await listPositionsWithMetrics();

  return (
    <main className="mx-auto max-w-5xl px-8 py-12">
      <header className="flex items-baseline justify-between">
        <div>
          <Link
            href="/"
            className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Home
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">Positions</h1>
        </div>
        <p className="text-xs font-mono text-neutral-500">
          {positions.length} open
        </p>
      </header>

      {positions.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {positions.map((p) => (
            <PositionCard key={p.positionId} metrics={p} />
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 border border-dashed border-neutral-300 dark:border-neutral-700 p-8">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        No open positions.
      </p>
      <p className="mt-2 text-xs font-mono text-neutral-500">
        Seed demo data:{" "}
        <code className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-900">
          POST /api/dev/seed
        </code>
      </p>
    </div>
  );
}

function PositionCard({ metrics }: { metrics: PositionMetrics }) {
  const broken = metrics.thesisHealth.status === "broken";
  const atRisk = metrics.thesisHealth.status === "broken_candidate";

  return (
    <li
      className={
        "border p-5 " +
        (broken
          ? "border-red-700/60 bg-red-50/40 dark:bg-red-950/10"
          : atRisk
            ? "border-amber-600/40"
            : "border-neutral-300 dark:border-neutral-700")
      }
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-base font-semibold">
            {metrics.symbol}
          </span>
          <span className="text-xs uppercase tracking-wider text-neutral-500">
            {metrics.side}
          </span>
        </div>
        <ThesisBadge status={metrics.thesisHealth.status} />
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Distance to Trigger"
          value={
            metrics.distanceToTrigger.pendingCount === 0
              ? "—"
              : `${metrics.distanceToTrigger.pendingCount} pending`
          }
          sub={metrics.distanceToTrigger.label}
        />
        <Metric
          label="Thesis Health"
          value={
            broken
              ? "Broken"
              : atRisk
                ? "At risk"
                : `${metrics.thesisHealth.coreVariableValid}/${metrics.thesisHealth.coreVariableTotal} core`
          }
          sub={metrics.thesisHealth.label}
        />
        <Metric
          label="Path Progress"
          value={`${metrics.pathProgress.percent}%`}
          sub={metrics.pathProgress.label}
        />
        <Metric
          label="Risk Exposure"
          value={
            metrics.riskExposure.riskBudgetPct === null
              ? "—"
              : `${metrics.riskExposure.riskBudgetPct.toFixed(2)}%`
          }
          sub={metrics.riskExposure.label}
        />
      </dl>

      {metrics.pathProgress.activeStepDescription && (
        <p className="mt-5 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="font-mono uppercase tracking-wider text-neutral-500">
            Active step:
          </span>{" "}
          {metrics.pathProgress.activeStepDescription}
        </p>
      )}

      <ViewPnLLink positionId={metrics.positionId} />
    </li>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <dt className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg">{value}</dd>
      <p className="mt-1 text-xs text-neutral-500">{sub}</p>
    </div>
  );
}

function ThesisBadge({ status }: { status: PositionMetrics["thesisHealth"]["status"] }) {
  const label =
    status === "broken"
      ? "thesis broken"
      : status === "broken_candidate"
        ? "thesis at risk"
        : "thesis active";
  const cls =
    status === "broken"
      ? "border-red-700/60 text-red-700 dark:text-red-400"
      : status === "broken_candidate"
        ? "border-amber-600/60 text-amber-700 dark:text-amber-400"
        : "border-neutral-400/60 text-neutral-600 dark:text-neutral-400";
  return (
    <span
      className={`border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

// Friction-gated link to view P&L. Wired to the ViewPnLFlow stub for now.
function ViewPnLLink({ positionId }: { positionId: string }) {
  return (
    <p className="mt-4 text-[11px] font-mono text-neutral-500">
      P&L is hidden by design.{" "}
      <a
        href={`/positions/${positionId}/view-pnl`}
        className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        Request unlock (60s, requires reason ≥20 chars)
      </a>
    </p>
  );
}
