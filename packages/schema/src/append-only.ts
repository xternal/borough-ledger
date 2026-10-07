import type { PromiseCard } from "./content";

/**
 * CLAUDE.md invariant 8: promise history is append-only. Compared with the published version of each card:
 * versions and events may only grow at the end, an existing entry never changes, and a card is never deleted.
 */
export function appendOnlyProblems(before: readonly PromiseCard[], after: readonly PromiseCard[]): string[] {
  const problems: string[] = [];
  const now = new Map(after.map((p) => [p.id, p]));
  for (const old of before) {
    const p = now.get(old.id);
    if (!p) {
      problems.push(`${old.id}: deleted. Cards are never removed; record what happened as an event instead.`);
      continue;
    }
    for (const key of ["versions", "events"] as const) {
      const a = old[key] as unknown[];
      const b = p[key] as unknown[];
      if (b.length < a.length) problems.push(`${old.id}: ${key} shortened from ${a.length} to ${b.length}`);
      a.forEach((entry, i) => {
        if (i < b.length && JSON.stringify(entry) !== JSON.stringify(b[i])) problems.push(`${old.id}: ${key}[${i}] was edited; add a new entry instead`);
      });
    }
  }
  return problems;
}
