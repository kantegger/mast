# Mast

## 投资判断审计

**Make deviation harder.**

Mast is a behavior-constraint system for investment judgment.

It does not give buy/sell advice, predict markets, or optimize returns. It helps you bind yourself to a thesis, make deviations visible, and add friction before your future self rewrites the story.

The name is from the Ulysses metaphor — tying yourself to the mast so you can hear the sirens without acting on them. The V3.1 spine implemented here is exactly that, applied to investment judgment.

The original spec (V3) was an audit ledger — *record what you deviated*. V3.1 is an operating system with brakes — *make deviation harder*. The full spec lives in [`docs/`](docs/).

---

## What's actually here

A Next.js + Prisma + SQLite app organised around three constructs:

**TradeGate** — every trade flows through one ordered rule pipeline. First non-null decision wins:

```text
Discipline → OverrideFlow → Path → Trigger → ThesisStatus
```

Discipline runs first so its blocks are non-overrideable. OverrideFlow runs second so a confirmed flow can short-circuit Path/Trigger/ThesisStatus blocks but cannot bypass Discipline.

**OverrideFlow** — multi-stage friction state machine for trades the gate would block:

```text
reason ≥30 chars  →  cooldown (low 0s / medium 300s / high 900s)  →  second confirm  →  execute
```

Cooldowns multiply ×2 when discipline score < 60 and ×4 when < 40. Each stage is a separate API call; conditional `updateMany where: { id, status: <expected> }` closes TOCTOU.

**ViewPnLFlow** — symmetric friction for *seeing* P&L. The user types the current price themselves (no fake market feed); unlock holds for 60 seconds, then auto-expires on next read.

**Behavior signals** feed back automatically:

- gated trades → `unplanned_trade` deviation
- opening attempts blocked before a Position exists → `unplanned_trade` (with null `tradeId`/`positionId`)
- exit executed before any path exit trigger fired → `early_exit` deviation
- self-tagged `emotional` / `no_action` via `POST /api/deviation`

Discipline score = `100 − Σ(weighted deviations)` over the last 30 days. Drives the dashboard, the `buy`-without-positionId block, and the override cooldown multiplier.

**Auto Exit Trigger** — when a Variable update flips its Thesis to `broken` (core variable invalid, or any variable with `aiBreakRisk: high`, or literal `up↔down` reversal of an `assumedDir`), the system auto-inserts a `priority=1000` Exit Trigger on every open Position's path. ThesisStatusRule then permits only `reduce`/`exit`/`sell` on that thesis.

---

## Stack

- **Next.js 16** (App Router) + **React 19**
- **Prisma 7** + **SQLite** via `@prisma/adapter-better-sqlite3`
- **Vitest** for unit tests
- **Tailwind 4**

---

## Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev          # http://localhost:3000
```

Optional demo data (idempotent; only touches rows whose thesis name starts with `DEMO:`):

```bash
curl -X POST http://localhost:3000/api/dev/seed
```

---

## Commands

```bash
npm run dev          # dev server
npm test             # Vitest
npm run lint         # ESLint
npx tsc --noEmit     # typecheck
npm run build        # production build
```

---

## Project structure

```text
app/
  api/
    trade/                   POST → runs through TradeGate
    override-flow/           create / [id]/confirm / [id]/abort
    view-pnl-flow/           create / [id]/confirm / [id]/pnl
    variables/[id]/          PATCH → triggers thesis transition
    deviation/               POST manual deviations
    dev/seed/                idempotent demo data
  positions/                 de-financialized position list + view-pnl page
  dashboard/                 Discipline · By-Type · Trends · Heatmap · Patterns
lib/
  trade-gate/                rule pipeline + 5 rules
  thesis/                    nextThesisStatus + auto-exit-trigger insertion
  path-step/                 nextPathStepStatus
  discipline/                score / weights / dashboard helpers
  view-pnl-flow.ts           P&L math + unlock helpers
  api-hardening.ts           Prisma error detection
prisma/
  schema.prisma
  migrations/
docs/
  spec v3.1.docx             current spec
  spec v3.docx               historical
```

---

## Non-goals (spec §8)

- No buy/sell recommendations
- No market prediction
- No return optimisation

These are hard project boundaries. Any feature that crosses them belongs in a different project.

---

## Status

V3.1 spine is complete. The only spec section not implemented is **§7 Behavior Stability** — the spec names the metric but does not numerically define it. Deferred deliberately rather than invented casually.

The next chapter (separate from V3.1) is a management UI for authoring `Thesis → Variables → Path → Steps → Triggers`. Currently authoring is only via the seed route or raw SQL.

---

## License

[MIT](LICENSE)
