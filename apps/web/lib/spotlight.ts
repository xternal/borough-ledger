import type { Status } from "@borough-ledger/schema";

/**
 * Promises close to the way in (docs/PRE_SHIP_REVIEW.md, "Promises close to the way in (19 Oct 2026)"; OpenPromises
 * decision 30): which cards the home page shows, chosen by a rule and never by hand. The rule is the engine's
 * `spotlight()`, written here because this site does not run the engine.
 *
 * The rule reads only ids, dates, statuses, deadlines and the editor's check. It takes nothing about who made a
 * promise, so every party's cards are chosen the same way (CLAUDE.md invariant 7; apps/web/test/spotlight.test.ts swaps
 * and removes them to check).
 */

/** How many cards each list shows: "Latest changes" and "Due next". */
export const SPOTLIGHT_SIZE = 3;

/** A card as the rule sees it: a promise card (PromiseModel) has all of this. */
export interface SpotlightCard {
  id: string;
  status: Status;
  deadline: string | null;
  versions: readonly { recorded_on: string }[];
  timeline: readonly { date: string }[];
  replies: readonly { date: string }[];
  /** Still waiting for the editor's approval: not published, so never chosen. */
  editorCheck: boolean;
}

export interface Spotlight<T> {
  /** Published cards that changed most recently, newest first. */
  recent: T[];
  /** Open published cards with the nearest deadline from today on, none of them already in `recent`. */
  due: T[];
}

/**
 * Finished: delivered, failed, quietly dropped or unscoreable (the engine's delivered, broken, dropped and
 * unscoreable). Every other status is open or in progress: promised, in plan, budgeted, delivering, and an opposition
 * pledge, which is neither delivered nor finished.
 */
export const FINISHED: readonly Status[] = ["delivered", "failed", "quietly_dropped", "unscoreable"];

export const isOpenStatus = (s: Status) => !FINISHED.includes(s);

/** Published: the editor has approved it (docs/PROMISE_STANDARD.md §5). A card awaiting the editor's check is never chosen. */
export const isPublished = (c: Pick<SpotlightCard, "editorCheck">) => !c.editorCheck;

/** Plain order of ISO dates and ids, the same on every machine. */
const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The day a card last changed, as of `today` (YYYY-MM-DD): the latest of its timeline event dates, its versions'
 * `recorded_on` dates (a rewording is a new version) and its reply dates that are not after today. The editor's
 * check is not dated and does not count. Undefined when the card has no such date.
 */
export function lastChanged(card: Pick<SpotlightCard, "versions" | "timeline" | "replies">, today: string): string | undefined {
  const dates = [...card.timeline.map((e) => e.date), ...card.versions.map((v) => v.recorded_on), ...card.replies.map((r) => r.date)];
  return dates.filter((d) => d <= today).reduce<string | undefined>((latest, d) => (latest === undefined || d > latest ? d : latest), undefined);
}

/**
 * The rule (OpenPromises decision 30):
 * - `recent`: published cards by `lastChanged`, newest first, then by id; the first SPOTLIGHT_SIZE.
 * - `due`: published cards not in `recent` whose status is open or in progress and whose deadline is today or later,
 *   nearest deadline first, then by id; the first SPOTLIGHT_SIZE.
 * `today` is the UK date, YYYY-MM-DD; the site passes the day the page is built (PageModel.today).
 */
export function spotlight<T extends SpotlightCard>(cards: readonly T[], today: string): Spotlight<T> {
  const published = cards.filter(isPublished);
  const changed = new Map(published.map((c) => [c.id, lastChanged(c, today) ?? ""]));
  const recent = [...published].sort((a, b) => order(changed.get(b.id)!, changed.get(a.id)!) || order(a.id, b.id)).slice(0, SPOTLIGHT_SIZE);
  const inRecent = new Set(recent.map((c) => c.id));
  const due = published
    .flatMap((c) => (!inRecent.has(c.id) && isOpenStatus(c.status) && c.deadline !== null && c.deadline >= today ? [{ card: c, deadline: c.deadline }] : []))
    .sort((a, b) => order(a.deadline, b.deadline) || order(a.card.id, b.card.id))
    .slice(0, SPOTLIGHT_SIZE)
    .map((d) => d.card);
  return { recent, due };
}
