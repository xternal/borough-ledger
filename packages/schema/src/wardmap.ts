/* Ward boundaries as SVG paths, as built by etl/ward_map.py into data/build/ward_map.json. */
import { z } from "zod";
import type { Content } from "./content";

// Ward codes: E05 in England, S13 in Scotland.
const gss = z.string().regex(/^(E05|S13)\d{6}$/);

export const WardShape = z.object({
  ons_code: gss,
  /** The ONS name, which FixMyStreet uses too ("Shepherd's Bush Green"); the site shows the council's name. */
  ons_name: z.string(),
  /** In the map's own units (view_box); north is up. */
  path: z.string().regex(/^M[\d.,LMZ-]+Z$/),
  label: z.tuple([z.number(), z.number()]),
  /** Wards sharing a stretch of boundary. */
  neighbours: z.array(gss),
});
export type WardShape = z.infer<typeof WardShape>;

export const WardMap = z.object({
  note: z.string(),
  source: z.object({
    title: z.string(),
    page: z.url(),
    url: z.url(),
    licence: z.string(),
    attribution: z.string(),
    retrieved_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  council_code: z.string().regex(/^(E0\d|S12)\d{6}$/),
  view_box: z.tuple([z.number().positive(), z.number().positive()]),
  wards: z.array(WardShape).min(1),
});
export type WardMap = z.infer<typeof WardMap>;

/** Every ward on the site has exactly one shape and every shape is a ward; neighbours go both ways. */
export function checkWardMap(map: WardMap, content: Content, councilCode: string): string[] {
  const problems: string[] = [];
  if (map.council_code !== councilCode) problems.push(`ward map: council ${map.council_code}, expected ${councilCode}`);
  const shapes = new Map(map.wards.map((w) => [w.ons_code, w]));
  const codes = new Set(content.wards.wards.map((w) => w.ons_code));
  for (const w of content.wards.wards) if (!shapes.has(w.ons_code)) problems.push(`ward ${w.id}: no shape for ${w.ons_code} in the ward map`);
  for (const s of map.wards) {
    if (!codes.has(s.ons_code)) problems.push(`ward map: ${s.ons_code} (${s.ons_name}) is not one of the council's wards`);
    for (const n of s.neighbours)
      if (!shapes.get(n)?.neighbours.includes(s.ons_code)) problems.push(`ward map: ${s.ons_code} lists ${n} as a neighbour, but not the other way`);
  }
  return problems;
}
