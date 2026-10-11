/* The letter a resident drafts with "Make your case", built in their browser from what they chose and wrote. Nothing here
   is sent anywhere: the reader copies the letter, or hands it to their own email app or to WriteToThem (docs/PRIVACY.md). */

export interface LetterFact {
  id: string;
  /** What the reader ticks. */
  label: string;
  /** The sentence that goes in the letter. */
  text: string;
  /** Where it comes from, in words and a link, so a councillor can check it. */
  source: string;
  on: boolean;
}

export interface LetterInput {
  /** Full names, as the council lists them. */
  to: string[];
  ward: string | null;
  subject: string;
  want: string;
  own: string;
  facts: { text: string; source: string }[];
  closing: string;
  page: string;
}

/** Letters in the reader's own words: councillors give them more weight, and it keeps the tool from sending copies. */
export const MIN_OWN = 20;

export const listOf = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function draftLetter(x: LetterInput): { subject: string; body: string } {
  const greeting = x.to.length ? `Dear ${listOf(x.to.map((n) => `Councillor ${n}`))},` : "Dear Councillor,";
  const parts = [greeting, `${x.ward ? `I live in ${x.ward} ward. ` : ""}${x.want}`, x.own.trim()];
  if (x.facts.length) {
    const sources = [...new Set(x.facts.map((f) => f.source))];
    parts.push(["Some figures:", ...x.facts.map((f) => `- ${f.text}`)].join("\n"));
    parts.push(`${sources.length > 1 ? "They come from" : "From"} ${sources.join("; and ")}.`);
  }
  parts.push(`${x.closing} I would be grateful for your reply.`);
  parts.push(`The figures are gathered, each with its source, at ${x.page} (Borough Book, an independent site).`);
  parts.push("Yours sincerely,");
  return { subject: `${x.subject}: a resident's view`, body: parts.join("\n\n") };
}

/** Opens the reader's own email app with the letter. No address: we publish none; each councillor's council page has it. */
export const mailtoHref = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/** A Freedom of Information request on WhatDoTheyKnow, pre-filled with our suggested question only: nothing the reader typed. */
export const foiHref = (body: string, title: string, letter: string) =>
  `https://www.whatdotheyknow.com/new/${body}?${new URLSearchParams({ title, default_letter: letter }).toString()}`;

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const at = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
export const dayMonth = (iso: string) => DAY_MONTH.format(at(iso));
export const dayMonthYear = (iso: string) => DAY_MONTH_YEAR.format(at(iso));

export interface CaseDates {
  /** The council's own consultation on next year's budget. */
  engagement: { start: string; end: string | null } | null;
  /** When Full Council sets the budget. */
  decision: { date: string; proposed: boolean } | null;
  yearLabel: string;
}

/** The letter's last paragraph: what is open now and when it is decided, said as it stands on the day it is written. */
export function closingLine(d: CaseDates, today: string): string {
  const e = d.engagement;
  const open = e && today >= e.start.slice(0, 10) && (!e.end || today <= e.end.slice(0, 10));
  const soon = e && today < e.start.slice(0, 10);
  const consult = open
    ? `The council is asking residents for their views on the ${d.yearLabel} budget until ${dayMonth(e!.end ?? e!.start)}`
    : soon
      ? `The council asks residents for their views on the ${d.yearLabel} budget from ${dayMonth(e!.start)}${e!.end ? ` to ${dayMonth(e!.end)}` : ""}`
      : "";
  const decide = d.decision && today <= d.decision.date ? `Full Council sets the budget on ${dayMonthYear(d.decision.date)}${d.decision.proposed ? " (a proposed date)" : ""}` : "";
  if (consult && decide) return `${consult}, and ${decide}.`;
  if (consult || decide) return `${consult || decide}.`;
  return "I would like to know how the council will take residents' views into account.";
}

/** The last Sunday of a month (0-based), when the UK's clocks change in March and October. */
function lastSunday(year: number, month: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

/** 12 noon in London on a day, as an instant: 11:00 UTC in British Summer Time, 12:00 UTC otherwise. */
export function londonNoon(dayIso: string): Date {
  const d = at(dayIso);
  const y = d.getUTCFullYear();
  const bst = d >= lastSunday(y, 2) && d < lastSunday(y, 9);
  return new Date(`${dayIso.slice(0, 10)}T${bst ? "11" : "12"}:00:00Z`);
}

/** The next Full Council whose public questions are still open (they close at 12 noon), if any. */
export function nextQuestion<T extends { deadline: string }>(questions: readonly T[], now: Date): T | null {
  return questions.find((q) => londonNoon(q.deadline) > now) ?? null;
}
