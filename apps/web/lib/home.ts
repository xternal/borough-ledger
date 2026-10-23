import assessedRaw from "../../../data/build/decision_assessments.json";
import type { Status } from "@borough-ledger/schema";
import type { PromiseModel } from "./model";
import { STATUS_ORDER } from "./promises";
import { shorten } from "./rss";
import { isOpenStatus, isPublished } from "./spotlight";

/*
 * What the home page's first screen shows besides the figures (Pavel, 23 Oct 2026; docs/PRE_SHIP_REVIEW.md, "A short
 * menu and a first screen of cards"): the promises at a glance, four promises to watch, and the logbook of what was
 * added, moved, reworded or checked. Each is picked by a fixed rule from the data, never by hand, and the rules read
 * nothing about who made a promise, so every party's cards are picked the same way (CLAUDE.md invariant 7).
 */

/** Plain order of ISO dates and ids, the same on every machine. */
const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface WatchPick {
  card: PromiseModel;
  /** The day it happened, or the deadline for "due next". */
  date: string;
}

export interface WatchTiles {
  /** The published card most recently delivered: its latest "delivered" step up to today, on a card still delivered. */
  delivered: WatchPick | null;
  /** The published card most recently not met: a "failed", "deadline passed" or "quietly dropped" step, on a card that ended so. */
  notMet: WatchPick | null;
  /** The open published card whose deadline comes soonest, from today on. */
  dueNext: WatchPick | null;
  /** The open published card that most recently moved a step forward: into a plan, the budget or delivery. */
  forward: WatchPick | null;
}

/** The latest step of these kinds up to today, on the published cards that pass `ok`; the earlier id on a tie. */
function latestStep(cards: readonly PromiseModel[], types: readonly string[], today: string, ok: (c: PromiseModel) => boolean): WatchPick | null {
  const steps = cards
    .filter((c) => isPublished(c) && ok(c))
    .flatMap((card) => card.timeline.filter((e) => types.includes(e.type) && e.date <= today).map((e) => ({ card, date: e.date })));
  return steps.sort((a, b) => order(b.date, a.date) || order(a.card.id, b.card.id))[0] ?? null;
}

export function watchTiles(cards: readonly PromiseModel[], today: string): WatchTiles {
  const due = cards
    .filter((c) => isPublished(c) && isOpenStatus(c.status) && c.deadline !== null && c.deadline >= today)
    .map((card) => ({ card, date: card.deadline! }))
    .sort((a, b) => order(a.date, b.date) || order(a.card.id, b.card.id));
  return {
    delivered: latestStep(cards, ["delivered"], today, (c) => c.status === "delivered"),
    notMet: latestStep(cards, ["failed", "deadline_missed", "quietly_dropped"], today, (c) => c.status === "failed" || c.status === "quietly_dropped"),
    dueNext: due[0] ?? null,
    forward: latestStep(cards, ["in_plan", "budgeted", "delivering"], today, (c) => isOpenStatus(c.status)),
  };
}

/** How many cards sit at each status, in the site's order, leaving out the empty ones. */
export function statusCounts(cards: readonly PromiseModel[]): { status: Status; count: number }[] {
  return STATUS_ORDER.map((status) => ({ status, count: cards.filter((c) => c.status === status).length })).filter((c) => c.count > 0);
}

/** A status step the logbook reports when a card moves, with its short label. */
const MOVES: Record<string, string> = {
  in_plan: "In plan",
  budgeted: "Budgeted",
  delivering: "Delivering",
  delivered: "Delivered",
  failed: "Failed",
  deadline_missed: "Deadline passed",
  quietly_dropped: "Dropped",
};
const GOOD = ["delivered"];
const BAD = ["failed", "deadline_missed", "quietly_dropped"];

/** Within one day: moves first, then rewordings, replies, new cards and checks. */
const KIND_ORDER = { moved: 0, reworded: 1, reply: 2, new: 3, checked: 4 } as const;

export interface LogEntry {
  date: string;
  kind: keyof typeof KIND_ORDER;
  /** "New", "Checked", "Reworded", "Reply", or the step a card moved to ("Delivering"). */
  label: string;
  tone: "new" | "good" | "bad" | "moved" | "neutral";
  /** What a reader sees: "Labour: 2 new pledges", "Conservative: “We will launch a Special Constable…”". */
  text: string;
  href: string;
}

/** When each council decision was put to the pledge check, and how many pledge links it gave (data/build/decision_assessments.json). */
export type Assessed = Record<string, { on: string; links: number }>;
export const ASSESSED: Assessed = (assessedRaw as { assessed: Assessed }).assessed;

const quote = (p: PromiseModel) => `${p.partyShort}: “${shorten(p.text, 90)}”`;

/**
 * The logbook: what was added, moved, reworded or checked, newest first, up to `max` lines. From the published cards: a
 * card counts as added on the day its first wording was recorded, and one party's cards added on one day are one line;
 * each status step, rewording and reply is a line. From the council's decisions: the decisions checked against every
 * pledge on one day are one line. Nothing after `today`. Nobody is named but the party a card belongs to and whoever
 * replied, as the card itself shows.
 */
export function logbook(cards: readonly PromiseModel[], today: string, max = 6, assessed: Assessed = ASSESSED): LogEntry[] {
  const out: LogEntry[] = [];
  const added = new Map<string, PromiseModel[]>();
  for (const p of cards.filter(isPublished)) {
    const href = `/promise/${p.id}`;
    const first = p.versions[0]?.recorded_on;
    if (first && first <= today) added.set(`${first}|${p.partyId}`, [...(added.get(`${first}|${p.partyId}`) ?? []), p]);
    for (const v of p.versions.slice(1))
      if (v.recorded_on <= today) out.push({ date: v.recorded_on, kind: "reworded", label: "Reworded", tone: "neutral", text: quote(p), href });
    for (const e of p.timeline)
      if (MOVES[e.type] && e.date <= today)
        out.push({ date: e.date, kind: "moved", label: MOVES[e.type]!, tone: GOOD.includes(e.type) ? "good" : BAD.includes(e.type) ? "bad" : "moved", text: quote(p), href });
    for (const r of p.replies) if (r.date <= today) out.push({ date: r.date, kind: "reply", label: "Reply", tone: "neutral", text: `Reply from ${r.from}: “${shorten(p.text, 70)}”`, href });
  }
  for (const [key, list] of added) {
    const date = key.split("|")[0]!;
    const p = list[0]!;
    out.push(
      list.length === 1
        ? { date, kind: "new", label: "New", tone: "new", text: quote(p), href: `/promise/${p.id}` }
        : { date, kind: "new", label: "New", tone: "new", text: `${p.partyShort}: ${list.length} new pledges`, href: `/party/${p.partyId}` },
    );
  }
  const checks = new Map<string, { n: number; links: number }>();
  for (const a of Object.values(assessed)) {
    if (a.on > today) continue;
    const c = checks.get(a.on) ?? { n: 0, links: 0 };
    checks.set(a.on, { n: c.n + 1, links: c.links + (a.links > 0 ? 1 : 0) });
  }
  for (const [date, { n, links }] of checks)
    out.push({
      date,
      kind: "checked",
      label: "Checked",
      tone: "good",
      text: `${n} council ${n === 1 ? "decision" : "decisions"} checked against every pledge: ${links === 0 ? "none moves one" : `${links} ${links === 1 ? "moves" : "move"} a pledge`}`,
      href: "/decisions",
    });
  return out.sort((a, b) => order(b.date, a.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || order(a.text, b.text)).slice(0, max);
}
