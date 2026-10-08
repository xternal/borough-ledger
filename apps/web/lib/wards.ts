import { DATA, type WardShape } from "@borough-ledger/schema";
import type { CouncillorModel, PageModel, PromiseModel } from "./model";

/** The borough's wards: boundaries from the ONS, councillors from the council's own records. Bundled, so it works on request too. */
export const WARD_MAP = DATA.wardMap;

/**
 * FixMyStreet (run by mySociety, not the council) has a page of street reports for every ward. We only link to it:
 * nothing is fetched or copied. Its area names are the ONS ones, so the link uses the ONS ward name.
 * TODO(config): the area name moves to the council's config with M8 (second borough).
 */
const FIXMYSTREET_AREA = "Hammersmith and Fulham";
const plus = (s: string) => encodeURIComponent(s).replace(/%20/g, "+").replace(/'/g, "%27");
export const fixMyStreetUrl = (onsName: string) => `https://www.fixmystreet.com/reports/${plus(FIXMYSTREET_AREA)}/${plus(onsName)}`;

export interface WardModel {
  id: string;
  name: string;
  ons_code: string;
  shape: WardShape;
  councillors: CouncillorModel[];
  /** Ward ids, by name. */
  neighbours: string[];
  /** Pledges about this ward alone. */
  promises: PromiseModel[];
  fixMyStreet: string;
}

/** Every ward, by name. */
export function wardsOf(m: PageModel): WardModel[] {
  const shapes = new Map(WARD_MAP.wards.map((s) => [s.ons_code, s]));
  const idByCode = new Map(m.people.wards.map((w) => [w.ons_code, w.id]));
  const nameById = new Map(m.people.wards.map((w) => [w.id, w.name]));
  const byId = new Map(m.people.councillors.map((c) => [c.id, c]));
  return m.people.wards
    .map((w) => {
      const shape = shapes.get(w.ons_code)!;
      return {
        id: w.id,
        name: w.name,
        ons_code: w.ons_code,
        shape,
        councillors: w.councillor_ids.map((id) => byId.get(id)!),
        neighbours: shape.neighbours
          .map((c) => idByCode.get(c)!)
          .sort((a, z) => nameById.get(a)!.localeCompare(nameById.get(z)!)),
        promises: m.promises.filter((p) => p.wardId === w.id),
        fixMyStreet: fixMyStreetUrl(shape.ons_name),
      };
    })
    .sort((a, z) => a.name.localeCompare(z.name));
}

/** What the postcode finder needs in the browser: ward ids by ONS code, and the council's code. */
export function finderData(m: PageModel) {
  return { councilCode: WARD_MAP.council_code, wards: m.people.wards.map((w) => ({ id: w.id, name: w.name, ons_code: w.ons_code })) };
}

export const NUMBER = ["no", "one", "two", "three", "four", "five"];

/** "all Labour", or "two Labour and one Conservative": counted from the data the same way for every party. */
export function partyMix(parties: string[]): string {
  const counts = new Map<string, number>();
  for (const p of parties) counts.set(p, (counts.get(p) ?? 0) + 1);
  const parts = [...counts].map(([p, n]) => `${NUMBER[n] ?? n} ${p}`);
  if (counts.size === 1) return `${parties.length === 2 ? "both" : "all"} ${parties[0]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
