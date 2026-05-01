export const DEVIATION_WEIGHTS = {
  unplanned_trade: 3,
  emotional: 4,
  early_exit: 2,
  no_action: 3,
} as const;

type DeviationType = keyof typeof DEVIATION_WEIGHTS;

export const DISCIPLINE_WINDOW_DAYS = 30;
export const DISCIPLINE_BLOCK_THRESHOLD = 60;

export function disciplineScore(deviations: { type: string }[]) {
  const penalty = deviations.reduce(
    (sum, deviation) => sum + (DEVIATION_WEIGHTS[deviation.type as DeviationType] ?? 0),
    0,
  );

  return Math.max(100 - penalty, 0);
}

export function disciplineWindowStart(now: Date, windowDays = DISCIPLINE_WINDOW_DAYS) {
  return new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
}

export function overrideCooldownMultiplier(score: number) {
  if (score < 40) return 4;
  if (score < DISCIPLINE_BLOCK_THRESHOLD) return 2;
  return 1;
}
