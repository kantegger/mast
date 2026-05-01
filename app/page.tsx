import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-8 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">投资判断审计 V3.1</h1>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
        Behavior-constraint system. Records, surfaces, and where appropriate
        blocks deviations from declared theses, paths, and triggers.
      </p>

      <p className="mt-6 text-sm text-neutral-700 dark:text-neutral-300">
        This is not a trading system. It does not give recommendations,
        predict markets, or optimise returns. It exists to make deviation
        harder.
      </p>

      <nav className="mt-10 flex flex-col gap-3">
        <Link
          href="/positions"
          className="text-sm underline underline-offset-4 hover:text-neutral-950 dark:hover:text-neutral-100"
        >
          → Positions
        </Link>
        <Link
          href="/dashboard"
          className="text-sm underline underline-offset-4 hover:text-neutral-950 dark:hover:text-neutral-100"
        >
          → Behavior Dashboard
        </Link>
      </nav>

      <section className="mt-16 border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <p className="text-xs font-mono text-neutral-500">
          Empty? Seed demo data:{" "}
          <code className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-900">
            POST /api/dev/seed
          </code>
        </p>
      </section>
    </main>
  );
}
