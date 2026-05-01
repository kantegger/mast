import { Prisma } from "./generated/prisma/client";

export const VIEW_PNL_UNLOCK_SECONDS = 60;

export type PnlSide = "long" | "short";

export function normalizePositiveDecimal(
  value: string | number | undefined,
  field: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { ok: false, error: `${field} must be a positive decimal.` };
  }

  if (new Prisma.Decimal(text).lte(0)) {
    return { ok: false, error: `${field} must be greater than 0.` };
  }

  return { ok: true, value: text };
}

export function viewPnlExpiresAt(now: Date) {
  return new Date(now.getTime() + VIEW_PNL_UNLOCK_SECONDS * 1000);
}

export function remainingUnlockSeconds(expiresAt: Date | null, now: Date) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}

export function isViewPnlExpired(
  flow: { status: string; expiresAt: Date | null },
  now: Date,
) {
  return (
    flow.status === "unlocked" &&
    flow.expiresAt !== null &&
    flow.expiresAt.getTime() <= now.getTime()
  );
}

export function computePnl(args: {
  side: PnlSide;
  size: string | number | Prisma.Decimal;
  costBasis: string | number | Prisma.Decimal;
  currentPrice: string | number | Prisma.Decimal;
}) {
  const size = new Prisma.Decimal(args.size);
  const costBasis = new Prisma.Decimal(args.costBasis);
  const currentPrice = new Prisma.Decimal(args.currentPrice);
  const perUnit =
    args.side === "long"
      ? currentPrice.minus(costBasis)
      : costBasis.minus(currentPrice);

  return perUnit.times(size);
}

export function formatDecimal(value: Prisma.Decimal, places = 2) {
  return value.toDecimalPlaces(places).toFixed(places);
}
