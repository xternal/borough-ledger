import { DATA, type Figure, type WardScheme, type WardShape } from "@borough-ledger/schema";
import type { CouncillorModel, PageModel, PromiseModel } from "./model";

/** The borough's wards: boundaries from the ONS, councillors from the council's own records. Bundled, so it works on request too. */
export const WARD_MAP = DATA.wardMap;

/**
 * Council building schemes by ward (etl/capital_wards.py). Amounts are the council's own; which ward a scheme is in is
 * ours, from its name, so every figure carries the table's quality: approx until the owner signs off every line.
 */
export const WARD_SPEND = DATA.wardSpend;
const wsFig = (value: number, files: readonly string[]): Figure => ({ value, quality: WARD_SPEND.quality, sources: [...files] });
/** Every spend file in the period the schemes cover, for borough-wide totals. */
const SPEND_FILES = [...new Set(DATA.payments.months.filter((m) => m.month >= WARD_SPEND.first && m.month <= WARD_SPEND.last).flatMap((m) => m.files))];
export const BOROUGH_SPEND = {
  total: wsFig(WARD_SPEND.total, SPEND_FILES),
  place: wsFig(WARD_SPEND.by_kind.place ?? 0, SPEND_FILES),
  several: wsFig(WARD_SPEND.by_kind.several ?? 0, SPEND_FILES),
  borough: wsFig(WARD_SPEND.by_kind.borough ?? 0, SPEND_FILES),
  unknown: wsFig(WARD_SPEND.by_kind.unknown ?? 0, SPEND_FILES),
};

export interface SchemeView {
  label: string;
  total: Figure;
  first: string;
  last: string;
  /** For a scheme across several wards: the other wards, by id. */
  others: string[];
}

const schemeView = (x: WardScheme, wardId: string): SchemeView => ({
  label: x.label,
  total: wsFig(x.total, x.files),
  first: x.first,
  last: x.last,
  others: (x.wards ?? []).filter((o) => o !== wardId),
});

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
  /** Building schemes placed in this ward alone, and those it shares with other wards. */
  spend: { total: Figure; schemes: SchemeView[]; shared: SchemeView[] };
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
        spend: (() => {
          const ws = WARD_SPEND.wards[w.id];
          const files = [...new Set((ws?.schemes ?? []).flatMap((x) => x.files))];
          return {
            total: wsFig(ws?.total ?? 0, files.length ? files : SPEND_FILES),
            schemes: (ws?.schemes ?? []).map((x) => schemeView(x, w.id)),
            shared: (ws?.shared ?? []).map((x) => schemeView(x, w.id)),
          };
        })(),
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
