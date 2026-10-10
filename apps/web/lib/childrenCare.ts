/* What care for children costs in one council (data/build/children_care.json): bundled, so any page can use it. */
import { ChildrenCareFile, fig, type Figure } from "@borough-ledger/schema";
import { displayYear } from "@borough-ledger/engine";
import raw from "../../../data/build/children_care.json";

const FILE = ChildrenCareFile.parse(raw);
type Spend = NonNullable<ChildrenCareFile["councils"][string]["spend_m"]>;
type Placements = ChildrenCareFile["councils"][string]["placements"];

export interface ChildrenCareModel {
  yearLabel: string;
  countDate: string;
  name: string;
  /** Null where the Department for Education withheld the council's spending over its quality (Wandsworth, 2024/25). */
  total: Figure | null;
  childrensServices: Figure | null;
  parts: { id: string; label: string; f: Figure }[];
  children: Figure;
  /** Where the children were living, largest first; withheld counts left out. */
  placements: { id: string; label: string; f: Figure }[];
  someWithheld: boolean;
  /** England, for context: a year in a children's home, the National Audit Office's way (our own sum). */
  englandHomeYear: Figure;
  englandMethod: string;
  sources: { title: string; url: string }[];
}

const PARTS: [Exclude<keyof Spend, "total" | "childrens_services">, string][] = [
  ["residential", "Children's homes and other residential care"],
  ["fostering", "Foster care"],
  ["family_friends", "Living with family or friends (kinship care)"],
  ["special_guardianship", "Support for special guardians"],
  ["adoption", "Adoption"],
  ["leaving_care", "Young people leaving care"],
  ["other", "Other care, such as supported accommodation"],
  ["education", "Education of children in care"],
  ["short_breaks", "Short breaks for disabled children in care"],
  ["asylum", "Children seeking asylum on their own"],
];

const PLACES: [keyof Placements, string][] = [
  ["foster", "with foster carers"],
  ["childrens_homes", "in children's homes"],
  ["supported_accommodation", "in supported accommodation"],
  ["with_parents", "living with their parents again"],
  ["adoption", "placed for adoption"],
  ["residential_schools", "in residential schools"],
  ["other_residential", "in other residential settings"],
  ["other", "in other places"],
];

export function childrenCare(ons: string): ChildrenCareModel | null {
  const c = FILE.councils[ons];
  if (!c) return null;
  const spendF = (v: number) => fig(v, FILE.quality, FILE.source_ids[0]!);
  const countF = (v: number) => fig(v, FILE.quality, FILE.source_ids[1]!);
  const s = c.spend_m;
  return {
    yearLabel: displayYear(FILE.year),
    countDate: FILE.count_date,
    name: c.name,
    total: s ? spendF(s.total) : null,
    childrensServices: s ? spendF(s.childrens_services) : null,
    parts: s
      ? PARTS.map(([id, label]) => ({ id, label, f: spendF(s[id]) }))
          .filter((p) => p.f.value > 0)
          .sort((a, z) => z.f.value - a.f.value)
      : [],
    children: countF(c.children),
    placements: PLACES.map(([id, label]) => ({ id, label, v: c.placements[id] }))
      .filter((p): p is { id: keyof Placements; label: string; v: number } => p.v !== null && p.v > 0)
      .map((p) => ({ id: p.id, label: p.label, f: countF(p.v) }))
      .sort((a, z) => z.f.value - a.f.value),
    someWithheld: Object.values(c.placements).some((v) => v === null),
    // Rounded to the nearest £1,000: an average across councils that record this spending differently.
    englandHomeYear: fig(Math.round(FILE.england.home_year / 1000) * 1000, FILE.england.home_year_quality, ...FILE.source_ids),
    englandMethod: FILE.england.home_year_method,
    sources: FILE.sources.filter((x) => x.url).map((x) => ({ title: x.title, url: x.url! })),
  };
}
