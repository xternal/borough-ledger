/* The weekly digest: what happened in the past week, what is coming up, and one number worth knowing, as plain facts
   with links. A writer (Claude, or the plain template) turns them into a Substack draft; every number in the draft
   must be one of these facts' numbers (draftNumbersOk). The same treatment for every party (CLAUDE.md invariant 7). */
import { partyOf, sideOf, type Content } from "./content";
import type { DecisionsFile } from "./decisions";
import type { WardSpend } from "./wardspend";

export interface Fact {
  section: "this-week" | "coming-up" | "deadlines" | "number";
  text: string;
  url: string;
}

export interface UpcomingMeeting {
  body: string;
  date: string;
  time: string;
  url: string;
  items: string[];
}

export interface DigestInput {
  today: string;
  site: string;
  content: Content;
  decisions: DecisionsFile;
  /** When each decision was first assessed (decision_assessments.json): a proxy for when it appeared. */
  assessed: Record<string, { on: string; by?: string }>;
  upcoming: UpcomingMeeting[];
  wardSpend: WardSpend;
  /** The latest quarter, when new spend data arrived this week. */
  newPayments: { from: string; to: string; total: number; rows: number } | null;
}

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const day = (iso: string) => DAY.format(new Date(`${iso}T12:00:00Z`));
const date = (iso: string) => SHORT.format(new Date(`${iso}T12:00:00Z`));
const month = (ym: string) => MONTH.format(new Date(`${ym}-01T12:00:00Z`));
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** £12.3m, or £462,042 under a million. */
export function money(v: number): string {
  return Math.abs(v) >= 1e6 ? `£${(v / 1e6).toFixed(1)}m` : `£${Math.round(v).toLocaleString("en-GB")}`;
}

const STEP: Record<string, string> = {
  in_plan: "is now in a council plan",
  budgeted: "now has money in the budget",
  delivering: "is now being delivered",
  delivered: "is now delivered",
  failed: "has failed",
};

