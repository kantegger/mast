import Link from "next/link";
import { prisma } from "@/lib/db";
import { disciplineWindowStart } from "@/lib/discipline/score";
import {
  dashboardSummary,
  dominantDeviationPatterns,
  dominantPatternHeadline,
  deviationsByType,
  deviationsDailyTrend,
  overrideHeatmap,
  overrideLifecycleSummary,
  type ByTypeBreakdown,
  type DailyTrendPoint,
  type DashboardSummary,
  type DominantDeviationPattern,
  type OverrideHeatmapPoint,
  type OverrideLifecycleSummary,
} from "@/lib/discipline/dashboard";

export const dynamic = "force-dynamic";

const TREND_DAYS = 30;

export default async function DashboardPage() {
  const now = new Date();
  const since = disciplineWindowStart(now);

  const deviations = await prisma.deviation.findMany({
    where: { createdAt: { gte: since } },
    select: { type: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const overrideFlows = await prisma.overrideFlow.findMany({
    where: {
      OR: [
        { createdAt: { gte: since } },
        { confirmedAt: { gte: since } },
        { executedAt: { gte: since } },
        { abortedAt: { gte: since } },
      ],
    },
    select: {
      severity: true,
      status: true,
      createdAt: true,
      confirmedAt: true,
      executedAt: true,
      abortedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const summary = dashboardSummary(deviations);
  const byType = deviationsByType(deviations);
  const patterns = dominantDeviationPatterns(deviations);
  const trend = deviationsDailyTrend(deviations, now, TREND_DAYS);
  const heatmap = overrideHeatmap(overrideFlows, now, TREND_DAYS);
  const overrideSummary = overrideLifecycleSummary(overrideFlows, now, TREND_DAYS);

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
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            Behavior Dashboard
          </h1>
        </div>
        <p className="text-xs font-mono text-neutral-500">
          {summary.windowDays}-day rolling window
        </p>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
        <DisciplinePanel summary={summary} />
        <ByTypePanel rows={byType} totalPenalty={summary.totalPenalty} />
      </section>

      <section className="mt-8">
        <TrendPanel trend={trend} />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
        <PatternPanel patterns={patterns} totalPenalty={summary.totalPenalty} />
        <OverrideHeatmapPanel heatmap={heatmap} summary={overrideSummary} />
      </section>
    </main>
  );
}

function DisciplinePanel({ summary }: { summary: DashboardSummary }) {
  const zoneClass = ZONE_STYLES[summary.zone];

  return (
    <div className={`border p-6 ${zoneClass.frame}`}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
        Discipline Score
      </p>
      <div className="mt-3 flex items-baseline gap-3">
        <span className={`font-mono text-5xl tabular-nums ${zoneClass.number}`}>
          {summary.score}
        </span>
        <span
          className={`border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${zoneClass.badge}`}
        >
          {summary.zone}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-y-2 text-xs font-mono">
        <dt className="text-neutral-500">Deviations ({summary.windowDays}d)</dt>
        <dd className="text-right tabular-nums">{summary.totalDeviations}</dd>

        <dt className="text-neutral-500">Total penalty</dt>
        <dd className="text-right tabular-nums">{summary.totalPenalty}</dd>

        <dt className="text-neutral-500">Override cooldown</dt>
        <dd className="text-right tabular-nums">×{summary.cooldownMultiplier}</dd>

        <dt className="text-neutral-500">New position open</dt>
        <dd
          className={`text-right ${
            summary.blocksNewPositions
              ? "text-red-700 dark:text-red-400"
              : "text-neutral-700 dark:text-neutral-300"
          }`}
        >
          {summary.blocksNewPositions ? "blocked" : "allowed"}
        </dd>
      </dl>

      <p className="mt-5 text-xs text-neutral-600 dark:text-neutral-400">
        {ZONE_COPY[summary.zone]}
      </p>
    </div>
  );
}

function ByTypePanel({
  rows,
  totalPenalty,
}: {
  rows: ByTypeBreakdown;
  totalPenalty: number;
}) {
  return (
    <div className="border border-neutral-300 dark:border-neutral-700 p-6">
      <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
        Deviation Types ({rows.length})
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No deviations recorded.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.type}>
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="text-neutral-700 dark:text-neutral-300">
                  {row.type}
                </span>
                <span className="text-neutral-500 tabular-nums">
                  {row.count} × {row.weight} = {row.penalty}
                </span>
              </div>
              <div className="mt-1 h-1 w-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-1 bg-neutral-600 dark:bg-neutral-400"
                  style={{
                    width: `${
                      totalPenalty === 0
                        ? 0
                        : Math.round((row.penalty / totalPenalty) * 100)
                    }%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrendPanel({ trend }: { trend: DailyTrendPoint[] }) {
  const max = Math.max(1, ...trend.map((p) => p.totalPenalty));

  const labelEvery = Math.max(1, Math.floor(trend.length / 5));

  return (
    <div className="border border-neutral-300 dark:border-neutral-700 p-6">
      <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
        Deviation Trend ({trend.length}d)
      </p>

      <div className="mt-5 flex items-end gap-[2px] h-24">
        {trend.map((p) => (
          <div
            key={p.date}
            className="flex-1 flex flex-col justify-end"
            title={`${p.date} · penalty ${p.totalPenalty}`}
          >
            <div
              className={`w-full ${
                p.totalPenalty === 0
                  ? "bg-neutral-200 dark:bg-neutral-800"
                  : "bg-neutral-700 dark:bg-neutral-300"
              }`}
              style={{
                height: `${Math.max(2, (p.totalPenalty / max) * 96)}px`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[10px] font-mono text-neutral-500">
        {trend.map((p, i) => (
          <span
            key={p.date}
            className={i % labelEvery === 0 ? "" : "invisible"}
          >
            {p.date.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}

function PatternPanel({
  patterns,
  totalPenalty,
}: {
  patterns: DominantDeviationPattern[];
  totalPenalty: number;
}) {
  const headline = dominantPatternHeadline(patterns);

  return (
    <div className="border border-neutral-300 dark:border-neutral-700 p-6">
      <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
        Pattern Detection
      </p>

      {patterns.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          No weighted deviation pattern detected.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-xs text-neutral-500">Dominant pattern</p>
            <p className="mt-1 font-mono text-lg">{headline.title}</p>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
              {headline.copy}
            </p>
          </div>

          <ul className="mt-5 flex flex-col gap-3">
            {patterns.map((pattern) => (
              <li key={pattern.type}>
                <div className="flex items-baseline justify-between text-xs font-mono">
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {pattern.type}
                  </span>
                  <span className="text-neutral-500 tabular-nums">
                    {pattern.penaltyShare}% · {pattern.penalty}/{totalPenalty}
                  </span>
                </div>
                <div className="mt-1 h-1 w-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={
                      pattern.dominant
                        ? "h-1 bg-red-700 dark:bg-red-400"
                        : "h-1 bg-neutral-600 dark:bg-neutral-400"
                    }
                    style={{ width: `${pattern.penaltyShare}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function OverrideHeatmapPanel({
  heatmap,
  summary,
}: {
  heatmap: OverrideHeatmapPoint[];
  summary: OverrideLifecycleSummary;
}) {
  const max = Math.max(1, ...heatmap.map((p) => p.total));
  const labelEvery = Math.max(1, Math.floor(heatmap.length / 5));
  const hasFlows = summary.created + summary.confirmed + summary.executed + summary.aborted > 0;

  return (
    <div className="border border-neutral-300 dark:border-neutral-700 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Override Heatmap ({heatmap.length}d)
        </p>
        <dl className="grid grid-cols-5 gap-3 text-[10px] font-mono text-neutral-500">
          <MetricTiny label="created" value={summary.created} />
          <MetricTiny label="confirmed" value={summary.confirmed} />
          <MetricTiny label="executed" value={summary.executed} />
          <MetricTiny label="aborted" value={summary.aborted} />
          <MetricTiny label="open" value={summary.open} />
        </dl>
      </div>

      {!hasFlows ? (
        <p className="mt-6 text-sm text-neutral-500">No override flows recorded.</p>
      ) : (
        <>
          <div className="mt-5 flex items-end gap-[2px] h-20">
            {heatmap.map((p) => (
              <div
                key={p.date}
                className="flex-1 flex flex-col justify-end gap-[1px]"
                title={`${p.date} · low ${p.low}, medium ${p.medium}, high ${p.high}`}
              >
                <SeverityBar count={p.high} max={max} className="bg-red-700 dark:bg-red-400" />
                <SeverityBar
                  count={p.medium}
                  max={max}
                  className="bg-amber-600 dark:bg-amber-400"
                />
                <SeverityBar
                  count={p.low}
                  max={max}
                  className="bg-neutral-500 dark:bg-neutral-500"
                />
                {p.total === 0 && (
                  <div className="h-[2px] w-full bg-neutral-200 dark:bg-neutral-800" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-2 flex justify-between text-[10px] font-mono text-neutral-500">
            {heatmap.map((p, i) => (
              <span
                key={p.date}
                className={i % labelEvery === 0 ? "" : "invisible"}
              >
                {p.date.slice(5)}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            <LegendSwatch className="bg-red-700 dark:bg-red-400" label="high" />
            <LegendSwatch className="bg-amber-600 dark:bg-amber-400" label="medium" />
            <LegendSwatch className="bg-neutral-500" label="low" />
          </div>
        </>
      )}
    </div>
  );
}

function SeverityBar({
  count,
  max,
  className,
}: {
  count: number;
  max: number;
  className: string;
}) {
  if (count === 0) return null;
  return (
    <div
      className={`w-full ${className}`}
      style={{ height: `${Math.max(3, (count / max) * 72)}px` }}
    />
  );
}

function MetricTiny({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="mt-1 text-right text-neutral-800 dark:text-neutral-200 tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 ${className}`} />
      {label}
    </span>
  );
}

const ZONE_STYLES = {
  healthy: {
    frame: "border-neutral-300 dark:border-neutral-700",
    number: "text-neutral-900 dark:text-neutral-100",
    badge:
      "border-neutral-400/60 text-neutral-600 dark:text-neutral-400",
  },
  caution: {
    frame: "border-amber-600/40",
    number: "text-amber-700 dark:text-amber-400",
    badge: "border-amber-600/60 text-amber-700 dark:text-amber-400",
  },
  restricted: {
    frame: "border-red-700/60",
    number: "text-red-700 dark:text-red-400",
    badge: "border-red-700/60 text-red-700 dark:text-red-400",
  },
  locked: {
    frame: "border-red-700/80 bg-red-50/40 dark:bg-red-950/10",
    number: "text-red-700 dark:text-red-400",
    badge:
      "border-red-700/80 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
  },
} as const;

const ZONE_COPY: Record<DashboardSummary["zone"], string> = {
  healthy:
    "Behavior is on plan. No friction increases active.",
  caution:
    "Score is approaching the discipline threshold. No behavior changes yet — review recent deviations before they cross 60.",
  restricted:
    "Score is below 60. New positions are blocked. Override cooldowns are doubled until recent deviations decay.",
  locked:
    "Score is below 40. New positions are blocked. Override cooldowns are quadrupled. Treat any further deviation as a stop signal, not a friction problem.",
};
