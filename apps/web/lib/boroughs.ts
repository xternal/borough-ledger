/* Boroughs beyond Hammersmith & Fulham, for /<borough>. Read at build time only: every borough page is static. The
   bill and budget use the same model and checks as Hammersmith & Fulham's (statementModel). */
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BoroughConfig, BoroughPeople, BoroughStatement, DATA, RULES_SCOTLAND, RULES_WALES, WardMap, checkBoroughPeople, derive, type Figure, type Rules } from "@borough-ledger/schema";
import { displayYear, nextFinancialYear } from "@borough-ledger/engine";
import { adultCare } from "./adultCare";
import { childrenCare } from "./childrenCare";
import { budgetModel, statementModel, type PageModel, type StatementModel } from "./model";

function repo(): string {
  let d = process.cwd();
  while (!existsSync(join(d, "pnpm-workspace.yaml"))) {
    const up = dirname(d);
    if (up === d) throw new Error("boroughs: repository root not found");
    d = up;
  }
  return d;
}

// Read only while building (every borough page and share image is static), so the files need not be traced into the
// server bundle.
export const read = (path: string) => JSON.parse(readFileSync(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ repo(), path), "utf8"));

export const BOROUGHS = BoroughConfig.parse(read("data/config/boroughs.json")).boroughs;
export type Borough = (typeof BOROUGHS)[number];

export interface BoroughModel extends StatementModel {
  b: Borough;
  place: PageModel["place"];
  vintage: string;
  /** The whole bill is null in a year where the rest of it is not published (Scottish Water's charges before 2025/26). */
  history: { year: string; label: string; council: Figure; area: Figure | null }[];
  /** The council tax rules of the council's nation: England's, or Scotland's (its own band ratios, Scottish Water's). */
  rules: Rules;
  /** Where the budget return and the council tax return differ on council tax (published by the owner's decision). */
  returnsDiffer: { budget: Figure; councilTax: Figure; apart: Figure } | null;
  /** Null where the councillors come later (councillors_later in the config says why). */
  people: BoroughPeople | null;
  map: WardMap | null;
  sources: { title: string; url: string }[];
  /** In a two-tier area (South Oxfordshire), the county council: its share of the bill and its own budget. */
  county: { council: string; short: string; ons: string; bandD: Figure; budget: ReturnType<typeof budgetModel> } | null;
  /** Towns with a town council of their own (Henley-on-Thames): the whole bill there, and who represents them. */
  towns: TownModel[];
  /** A planned change to the council itself (Oxfordshire's reorganisation), with its sources. */
  reorganisation: { note: string; quality: Figure["quality"]; sources: { title: string; url: string }[] } | null;
}

export interface TownModel {
  /** The section's id, also where /<town> redirects to (next.config.ts). */
  id: string;
  town: string;
  council: string;
  whole: Figure;
  townPart: Figure;
  /** Each body's Band D share there, largest first; they add up to the whole bill. */
  parts: { id: string; label: string; f: Figure }[];
  ward: { id: string; name: string; councillors: { name: string; party: string }[] } | null;
  divisions: { division: string; councillor: string; party: string }[];
  quality: Figure["quality"];
  methodNote: string;
}

export const townId = (town: string) => town.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const cache = new Map<string, BoroughModel>();

