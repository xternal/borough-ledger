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
