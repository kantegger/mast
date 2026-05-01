"use client";

import { FormEvent, useEffect, useState } from "react";

type UnlockStep = "request" | "confirm" | "unlocked";

type PnlPayload = {
  pnl: string;
  symbol: string;
  currentPrice: string;
  remainingSeconds: number;
};

type ApiError = { error?: string };

export function ViewPnlUnlock({
  positionId,
  initialFlowId,
  initialExpiresAt,
}: {
  positionId: string;
  initialFlowId: string | null;
  initialExpiresAt: string | null;
}) {
  const [step, setStep] = useState<UnlockStep>(initialFlowId ? "unlocked" : "request");
  const [flowId, setFlowId] = useState<string | null>(initialFlowId);
  const [reason, setReason] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [pnl, setPnl] = useState<PnlPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);

  useEffect(() => {
    if (flowId && step === "unlocked") {
      void loadPnl(flowId);
    }
  }, [flowId, step]);

  async function requestUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/view-pnl-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionId, reason }),
    });
    const data = (await response.json()) as ApiError & { id?: string };
    setBusy(false);

    if (!response.ok || !data.id) {
      setError(data.error ?? "Unlock request failed.");
      return;
    }

    setFlowId(data.id);
    setStep("confirm");
  }

  async function confirmUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flowId) return;

    setBusy(true);
    setError(null);
    const response = await fetch(`/api/view-pnl-flow/${flowId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPrice }),
    });
    const data = (await response.json()) as ApiError & {
      remainingSeconds?: number;
    };
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? "Unlock confirmation failed.");
      return;
    }

    if (typeof data.remainingSeconds === "number") {
      setExpiresAt(new Date(Date.now() + data.remainingSeconds * 1000).toISOString());
    }
    setStep("unlocked");
    await loadPnl(flowId);
  }

  async function loadPnl(id: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/view-pnl-flow/${id}/pnl`);
    const data = (await response.json()) as ApiError & PnlPayload;
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? "P&L read failed.");
      setStep("request");
      setFlowId(null);
      setPnl(null);
      setExpiresAt(null);
      return;
    }

    setPnl(data);
  }

  return (
    <section className="mt-8 border border-neutral-300 dark:border-neutral-700 p-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            60-second window
          </p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            P&L stays hidden until you give a reason and commit the current
            price you want used for the calculation.
          </p>
        </div>
        {pnl && (
          <p className="text-right text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            {pnl.remainingSeconds}s left
          </p>
        )}
      </div>

      {step === "request" && (
        <form className="mt-6 flex flex-col gap-4" onSubmit={requestUnlock}>
          <label className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={20}
              required
              className="mt-2 min-h-28 w-full border border-neutral-300 bg-transparent p-3 font-sans text-sm outline-none focus:border-neutral-700 dark:border-neutral-700 dark:focus:border-neutral-300"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-fit border border-neutral-700 px-4 py-2 text-xs font-mono uppercase tracking-wider hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-300 dark:hover:bg-neutral-900"
          >
            Request unlock
          </button>
        </form>
      )}

      {step === "confirm" && (
        <form className="mt-6 flex flex-col gap-4" onSubmit={confirmUnlock}>
          <label className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
            Current price
            <input
              value={currentPrice}
              onChange={(event) => setCurrentPrice(event.target.value)}
              inputMode="decimal"
              required
              className="mt-2 w-full border border-neutral-300 bg-transparent p-3 font-mono text-sm outline-none focus:border-neutral-700 dark:border-neutral-700 dark:focus:border-neutral-300"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-fit border border-neutral-700 px-4 py-2 text-xs font-mono uppercase tracking-wider hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-300 dark:hover:bg-neutral-900"
          >
            Confirm and unlock
          </button>
        </form>
      )}

      {step === "unlocked" && pnl && (
        <div className="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            Unlocked P&L
          </p>
          <p className="mt-3 font-mono text-5xl tabular-nums">{pnl.pnl}</p>
          <p className="mt-3 text-xs font-mono text-neutral-500">
            {pnl.symbol} · current price {pnl.currentPrice}
            {expiresAt ? ` · expires ${new Date(expiresAt).toLocaleTimeString()}` : ""}
          </p>
          <button
            type="button"
            onClick={() => flowId && loadPnl(flowId)}
            disabled={busy}
            className="mt-5 border border-neutral-300 px-3 py-2 text-xs font-mono uppercase tracking-wider hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Refresh window
          </button>
        </div>
      )}

      {error && (
        <p className="mt-5 border border-red-700/60 p-3 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
