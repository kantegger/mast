export function isOverrideFlowReuseError(error: unknown) {
  if (!isPrismaKnownRequestError(error) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  if (Array.isArray(target) && target.includes("overrideFlowId")) return true;
  if (typeof target === "string" && target.includes("overrideFlowId")) return true;

  return (
    typeof error.message === "string" &&
    error.message.includes("Unique constraint failed") &&
    /fields:\s*\([^)]*`overrideFlowId`[^)]*\)/.test(error.message)
  );
}

function isPrismaKnownRequestError(
  error: unknown,
): error is { code: string; message?: unknown; meta?: { target?: unknown } } {
  return typeof error === "object" && error !== null && "code" in error;
}

export function nextConfirmationStage(current: number, target: number) {
  return Math.max(current, target);
}
