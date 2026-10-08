/* Topic and party pages: pledges grouped the way people search ("Labour Hammersmith manifesto", "Hammersmith parks").
   Everything is grouped from the data, the same way for every party (CLAUDE.md invariant 7). */
import { DATA, type Decision } from "@borough-ledger/schema";
import type { FlowLine, PageModel, PromiseModel } from "./model";
import { dateModified } from "./promiseText";

/** "Parks, libraries and leisure" -> "parks-libraries-and-leisure". Client-safe: the card links to its topic. */
export const topicSlug = (area: string) =>
  area
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * A topic's line in the council's budget, where one clearly matches: the same name, or one named here. Topics with
 * no honest match (a hospital pledge is about the NHS, not the council's public health budget) show no spending.
 */
const SERVICE_FOR_TOPIC: Record<string, string> = {
  "Community safety": "safety_regulation",
};

export interface TopicView {
  slug: string;
  area: string;
  promises: PromiseModel[];
  service: FlowLine | null;
  decisions: { decision: Decision; promise: PromiseModel }[];
  changed: string;
}

const linkedDecisions = (ps: PromiseModel[]) => {
  const ids = new Set(ps.map((p) => p.id));
  const byId = new Map(DATA.decisions.decisions.map((d) => [d.id, d]));
  const promises = new Map(ps.map((p) => [p.id, p]));
  return DATA.content.decision_links
    .filter((l) => ids.has(l.promise_id) && byId.has(l.decision_id))
    .map((l) => ({ decision: byId.get(l.decision_id)!, promise: promises.get(l.promise_id)! }))
    .sort((a, z) => z.decision.date.localeCompare(a.decision.date));
};

const newest = (ps: PromiseModel[]) => ps.map(dateModified).sort().at(-1) ?? "";

/** Administration first, then by id: the same order everywhere, never a party chosen by name. */
const order = (ps: PromiseModel[]) => [...ps].sort((a, z) => (a.side === z.side ? a.id.localeCompare(z.id) : a.side === "administration" ? -1 : 1));

export function topicsOf(m: PageModel): TopicView[] {
  const areas = [...new Set(m.promises.map((p) => p.area))].sort((a, z) => a.localeCompare(z));
  return areas.map((area) => {
    const promises = order(m.promises.filter((p) => p.area === area));
    const serviceId = SERVICE_FOR_TOPIC[area];
    const service = m.services.find((s) => (serviceId ? s.id === serviceId : s.label === area)) ?? null;
    return { slug: topicSlug(area), area, promises, service, decisions: linkedDecisions(promises), changed: newest(promises) };
  });
}

export interface PartyView {
  id: string;
  name: string;
  short: string;
  side: PromiseModel["side"];
  seats: number;
  manifesto: { title: string; url: string; date: string | null };
  promises: PromiseModel[];
  councillors: PageModel["people"]["councillors"];
  decisions: { decision: Decision; promise: PromiseModel }[];
  changed: string;
}

/** Parties with pledges on the site. */
export function partiesOf(m: PageModel): PartyView[] {
  return DATA.content.parties
    .map((pt) => {
      const promises = order(m.promises.filter((p) => p.partyId === pt.id));
      const councillors = m.people.councillors.filter((c) => c.partyId === pt.id).sort((a, z) => a.ward.localeCompare(z.ward) || a.name.localeCompare(z.name));
      const side = councillors[0]?.side ?? promises[0]?.side ?? "opposition";
      return {
        id: pt.id,
        name: pt.name,
        short: pt.short,
        side,
        seats: councillors.length,
        manifesto: { title: pt.manifesto.title, url: pt.manifesto.archive_url ?? pt.manifesto.url, date: pt.manifesto.published_on ?? null },
        promises,
        councillors,
        decisions: linkedDecisions(promises),
        changed: newest(promises),
      };
    })
    .filter((x) => x.promises.length > 0);
}
