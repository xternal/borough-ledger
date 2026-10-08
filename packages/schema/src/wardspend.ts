/* Council building schemes by ward, as built by etl/capital_wards.py into data/build/payments/wards.json. */
import { z } from "zod";
import type { Content } from "./content";
import type { PaymentsIndex } from "./payments";
import { Quality } from "./quality";

const month = z.string().regex(/^\d{4}-\d{2}$/);

export const WardScheme = z.object({
  /** The council's service area, as written in its spend files. */
  area: z.string(),
  label: z.string(),
  total: z.number(),
  rows: z.number().int().positive(),
  first: month,
  last: month,
  /** The spend files the payments come from (payments source ids). */
  files: z.array(z.string()).min(1),
  /** For a scheme across several wards: all of them. The money is not split. */
  wards: z.array(z.string()).optional(),
});
export type WardScheme = z.infer<typeof WardScheme>;

export const WardSpend = z.object({
  note: z.string(),
  /** Sourced once every line of data/manual/capital_scheme_wards.csv is signed off; approx until then. */
  quality: Quality,
  mapping: z.object({ schemes: z.number().int(), unreviewed: z.number().int(), checked: z.number().int() }),
  by_kind: z.record(z.enum(["place", "several", "borough", "outside", "unknown"]), z.number()),
  total: z.number(),
  first: month,
  last: month,
  wards: z.record(
    z.string(),
    z.object({ total: z.number(), rows: z.number().int(), schemes: z.array(WardScheme), shared: z.array(WardScheme) }),
  ),
});
export type WardSpend = z.infer<typeof WardSpend>;

/** Every ward is one of the council's, every file a known spend file, and the totals add up. */
export function checkWardSpend(s: WardSpend, content: Content, payments: PaymentsIndex): string[] {
  const problems: string[] = [];
  const wardIds = new Set(content.wards.wards.map((w) => w.id));
  const files = new Set(payments.sources.map((f) => f.id));
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
  if (s.quality === "test") problems.push("ward spend: quality cannot be test");
  if (s.quality === "sourced" && (s.mapping.unreviewed > 0 || s.mapping.checked > 0)) problems.push("ward spend: sourced only once every line is signed off");
  if (!near(Object.values(s.by_kind).reduce((a, v) => a + v, 0), s.total)) problems.push("ward spend: the kinds do not add up to the total");
  let placed = 0;
  for (const [id, w] of Object.entries(s.wards)) {
    if (!wardIds.has(id)) problems.push(`ward spend: unknown ward ${id}`);
    if (!near(w.schemes.reduce((a, x) => a + x.total, 0), w.total)) problems.push(`ward spend: ${id} schemes do not add up to its total`);
    placed += w.total;
    for (const x of [...w.schemes, ...w.shared]) {
      for (const f of x.files) if (!files.has(f)) problems.push(`ward spend: ${x.area} cites unknown file ${f}`);
      if (x.first > x.last) problems.push(`ward spend: ${x.area} ends before it starts`);
    }
    for (const x of w.shared) {
      if (!x.wards || x.wards.length < 2 || !x.wards.includes(id)) problems.push(`ward spend: shared scheme ${x.area} must list ${id} and another ward`);
      for (const o of x.wards ?? []) if (!wardIds.has(o)) problems.push(`ward spend: ${x.area} lists unknown ward ${o}`);
    }
  }
  if (!near(placed, s.by_kind.place ?? 0)) problems.push("ward spend: the wards' totals do not add up to the schemes placed in one ward");
  return problems;
}
