// PathStep state machine: lives outside the route so the rule is testable
// in isolation and any caller (route, batch jobs, future webhooks) applies
// the same transition.
//
// String-literal unions instead of importing Prisma enums so this file is
// pure and trivially mockable. The route is responsible for converting
// between Prisma's enum values and these strings.

export type PathStepStatus = "pending" | "active" | "completed" | "skipped";
export type TriggerStatus = "pending" | "fired" | "expired" | "cancelled";

export function nextPathStepStatus(
  current: PathStepStatus,
  triggerStatuses: readonly TriggerStatus[],
): PathStepStatus {
  if (current === "completed" || current === "skipped") return current;
  if (triggerStatuses.length === 0) return current;

  const allDone = triggerStatuses.every((s) => s !== "pending");
  if (allDone) return "completed";

  const anyFired = triggerStatuses.some((s) => s === "fired");
  if (anyFired) return "active";

  return current;
}
