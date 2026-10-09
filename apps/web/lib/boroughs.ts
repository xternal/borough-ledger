/* Boroughs beyond Hammersmith & Fulham, for /<borough>. Read at build time only: every borough page is static. The
   bill and budget use the same model and checks as Hammersmith & Fulham's (statementModel). */
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BoroughConfig, BoroughPeople, BoroughStatement, DATA, RULES_SCOTLAND, WardMap, checkBoroughPeople, type Figure, type Rules } from "@borough-ledger/schema";
import { displayYear, nextFinancialYear } from "@borough-ledger/engine";
import { statementModel, type PageModel, type StatementModel } from "./model";

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
const read = (path: string) => JSON.parse(readFileSync(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ repo(), path), "utf8"));

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
  /** Null where the councillors come later (councillors_later in the config says why). */
  people: BoroughPeople | null;
  map: WardMap | null;
  sources: { title: string; url: string }[];
}

const cache = new Map<string, BoroughModel>();

export function boroughModel(slug: string): BoroughModel | null {
  const b = BOROUGHS.find((x) => x.slug === slug);
  if (!b) return null;
  const hit = cache.get(slug);
  if (hit) return hit;
  const dir = `data/build/boroughs/${slug}`;
  const statement = BoroughStatement.parse(read(`${dir}/statement.json`));
  const later = b.councillors_from === "later";
  const people = later ? null : BoroughPeople.parse(read(`${dir}/people.json`));
  const map = later ? null : WardMap.parse(read(`${dir}/wards_map.json`));
  const problems = people ? checkBoroughPeople(people) : [];
  if (problems.length) throw new Error(`${slug}: ${problems.join("; ")}`);
  const rules = b.nation === "scotland" ? RULES_SCOTLAND : DATA.rules;
  const S = statementModel(statement, rules);
  const year = statement.meta.year;
  const h = statement.history;
  const src = (ids: string[]) => ids;
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
    sources: [
      ...statement.meta.sources.filter((s): s is typeof s & { url: string } => !!s.url).map((s) => ({ title: s.title, url: s.url })),
      ...(people?.sources ?? []).map((s) => ({ title: s.title, url: s.url })),
      ...(map ? [{ title: map.source.title, url: map.source.page }] : []),
    ],
  };
  cache.set(slug, model);
  return model;
}
