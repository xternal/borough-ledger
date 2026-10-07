import type { PromiseCard } from "./content";

/** Statuses for which a passed deadline means nothing new: already decided, or not the administration's to deliver. */
const SETTLED = new Set(["delivered", "failed", "quietly_dropped", "not_in_power", "unscoreable"]);

/**
 * docs/PROMISE_STANDARD.md: a deadline that passes with no delivery is flagged automatically; an editor confirms
 * "quietly dropped" after 30 days. Returns the cards that need a deadline_missed event today.
 */
export function deadlinesMissed(promises: readonly PromiseCard[], today: string): PromiseCard[] {
  return promises.filter(
    (p) => p.deadline !== null && p.deadline < today && !SETTLED.has(p.status) && !p.events.some((e) => e.type === "deadline_missed" && e.date >= p.deadline!),
  );
}