/** Every fact for the week ending today. */
export function digestFacts(x: DigestInput): Fact[] {
  const from = addDays(x.today, -7);
  const inWeek = (d: string) => d > from && d <= x.today;
  const facts: Fact[] = [];
  const cards = new Map(x.content.promises.map((p) => [p.id, p]));
  // The pledge's words, without a closing full stop, as they sit inside a sentence of ours.
  const text = (id: string) => {
    const p = cards.get(id)!;
    return p.versions[p.versions.length - 1]!.text.replace(/[.!?]+$/, "");
  };
  const party = (id: string) => {
    const p = cards.get(id)!;
    return x.content.parties.find((pt) => pt.id === partyOf(x.content, p))?.short ?? "";
  };

  // Decisions that appeared this week: dated this week, or first seen this week from the last month.
  // (The first 45 were read in one backfill, so their assessment date says nothing about when they appeared.)
  const firstSeen = (id: string) => (x.assessed[id]?.by?.includes("backfill") ? "" : (x.assessed[id]?.on ?? ""));
  const seen = x.decisions.decisions.filter((d) => inWeek(d.date) || (inWeek(firstSeen(d.id)) && d.date > addDays(x.today, -31)));
  for (const d of seen) {
    const moves = x.content.decision_links.filter((l) => l.decision_id === d.id);
    facts.push({
      section: "this-week",
      text: `${d.body} on ${date(d.date)} decided: ${d.title}.${moves.map((l) => ` It moves ${party(l.promise_id)}'s pledge "${text(l.promise_id)}", which ${STEP[l.event] ?? l.event}.`).join("")}`,
      url: `${x.site}/decisions#${d.id}`,
    });
  }
  // Pledge changes recorded this week that came from elsewhere: replies, missed deadlines, new cards.
  for (const p of x.content.promises) {
    for (const r of p.replies.filter((r) => inWeek(r.date)))
      facts.push({ section: "this-week", text: `${r.from} replied about the pledge "${text(p.id)}".`, url: `${x.site}/promise/${p.id}` });
    for (const e of p.events.filter((e) => e.type === "deadline_missed" && inWeek(e.date)))
      facts.push({ section: "this-week", text: `The deadline for ${party(p.id)}'s pledge "${text(p.id)}" passed with no delivery recorded.`, url: `${x.site}/promise/${p.id}` });
  }
  // New cards: each by name when there are a few, one line when a whole manifesto arrived.
  const fresh = x.content.promises.filter((p) => inWeek(p.versions[0]!.recorded_on));
  if (fresh.length > 3) {
    const byParty = [...new Set(fresh.map((p) => party(p.id)))].map((pt) => `${fresh.filter((p) => party(p.id) === pt).length} ${pt}`);
    facts.push({ section: "this-week", text: `${fresh.length} new pledge cards: ${byParty.join(" and ")}.`, url: `${x.site}/promises` });
  } else
    for (const p of fresh) facts.push({ section: "this-week", text: `New pledge card: ${party(p.id)}, "${text(p.id)}".`, url: `${x.site}/promise/${p.id}` });
  if (x.newPayments)
    facts.push({
      section: "this-week",
      text: `New spending data from the council: ${x.newPayments.rows.toLocaleString("en-GB")} payments over £500 from ${month(x.newPayments.from)} to ${month(x.newPayments.to)}, ${money(x.newPayments.total)} in all.`,
      url: `${x.site}/payments`,
    });

  // Coming up in the next fortnight.
  for (const m of x.upcoming.filter((m) => m.date > x.today && m.date <= addDays(x.today, 14)))
    facts.push({
      section: "coming-up",
      text: `${m.body} meets on ${day(m.date)} at ${m.time}${m.items.length ? `. On the agenda: ${m.items.join("; ")}` : ""}.`,
      url: m.url,
    });
  // Deadlines of the administration's open pledges in the next 60 days.
  for (const p of x.content.promises.filter((p) => p.deadline && p.deadline > x.today && p.deadline <= addDays(x.today, 60) && sideOf(x.content, partyOf(x.content, p)) === "administration"))
    facts.push({ section: "deadlines", text: `${party(p.id)}'s pledge "${text(p.id)}" is due by ${date(p.deadline!)}.`, url: `${x.site}/promise/${p.id}` });

  // One number worth knowing, a different ward each week, only once its figures are checked.
  const wards = Object.entries(x.wardSpend.wards).filter(([, w]) => w.schemes.length).sort(([a], [b]) => a.localeCompare(b));
  if (wards.length && x.wardSpend.quality === "sourced") {
    const week = Math.floor(Date.parse(`${x.today}T12:00:00Z`) / (7 * 86400000));
    const [id, w] = wards[week % wards.length]!;
    const name = x.content.wards.wards.find((v) => v.id === id)?.name ?? id;
    const top = [...w.schemes].sort((a, b) => b.total - a.total)[0]!;
    facts.push({
      section: "number",
      text: `The council paid ${money(w.total)} for building work in ${name} ward between ${month(x.wardSpend.first)} and ${month(x.wardSpend.last)}. The biggest scheme: ${top.label}, ${money(top.total)}.`,
      url: `${x.site}/ward/${id}`,
    });
  }
  return facts;
}

/** Numbers as written, so "£31.4m", "1,519.51" and "12" compare like for like. */
const numbers = (s: string) => (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));

/** True when every number in the draft is one of the facts' numbers (or in their links): nothing made up. */
export function draftNumbersOk(draft: string, facts: Fact[], extra: string[] = []): { ok: boolean; stray: string[] } {
  const allowed = new Set([...facts.flatMap((f) => [...numbers(f.text), ...numbers(f.url)]), ...extra.flatMap(numbers)]);
  const stray = [...new Set(numbers(draft.replace(/\]\([^)]*\)/g, "]")))].filter((n) => !allowed.has(n));
  return { ok: stray.length === 0, stray };
}

/** The plain version, used when no writer is available or a draft fails the check. */
export function templateDraft(facts: Fact[], weekOf: string, site: string): string {
  const part = (section: Fact["section"], heading: string) => {
    const fs = facts.filter((f) => f.section === section);
    return fs.length ? `## ${heading}\n\n${fs.map((f) => `- ${f.text} [More](${f.url})`).join("\n")}\n\n` : "";
  };
  const body = part("this-week", "This week") + part("coming-up", "Coming up") + part("deadlines", "Deadlines") + part("number", "Number of the week");
  return `# This week in Hammersmith & Fulham, ${date(weekOf)}

${body || "A quiet week at the council.\n\n"}Find your ward and your councillors: ${site}/wards
Follow any pledge or ward by RSS: ${site}/follow
Spotted something? boroughs@guzh.uk
`;
}
