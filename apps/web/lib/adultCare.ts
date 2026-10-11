/* What care for adults costs in one council (data/build/adult_care.json): bundled, so any page can use it. */
import { AdultCareFile, fig, type Figure } from "@borough-ledger/schema";
import { displayYear } from "@borough-ledger/engine";
import raw from "../../../data/build/adult_care.json";

const FILE = AdultCareFile.parse(raw);

export interface AdultCareModel {
  yearLabel: string;
  prevLabel: string;
  name: string;
  total: Figure;
  /** Where the money went, largest first, £m. */
  parts: { id: string; label: string; f: Figure }[];
  /** The government's average costs; null where the council has none (no such service). */
  units: { id: string; label: string; f: Figure; prev: Figure | null; per: "week" | "hour" }[];
  homeCareFrom: "agencies" | "the council";
  source: { title: string; url: string };
}

const PARTS: [keyof AdultCareFile["councils"][string]["settings_k"] | "short_term" | "other", string][] = [
  ["care_homes", "Care homes and nursing homes"],
  ["home_care", "Care at home"],
  ["supported_living", "Supported living"],
  ["direct_payments", "Money people arrange their own care with (direct payments)"],
  ["supported_accommodation", "Supported accommodation"],
  ["other_long_term", "Other long-term care"],
  ["short_term", "Short-term care to help people recover"],
  ["other", "Assessments, social workers and other care"],
];

export function adultCare(ons: string): AdultCareModel | null {
  const c = FILE.councils[ons];
  if (!c) return null;
  const f = (v: number) => fig(v, FILE.quality, FILE.source_id);
  const parts = PARTS.map(([id, label]) => ({
    id,
    label,
    f: f((id === "short_term" || id === "other" ? c.spend_k[id] : c.settings_k[id]) / 1000),
  }))
    .filter((p) => p.f.value > 0)
    .sort((a, z) => z.f.value - a.f.value);
  const units = (
    [
      ["residential_65", "A week in a care home, aged 65 or over", "week"],
      ["nursing_65", "A week in a nursing home, aged 65 or over", "week"],
      ["residential_18_64", "A week in a care home, aged 18 to 64", "week"],
      ["home_care_hour", c.home_care_from === "agencies" ? "An hour of care at home, from an agency" : "An hour of care at home", "hour"],
    ] as const
  )
    .filter(([id]) => c.unit[id] !== null)
    .map(([id, label, per]) => ({ id, label, per, f: f(c.unit[id]!), prev: c.unit_prev[id] !== null ? f(c.unit_prev[id]!) : null }));
  return {
    yearLabel: displayYear(FILE.year),
    prevLabel: displayYear(FILE.prev_year),
    name: c.name,
    total: f(c.spend_k.total / 1000),
    parts,
    units,
    homeCareFrom: c.home_care_from,
    source: { title: FILE.source.title, url: FILE.source.url! },
  };
}

export interface UnitComparison {
  id: "residential_65" | "home_care_hour";
  label: string;
  per: "week" | "hour";
  f: Figure;
  /** 1 is the lowest cost among `of` councils. */
  rank: number;
  of: number;
  median: Figure;
  low: { name: string; f: Figure };
  high: { name: string; f: Figure };
}

export interface CareComparison {
  /** London boroughs for a London borough; otherwise every English council on the site. */
  group: string;
  units: UnitComparison[];
  byAge: { workingAge: Figure; older: Figure };
  /** Across every English council on the site: how many spend more on working-age adults than on older people. */
  moreForWorkingAge: { count: number; of: number };
}

/** How one council's costs compare with similar councils', from the same report. Cheapest is not the same as best: the
    page says so, and shows no ranking of results until it has them. */
export function careComparison(ons: string): CareComparison | null {
  const c = FILE.councils[ons];
  if (!c) return null;
  const f = (v: number) => fig(v, FILE.quality, FILE.source_id);
  const london = ons.startsWith("E09");
  const peers = Object.entries(FILE.councils).filter(([k]) => !london || k.startsWith("E09"));
  const units = (
    [
      ["residential_65", "A week in a care home, aged 65 or over", "week"],
      ["home_care_hour", "An hour of care at home", "hour"],
    ] as const
  ).flatMap(([id, label, per]) => {
    const vals = peers
      .map(([k, v]) => ({ k, name: v.name, v: v.unit[id] }))
      .filter((x): x is { k: string; name: string; v: number } => x.v !== null)
      .sort((a, z) => a.v - z.v);
    const rank = vals.findIndex((x) => x.k === ons) + 1;
    if (!rank || c.unit[id] === null) return [];
    const mid = vals.length % 2 ? vals[(vals.length - 1) / 2]!.v : (vals[vals.length / 2 - 1]!.v + vals[vals.length / 2]!.v) / 2;
    return [
      {
        id,
        label,
        per,
        f: f(c.unit[id]!),
        rank,
        of: vals.length,
        median: f(Math.round(mid * 100) / 100),
        low: { name: vals[0]!.name, f: f(vals[0]!.v) },
        high: { name: vals[vals.length - 1]!.name, f: f(vals[vals.length - 1]!.v) },
      },
    ];
  });
  const all = Object.values(FILE.councils);
  return {
    group: london ? "London boroughs" : "English councils",
    units,
    byAge: { workingAge: f(c.long_term_by_age_k.working_age / 1000), older: f(c.long_term_by_age_k.older / 1000) },
    moreForWorkingAge: { count: all.filter((x) => x.long_term_by_age_k.working_age > x.long_term_by_age_k.older).length, of: all.length },
  };
}
