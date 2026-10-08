/* A pledge in plain words, for readers who skim, search engines and AI search: one summary, a few questions and
   answers, and a Markdown version. All from the card's data, the same way for every party (CLAUDE.md invariant 7). */
import { DATA, type Figure } from "@borough-ledger/schema";
import { format, formatDay, formatMonthYear } from "./format";
import type { PageModel, PromiseModel } from "./model";
import { STATUS_LABEL, STATUS_MEANS } from "./promises";
import { assertRenderable } from "./quality";
import { CONTACT, SITE, SITE_URL } from "./site";

const VENUE: Record<string, string> = {
  manifesto: "manifesto",
  leaflet: "leaflet",
  hustings: "hustings",
  council_meeting: "council meeting",
  press: "press statement",
  social: "social media post",
};

/** A figure in words, saying when it is an estimate. Test values never reach text, as they never reach a page. */
function money(f: Figure, fmt: "m1" | "gbp0"): string {
  assertRenderable(f.quality, `promise text ${f.sources.join(", ")}`);
  return `${format(fmt, f.value)}${f.quality === "sourced" ? "" : " (estimate)"}`;
}

/** Ends with a full stop, unless it already ends a sentence (also inside closing quotes). */
const sentence = (s: string) => {
  const t = s.trim();
  return /[.!?]["\u201d\u2019)]*$/.test(t) ? t : `${t.replace(/[.\s]*$/, "")}.`;
};

/** When the card last changed: a new wording, event, reply or confirmed decision link. */
export function dateModified(p: PromiseModel): string {
  const links = DATA.content.decision_links.filter((l) => l.promise_id === p.id).map((l) => l.suggested_on);
  return [...p.versions.map((v) => v.recorded_on), ...p.timeline.map((e) => e.date), ...p.replies.map((r) => r.date), ...links].sort().at(-1)!;
}

/** The newest dated step after the pledge itself, if any. */
function latestEvidence(p: PromiseModel) {
  return [...p.timeline].filter((e) => e.type !== "promised").sort((a, z) => a.date.localeCompare(z.date)).at(-1) ?? null;
}

export function costText(p: PromiseModel): string {
  if (p.cost)
    return `About ${money(p.cost.central, "m1")} a year (range ${money(p.cost.low, "m1")} to ${money(p.cost.high, "m1")}), or ${money(p.cost.perBandD, "gbp0")} a year for a Band D home.`;
  if (p.capital) return `About ${money(p.capital.central, "m1")} to build, once, or ${money(p.capital.perBandD, "gbp0")} for a Band D home.`;
  return "No cost is stated, and none can be sourced yet.";
}

function sideText(p: PromiseModel, m: PageModel): string {
  return p.side === "administration"
    ? `${p.partyShort} runs ${m.place.short} Council, so the pledge is tracked against council decisions and budgets.`
    : `${p.partyShort} does not run ${m.place.short} Council, so the pledge is tracked as an opposition pledge: costed so voters can compare, but it cannot be delivered from opposition.`;
}

/** One paragraph that answers who promised what, when, where it stands and what it costs. */
export function promiseSummary(p: PromiseModel, m: PageModel): string {
  const where = `${VENUE[p.venue] ?? p.venue} of ${formatMonthYear(p.made_on)}${p.page ? ` (page ${p.page})` : ""}`;
  const ev = latestEvidence(p);
  return [
    `${p.actor} pledged in its ${where}: “${p.text}”`,
    `Status on ${SITE.name}: ${STATUS_LABEL[p.status]}. ${STATUS_MEANS[p.status]}`,
    ev ? `Latest step, ${formatDay(ev.date)}: ${sentence(ev.event)}` : "",
    sideText(p, m),
    costText(p),
    p.deadline ? `Deadline: ${formatDay(p.deadline)}.` : "No deadline is stated.",
  ]
    .filter(Boolean)
    .map(sentence)
    .join(" ");
}

export interface QA {
  q: string;
  a: string;
}

const KEPT: Partial<Record<PromiseModel["status"], string>> = {
  delivered: "Yes. It is marked delivered, as worded.",
  delivering: "It is being delivered: the council's own records show the work under way, but it is not finished.",
  budgeted: "Not yet. Money is set aside for it in the council's budget, but delivery has not been shown.",
  in_plan: "Not yet. A council decision or adopted strategy commits to it, but money and delivery have not been shown.",
  promised: "Not yet shown. Nothing in the council's papers commits to it so far.",
  failed: "No. It is marked failed: the deadline passed with evidence it was not done, or it was abandoned.",
  quietly_dropped: "No. The deadline passed with no statement and no sign of delivery.",
  unscoreable: "It cannot be judged: the pledge names no who, how much, when or from where.",
};

/** Questions people ask about a pledge, answered from the card. */
export function promiseQA(p: PromiseModel, m: PageModel): QA[] {
  const steps = p.timeline.filter((e) => e.type !== "promised").sort((a, z) => a.date.localeCompare(z.date));
  return [
    {
      q: `Has ${p.partyShort} kept its pledge: “${p.text}”?`,
      a: p.side === "opposition" ? sideText(p, m) : `${KEPT[p.status] ?? STATUS_MEANS[p.status]} Status: ${STATUS_LABEL[p.status]}.`,
    },
    {
      q: "What has the council done about it?",
      a: steps.length
        ? steps.map((e) => `${formatDay(e.date)}: ${sentence(e.event)}`).join(" ")
        : `Nothing in the council's papers is linked to it yet. ${SITE.name} checks every Cabinet and Full Council decision and adds any that move it.`,
    },
    { q: "What would it cost?", a: costText(p) },
    {
      q: "Where does this pledge come from?",
      a: `${p.actor}'s ${VENUE[p.venue] ?? p.venue} of ${formatDay(p.made_on)}${p.page ? `, page ${p.page}` : ""}, quoted word for word. Sources: ${p.sources.map((s) => s.title).join("; ")}.`,
    },
    {
      q: "Can the party reply?",
      a: `Yes. Any councillor or party named on a card can reply by emailing ${CONTACT}, and replies are published on the card within five working days.`,
    },
  ];
}

/** The card as Markdown, for AI tools and anyone who wants the text alone. */
export function promiseMarkdown(p: PromiseModel, m: PageModel): string {
  const url = `${SITE_URL}/promise/${p.id}`;
  const timeline = [...p.timeline]
    .sort((a, z) => a.date.localeCompare(z.date))
    .map((e) => `- ${e.date}: ${e.event}${e.evidence_url ? ` ([source](${e.evidence_url}))` : ""}`)
    .join("\n");
  return `# ${p.partyShort} pledge: “${p.text}”

${promiseSummary(p, m)}

- Who: ${p.actor}${p.party ? ` (${p.party})` : ""}
- Made: ${p.made_on}, ${VENUE[p.venue] ?? p.venue}${p.page ? `, page ${p.page}` : ""}
- Area: ${p.area}
- Status: ${STATUS_LABEL[p.status]} (${STATUS_MEANS[p.status]})
- Cost: ${costText(p)}
- Deadline: ${p.deadline ?? "none stated"}
- Last changed: ${dateModified(p)}
- Page: ${url}

## Timeline

${timeline || "- No dated events yet."}

## Questions

${promiseQA(p, m)
  .map((x) => `**${x.q}**\n${x.a}`)
  .join("\n\n")}

## Sources

${p.sources.map((s) => `- [${s.title}](${s.url})`).join("\n")}

## Replies

${p.replies.length ? p.replies.map((r) => `- ${r.from}, ${r.date}: ${r.text}`).join("\n") : `None yet. Replies: ${CONTACT}.`}

---
${SITE.name} is independent and not run by ${m.place.short} Council. Text CC BY 4.0, credit "${SITE.name} (Pavel Guzhikov)".
`;
}
