/* The council tax decoder: every English billing authority's Band D bill, split between the council and the bodies that
   add their share to it (data/build/council_tax_decoder.json, from the government's Table 10). Bundled, so pages built
   on request can use it too. */
import { DecoderFile, derive, fig, type DecoderParts, type Figure } from "@borough-ledger/schema";
import { displayYear } from "@borough-ledger/engine";
import raw from "../../../data/build/council_tax_decoder.json";
import places from "../../../data/config/boroughs.json";

const FILE = DecoderFile.parse(raw);
type Row = DecoderFile["councils"][number];
export type PartId = keyof DecoderParts;

export const DECODER = {
  yearLabel: displayYear(FILE.year),
  prevLabel: displayYear(FILE.prev_year),
  sources: FILE.sources.map((s) => ({ title: s.title, url: s.url! })),
  methodNote: FILE.method_note,
  count: FILE.councils.length,
};

const f = (v: number): Figure => fig(v, FILE.quality, FILE.source_id);
const prevF = (v: number): Figure => fig(v, FILE.quality, FILE.sources[1]!.id);

/** The order a bill is read in: the council first, then the bodies that add to it, then parish and town councils. */
const ORDER: PartId[] = ["council", "county", "police", "fire", "combined", "parish"];

export interface DecodedPart {
  id: PartId;
  /** Who gets it, by name. */
  body: string;
  /** What it is, in a few words. */
  what: string;
  f: Figure;
  prev: Figure;
  change: Figure;
  share: Figure;
}

export interface DecodedCouncil {
  ons: string;
  name: string;
  /** The body that sets the council's own share, mid-sentence ("Wigan Council", "the City of London Corporation"). */
  councilName: string;
  /** The place mid-sentence: "Wigan", "the City of London". */
  place: string;
  slug: string;
  region: string;
  kind: Row["kind"];
  total: Figure;
  prevTotal: Figure;
  change: Figure;
  changePct: Figure;
  parts: DecodedPart[];
  /** How much of the change came from the council's own share, from the bodies that add to it, and from parishes. */
  ownChange: Figure;
  preceptChange: Figure;
  parishChange: Figure;
  /** The fuller page on BoroughBook.UK, where there is one. */
  sitePage: string | null;
}

const WHAT: Record<PartId, string> = {
  council: "the council's own share",
  county: "county council or Mayor of London",
  police: "policing",
  fire: "fire and rescue",
  combined: "combined authority",
  parish: "parish and town councils, on average",
};

const SITE_PAGE = new Map<string, string>([["E09000013", "/"], ...places.boroughs.filter((b) => b.ons.startsWith("E0")).map((b) => [b.ons, `/${b.slug}`] as [string, string])]);

/** "The City of London Corporation" at the start of a sentence; "City of London Corporation" as a label. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const label = (s: string) => cap(s.replace(/^the /, ""));

function decode(r: Row): DecodedCouncil {
  const total = f(r.total);
  const prevTotal = prevF(r.prev_total);
  const change = derive(r.total - r.prev_total, total, prevTotal);
  const parts = ORDER.filter((id) => r.parts[id] > 0 || r.prev_parts[id] > 0).map((id) => {
    const now = f(r.parts[id]);
    const prev = prevF(r.prev_parts[id]);
    const body =
      id === "council" ? label(r.council_name) : id === "parish" ? "Parish and town councils" : (r.preceptors[id as Exclude<PartId, "council" | "parish">] ?? WHAT[id]);
    return { id, body, what: WHAT[id], f: now, prev, change: derive(r.parts[id] - r.prev_parts[id], now, prev), share: derive(r.parts[id] / r.total, now, total) };
  });
  const sum = (ids: PartId[]) => derive(ids.reduce((a, id) => a + r.parts[id] - r.prev_parts[id], 0), total, prevTotal);
  return {
    ons: r.ons,
    name: r.name,
    councilName: r.council_name,
    place: r.place,
    slug: r.slug,
    region: r.region,
    kind: r.kind,
    total,
    prevTotal,
    change,
    changePct: derive(((r.total - r.prev_total) / r.prev_total) * 100, total, prevTotal),
    parts,
    ownChange: sum(["council"]),
    preceptChange: sum(["county", "police", "fire", "combined"]),
    parishChange: sum(["parish"]),
    sitePage: SITE_PAGE.get(r.ons) ?? null,
  };
}

const ALL = FILE.councils.map(decode);
const BY_SLUG = new Map(ALL.map((c) => [c.slug, c]));

export const decodedCouncils = (): DecodedCouncil[] => ALL;
export const decodedCouncil = (slug: string): DecodedCouncil | null => BY_SLUG.get(slug) ?? null;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, z) => a - z);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

export interface DecoderFindings {
  medianOwnPct: Figure;
  medianChange: Figure;
  /** Where the council's own share rose most, by per cent. */
  topOwn: { c: DecodedCouncil; pct: Figure }[];
  /** Where the council froze or cut its own share, yet the bill still rose. */
  frozen: DecodedCouncil[];
  /** Single-tier councils (no county council) where the bodies that add to the bill made up most of the rise. */
  preceptLed: { c: DecodedCouncil; share: Figure }[];
}

/** What the decoder shows across England: where councils' own shares rose most, and where the rest of the bill drove it. */
export function decoderFindings(): DecoderFindings {
  const ownPct = (c: DecodedCouncil) => {
    const p = c.parts.find((x) => x.id === "council")!;
    return derive((p.change.value / p.prev.value) * 100, p.f, p.prev);
  };
  const withPct = ALL.map((c) => ({ c, pct: ownPct(c) }));
  const singleTier = ALL.filter((c) => c.kind !== "district council" && c.change.value > 0);
  return {
    medianOwnPct: derive(median(withPct.map((x) => x.pct.value)), ALL[0]!.total, ALL[0]!.prevTotal),
    medianChange: derive(median(ALL.map((c) => c.change.value)), ALL[0]!.total, ALL[0]!.prevTotal),
    topOwn: [...withPct].sort((a, z) => z.pct.value - a.pct.value || z.c.ownChange.value - a.c.ownChange.value).slice(0, 10),
    frozen: ALL.filter((c) => c.ownChange.value <= 0 && c.change.value > 0).sort((a, z) => z.change.value - a.change.value),
    preceptLed: singleTier
      .map((c) => ({ c, share: derive(c.preceptChange.value / c.change.value, c.preceptChange, c.change) }))
      .sort((a, z) => z.share.value - a.share.value)
      .slice(0, 10),
  };
}

/** Every council, by region, for the list a reader can pick from. */
export function councilsByRegion(): { region: string; councils: DecodedCouncil[] }[] {
  const regions = [...new Set(ALL.map((c) => c.region))].sort();
  return regions.map((region) => ({ region, councils: ALL.filter((c) => c.region === region) }));
}
