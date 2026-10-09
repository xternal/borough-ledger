/* Northern Ireland's councils (Belfast), for /<borough>: domestic rates instead of council tax, the council's budget, the
   rates over five years and the councillors by district electoral area. Read at build time only: every page is static. */
import "server-only";
import { BoroughPeople, RULES_NI, RatesStatement, WardMap, checkBoroughPeople, checkRatesStatement, derive, fig, type Figure } from "@borough-ledger/schema";
import { displayYear, nextFinancialYear } from "@borough-ledger/engine";
import { BOROUGHS, read, type Borough } from "./boroughs";
import type { FlowLine, PageModel, QualityItem } from "./model";

export interface RatesModel {
  b: Borough;
  place: PageModel["place"];
  vintage: string;
  /** This year's poundages in £ per £1 of capital value, last year's, and the rise in the total. */
  rates: { district: Figure; regional: Figure; total: Figure; districtPrev: Figure; regionalPrev: Figure; risePct: Figure; districtRisePct: Figure; councilShare: Figure };
  cap: Figure;
  allowance: Figure;
  allowanceAge: number;
  instalments: Figure;
  valuationYear: string;
  example: { value: Figure; label: string };
  /** The bill on the example value, this year. */
  exampleBill: Figure;
  funding: FlowLine[];
  services: FlowLine[];
  netBudget: Figure;
  ratesShare: Figure;
  budgetLegend: QualityItem[];
  history: { year: string; label: string; district: Figure; regional: Figure; total: Figure; amount: Figure; bill: Figure }[];
  people: BoroughPeople;
  map: WardMap;
  sources: { title: string; url: string }[];
}

const cache = new Map<string, RatesModel>();
const of = (x: { quality: RatesStatement["rates"]["quality"]; source_id: string }, value: number) => fig(value, x.quality, x.source_id);

export function isRatesCouncil(slug: string): boolean {
  return BOROUGHS.find((x) => x.slug === slug)?.nation === "northern_ireland";
}

export function ratesModel(slug: string): RatesModel | null {
  const b = BOROUGHS.find((x) => x.slug === slug);
  if (!b || b.nation !== "northern_ireland") return null;
  const hit = cache.get(slug);
  if (hit) return hit;
  const dir = `data/build/boroughs/${slug}`;
  const S = RatesStatement.parse(read(`${dir}/statement.json`));
  const people = BoroughPeople.parse(read(`${dir}/people.json`));
  const map = WardMap.parse(read(`${dir}/wards_map.json`));
  const problems = [...checkRatesStatement(S, RULES_NI.balanced_budget.tolerance_m), ...checkBoroughPeople(people)];
  if (problems.length) throw new Error(`${slug}: ${problems.join("; ")}`);

  const R = RULES_NI;
  const r = S.rates;
  const district = of(r, r.district);
  const regional = of(r, r.regional);
  const total = derive(r.district + r.regional, district, regional);
  const districtPrev = of(r, r.district_prev);
  const regionalPrev = of(r, r.regional_prev);
  const totalPrev = derive(r.district_prev + r.regional_prev, districtPrev, regionalPrev);
  const example = of(S.example_value, S.example_value.value);
  const cap = of(R.capital_value_cap, R.capital_value_cap.value);

  const funding: FlowLine[] = S.funding.map((x) => ({ id: x.id, label: x.label, f: of(x, x.m), gap: !!x.gap, desc: x.desc }));
  const services: FlowLine[] = S.services.map((x) => ({ id: x.id, label: x.label, f: of(x, x.m), gap: false, desc: x.desc, general: of(x, x.general_fund_m) }));
  const [f0, ...fr] = funding.map((l) => l.f);
  const netBudget = derive(funding.reduce((a, l) => a + l.f.value, 0), f0!, ...fr);
  const rates = funding.filter((l) => S.funding.find((x) => x.id === l.id)?.kind === "rates");
  const ratesF = derive(rates.reduce((a, l) => a + l.f.value, 0), rates[0]!.f, ...rates.slice(1).map((l) => l.f));

  const model: RatesModel = {
    b,
    place: {
      council: S.meta.council,
      short: S.meta.council_short,
      yearLabel: displayYear(S.meta.year),
      nextYearLabel: displayYear(nextFinancialYear(S.meta.year)),
      yearAfterLabel: displayYear(nextFinancialYear(nextFinancialYear(S.meta.year))),
    },
    vintage: S.meta.vintage,
    rates: {
      district,
      regional,
      total,
      districtPrev,
      regionalPrev,
      risePct: derive((total.value / totalPrev.value - 1) * 100, total, totalPrev),
      districtRisePct: derive((r.district / r.district_prev - 1) * 100, district, districtPrev),
      councilShare: derive(r.district / (r.district + r.regional), district, total),
    },
    cap,
    allowance: of(R.lone_pensioner_allowance, R.lone_pensioner_allowance.value),
    allowanceAge: R.lone_pensioner_allowance.age,
    instalments: of(R.instalments, R.instalments.value),
    valuationYear: R.valuation_date.value.slice(0, 4),
    example: { value: example, label: S.example_value.label },
    // Our arithmetic on official inputs: the value times the two rates.
    exampleBill: { ...derive(Math.min(example.value, cap.value) * total.value, example, total, cap), quality: "modelled" },
    funding,
    services,
    netBudget,
    ratesShare: derive(ratesF.value / netBudget.value, ratesF, netBudget),
    budgetLegend: [...S.funding, ...S.services].map((x) => ({ label: x.label, quality: x.quality })),
    history: S.history.map((h) => {
      const q = (v: number) => ({ value: v, quality: h.quality, sources: h.source_ids });
      const t = q(h.district + h.regional);
      return {
        year: h.year,
        label: displayYear(h.year),
        district: q(h.district),
        regional: q(h.regional),
        total: t,
        amount: q(Math.round(h.amount_raised_m * 1e6)),
        bill: { ...derive(Math.min(example.value, cap.value) * t.value, t, example, cap), quality: "modelled" as const },
      };
    }),
    people,
    map,
    sources: [
      ...S.meta.sources.filter((s): s is typeof s & { url: string } => !!s.url).map((s) => ({ title: s.title, url: s.url })),
      ...R.meta.sources.filter((s): s is typeof s & { url: string } => !!s.url).map((s) => ({ title: s.title, url: s.url })),
      ...people.sources.map((s) => ({ title: s.title, url: s.url })),
      { title: map.source.title, url: map.source.page },
    ],
  };
  cache.set(slug, model);
  return model;
}