export function boroughModel(slug: string): BoroughModel | null {
  const b = BOROUGHS.find((x) => x.slug === slug);
  // Northern Ireland's councils have rates, not council tax: lib/rates.ts.
  if (!b || b.nation === "northern_ireland") return null;
  const hit = cache.get(slug);
  if (hit) return hit;
  const dir = `data/build/boroughs/${slug}`;
  const statement = BoroughStatement.parse(read(`${dir}/statement.json`));
  const later = b.councillors_from === "later";
  const people = later ? null : BoroughPeople.parse(read(`${dir}/people.json`));
  const map = later ? null : WardMap.parse(read(`${dir}/wards_map.json`));
  const problems = people ? checkBoroughPeople(people) : [];
  if (problems.length) throw new Error(`${slug}: ${problems.join("; ")}`);
  const rules = b.nation === "scotland" ? RULES_SCOTLAND : b.nation === "wales" ? RULES_WALES : DATA.rules;
  const S = statementModel(statement, rules);
  const year = statement.meta.year;
  const h = statement.history;
  const src = (ids: string[]) => ids;
  const titled = (ids: string[]) =>
    ids.map((id) => {
      const x = statement.meta.sources.find((m) => m.id === id);
      if (!x?.url) throw new Error(`${slug}: source ${id} has no link`);
      return { title: x.title, url: x.url };
    });
  // In a two-tier area the county runs social care, so its figures are the ones that apply (etl/adult_care.py).
  const careOns = b.county?.ons ?? b.ons;
  const C = statement.county;
  if (!!C !== !!b.county) throw new Error(`${slug}: the config and the statement disagree on a county council`);
  const countyPart = b.county ? S.bill.glaSplit.find((g) => g.id === b.county!.precept_id) : undefined;
  if (C && (!countyPart || Math.abs(countyPart.f.value - C.band_d) > 0.005)) throw new Error(`${slug}: the county's Band D is not the bill's county share`);
  const towns: TownModel[] = (statement.towns ?? []).map((t) => {
    const townPart: Figure = { value: t.band_d, quality: t.quality, sources: [t.source_id, ...t.source_ids] };
    const parts = [
      ...S.bill.glaSplit.map((g) => ({ id: g.id, label: g.label, f: g.f })),
      { id: "town", label: t.council, f: townPart },
      { id: "council", label: statement.meta.council, f: S.bill.council },
    ].sort((a, z) => z.f.value - a.f.value);
    const sum = parts.reduce((a, x) => a + x.f.value, 0);
    if (Math.abs(sum - t.whole_band_d) > 0.005) throw new Error(`${slug}: ${t.town}'s shares add up to £${sum.toFixed(2)}, its bill is £${t.whole_band_d}`);
    const w = people?.wards.find((x) => x.name === t.ward);
    if (people && !w) throw new Error(`${slug}: no ward called ${t.ward} for ${t.town}`);
    return {
      id: townId(t.town),
      town: t.town,
      council: t.council,
      whole: { value: t.whole_band_d, quality: t.quality, sources: [t.source_id] },
      townPart,
      parts,
      ward: w
        ? {
            id: w.id,
            name: w.name,
            councillors: w.councillor_ids.map((id) => {
              const c = people!.councillors.find((x) => x.id === id)!;
              return { name: c.name, party: c.party_name };
            }),
          }
        : null,
      divisions: t.divisions.map((d) => ({ division: d.division, councillor: d.councillor, party: d.party })),
      quality: t.quality,
      methodNote: t.method_note,
    };
  });
  const model: BoroughModel = {
    ...S,
    b,
    place: {
      council: statement.meta.council,
      short: statement.meta.council_short,
      yearLabel: displayYear(year),
      nextYearLabel: displayYear(nextFinancialYear(year)),
      yearAfterLabel: displayYear(nextFinancialYear(nextFinancialYear(year))),
    },
    vintage: statement.meta.vintage,
    history: h.council_tax.map((y) => ({
      year: y.year,
      label: displayYear(y.year),
      council: { value: y.band_d_council, quality: h.quality, sources: src(y.source_ids) },
      area: y.band_d_area === null ? null : { value: y.band_d_area, quality: h.quality, sources: src(y.source_ids) },
    })),
    people,
    map,
    rules,
    returnsDiffer: (() => {
      const d = statement.returns_differ;
      if (!d) return null;
      const budget: Figure = { value: Math.round(d.budget_return_m * 1e6), quality: d.quality, sources: ["ra_2026-27"] };
      const councilTax: Figure = { value: Math.round(d.council_tax_return_m * 1e6), quality: d.quality, sources: ["ctr_2026-27"] };
      return { budget, councilTax, apart: derive(Math.abs(budget.value - councilTax.value), budget, councilTax) };
    })(),
    sources: [
      ...statement.meta.sources.filter((s): s is typeof s & { url: string } => !!s.url).map((s) => ({ title: s.title, url: s.url })),
      ...(people?.sources ?? []).map((s) => ({ title: s.title, url: s.url })),
      ...(map ? [{ title: map.source.title, url: map.source.page }] : []),
      ...(adultCare(careOns) ? [adultCare(careOns)!.source] : []),
      ...(childrenCare(careOns)?.sources ?? []),
    ],
    county:
      C && b.county && countyPart
        ? { council: C.council, short: C.council_short, ons: b.county.ons, bandD: countyPart.f, budget: budgetModel({ funding: C.funding, services: C.services }, rules) }
        : null,
    towns,
    reorganisation: statement.reorganisation
      ? { note: statement.reorganisation.note, quality: statement.reorganisation.quality, sources: titled(statement.reorganisation.source_ids) }
      : null,
  };
  cache.set(slug, model);
  return model;
}
