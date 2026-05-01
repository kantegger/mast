# Roadmap

## Status

V3.1 spine is complete (see [README](../README.md)). Mast currently runs as a local rule system — **no AI keys required**.

The only environment variable is the database URL:

```env
DATABASE_URL="file:./dev.db"
```

The TradeGate is a deterministic rule pipeline. DisciplineScore is a weighted aggregation over the `Deviation` table. Pattern Detection is a database aggregation. Thesis transitions (`broken_candidate`, `broken`) are deterministic state machines. OverrideFlow and ViewPnLFlow are friction state machines. Nothing in V3.1 calls an LLM or external AI service.

The schema does include one field that anticipates AI: `Variable.aiBreakRisk`. Today it's a manually-set enum (`low | medium | high`) read by `nextThesisStatus` to flag a thesis as `broken` when any variable carries `high`. Nothing populates it automatically.

---

## Planned chapters (no fixed sequence yet)

### Management UI

Author `Thesis → Variables → Path → Steps → Triggers` from the browser. Currently authoring is via the seed route or raw SQL only. Independent of AI; this is what converts Mast from spec demonstrator to daily-use tool.

The hinge question for design: is thesis authoring a free planning act, or does it need its own audit friction so the user can't simply re-author reality to escape the rest of the system? Likely the next session.

### Behavior Stability (spec §7, unfinished)

The only spec section still unimplemented. Spec names the metric but does not define it numerically. Candidates: rolling std-dev of daily penalty, count of zone transitions in 30 days, autocorrelation of deviation events. Deserves a design pass before code.

---

## V3.2 candidate: AI integration

V3.2 would introduce AI as a **narrow tool wired in at specific seams**, not a general layer over the system. Four candidate integration points, in roughly ascending invasiveness:

### 1. Auto-suggest `aiBreakRisk`

A worker scans recent news / market data tied to a Variable's name and proposes an `aiBreakRisk` value with rationale text. User confirms or rejects from the dashboard before anything writes to the schema field.

**Why first:** the field already exists; only new code is a worker + a confirmation endpoint. Preserves discipline ethos — AI suggests, never sets.

### 2. Summarize deviation patterns

Beyond the existing dominant-pattern dashboard, generate prose readings of recent behavior:

> Your last 30 days show a recurring pattern of overriding `add` triggers in low-discipline windows. The override reasons cluster around X.

Augments Pattern Detection with prose, not numbers.

### 3. Help review override reasons

When a user types an override reason ≥30 chars, AI surfaces a short challenge:

> Your reason cites X — but the variable still reads valid. Do you want to invalidate it first before overriding?

The challenge is friction, not blocking. User can dismiss and proceed. The 30-char minimum filters thoughtless overrides today; AI surfacing inconsistency between the reason and the actual schema state adds a second filter without removing user authority.

### 4. Generate thesis risk critique

On thesis creation or major edit (Management UI chapter), AI reads the full Thesis + Variables + Path + Triggers and produces a short critique:

> Variable A and Variable B are not actually independent — both depend on Fed action. If Fed surprises, you'll see correlated invalidation.

Read-only output, presented during authoring. Highest leverage but also highest risk of overstepping into "should I make this trade?" territory. Belongs in *forward-looking* authoring, not in *backward-binding* execution.

---

## Design constraints for any V3.2 AI integration

Same ethos as V3.1 — these are not optional:

- **AI never decides.** It surfaces, suggests, summarizes. Final state transitions stay with explicit user action.
- **AI is a narrow tool, not a layer.** Each integration point is a specific function call at a specific seam. There is no "AI layer" the system reads from generally.
- **AI suggestion ≠ AI commitment.** Suggestions don't write to the audit trail. Only user-accepted state does.
- **AI failure must not unblock the user.** If the API is down, the user operates the system without the suggestion. The system never depends on AI for correctness.
- **AI never softens friction.** No "you've already overridden 3 times this week, go ahead" comfort copy. If anything, AI hardens friction by surfacing inconsistencies the user might prefer not to see.

These are the same boundaries spec §8 places on Mast itself, applied recursively to the AI features:
- No buy/sell recommendations
- No market prediction
- No return optimization
