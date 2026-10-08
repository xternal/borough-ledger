import { DATA, type Decision, type LinkEvent } from "@borough-ledger/schema";
import type { PageModel, PromiseModel } from "./model";

/** Cabinet and Full Council decisions (etl/decisions.py), bundled so pages and feeds work on request too. */
export const DECISIONS = DATA.decisions;

export const STEP_LABEL: Record<LinkEvent, string> = {
  in_plan: "In a council plan",
  budgeted: "In the budget",
  delivering: "Being delivered",
  delivered: "Delivered",
  failed: "Failed",
};

export interface DecisionView extends Decision {
  /** Pledges an editor confirmed this decision moves. */
  links: { promise: PromiseModel; event: LinkEvent; quote: string }[];
}

export interface MeetingView {
  key: string;
  date: string;
  body: string;
  url: string;
  decisions: DecisionView[];
}

/** Every decision with its confirmed links, newest meeting first, items in agenda order. */
export function meetingsOf(m: PageModel): MeetingView[] {
  const promises = new Map(m.promises.map((p) => [p.id, p]));
  const links = DATA.content.decision_links;
  const out = new Map<string, MeetingView>();
  for (const d of DECISIONS.decisions) {
    const key = `${d.date}-${d.meeting_id}`;
    const mtg = out.get(key) ?? { key, date: d.date, body: d.body, url: d.meeting_url, decisions: [] };
    mtg.decisions.push({
      ...d,
      links: links
        .filter((l) => l.decision_id === d.id && promises.has(l.promise_id))
        .map((l) => ({ promise: promises.get(l.promise_id)!, event: l.event, quote: l.quote })),
    });
    out.set(key, mtg);
  }
  const num = (item: string) => item.split(".").map((n) => n.padStart(3, "0")).join(".");
  return [...out.values()]
    .sort((a, z) => z.date.localeCompare(a.date))
    .map((mtg) => ({ ...mtg, decisions: mtg.decisions.sort((a, z) => num(a.item).localeCompare(num(z.item))) }));
}
