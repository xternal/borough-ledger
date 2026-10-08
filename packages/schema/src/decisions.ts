/* Council decisions (etl/decisions.py → data/build/decisions.json) and the editor-confirmed links from decisions to pledges
   (content/decision_links.yaml). docs/PROMISE_STANDARD.md: a status moves only on evidence from council papers. */
import { z } from "zod";
import type { Content, PromiseCard } from "./content";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const Decision = z.object({
  /** mg-<agenda item id>: stable for ever. */
  id: z.string().regex(/^mg-\d+$/),
  date: isoDate,
  body: z.string(),
  meeting_id: z.number().int(),
  item: z.string(),
  /** A Cabinet decision, or a Full Council resolution taken from the minutes. */
  kind: z.enum(["decision", "resolution"]),
  title: z.string().min(1),
  /** The decision as the council published it, line breaks kept. */
  text: z.string().min(1),
  url: z.url(),
  meeting_url: z.url(),
  documents: z.array(z.object({ title: z.string(), url: z.url() })),
});
export type Decision = z.infer<typeof Decision>;

export const DecisionsFile = z.object({
  note: z.string(),
  publisher: z.string(),
  service: z.url(),
  from: isoDate,
  decisions: z.array(Decision),
  meetings: z.array(z.object({ meeting_id: z.number().int(), body: z.string(), date: isoDate, url: z.url(), sha256: z.string().regex(/^[0-9a-f]{64}$/) })),
});
export type DecisionsFile = z.infer<typeof DecisionsFile>;

/** The steps a council decision can show, lowest first. "failed" stands apart: it ends the ladder. */
export const LADDER = ["promised", "in_plan", "budgeted", "delivering", "delivered"] as const;
export const LINK_EVENTS = ["in_plan", "budgeted", "delivering", "delivered", "failed"] as const;
export type LinkEvent = (typeof LINK_EVENTS)[number];

export const DecisionLink = z.object({
  decision_id: z.string().regex(/^mg-\d+$/),
  promise_id: z.string(),
  event: z.enum(LINK_EVENTS),
  /** Copied word for word from the decision text. */
  quote: z.string().min(10).max(400),
  /** Who suggested it (a model, or Claude in a backfill); a person confirmed it by merging. */
  suggested_by: z.string(),
  suggested_on: isoDate,
});
export type DecisionLink = z.infer<typeof DecisionLink>;

/** Quotes compare with curly quotes, dashes and spacing evened out, so a faithful copy always matches. */
export function normaliseText(s: string): string {
  return s
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const quoteIn = (quote: string, text: string) => normaliseText(text).includes(normaliseText(quote));

/** The status a confirmed event leaves a card at: higher up the ladder only, never down; "failed" when the decision ends it. */
export function statusAfter(current: PromiseCard["status"], event: LinkEvent): PromiseCard["status"] {
  if (event === "failed") return "failed";
  const at = (LADDER as readonly string[]).indexOf(current);
  const to = (LADDER as readonly string[]).indexOf(event);
  return at >= 0 && to > at ? event : current;
}

/** Only pledges a council decision can move: the administration's, still open. One rule for every party (invariant 7). */
export const linkable = (p: PromiseCard, side: "administration" | "opposition") =>
  side === "administration" && (LADDER as readonly string[]).includes(p.status);

/** Every confirmed link names a real decision and pledge, quotes the decision exactly, and is on the card's timeline. */
export function checkDecisionLinks(content: Content, decisions: DecisionsFile): string[] {
  const problems: string[] = [];
  const byId = new Map(decisions.decisions.map((d) => [d.id, d]));
  const cards = new Map(content.promises.map((p) => [p.id, p]));
  const seen = new Set<string>();
  for (const l of content.decision_links) {
    const key = `${l.decision_id}:${l.promise_id}`;
    if (seen.has(key)) problems.push(`decision link ${key}: listed twice`);
    seen.add(key);
    const d = byId.get(l.decision_id);
    const p = cards.get(l.promise_id);
    if (!d) problems.push(`decision link ${key}: unknown decision`);
    if (!p) problems.push(`decision link ${key}: unknown promise`);
    if (!d || !p) continue;
    if (!quoteIn(l.quote, d.text)) problems.push(`decision link ${key}: the quote is not in the decision's text`);
    if (!p.events.some((e) => e.evidence_url === d.url && e.date === d.date)) problems.push(`decision link ${key}: no matching event on the card`);
  }
  return problems;
}
