/* The four-year building programme and the council homes budget, as built by etl/capital.py into data/build/capital.json
   from hand-made tables of the council's February 2026 papers. £m unless a fact's unit says otherwise. */
import { z } from "zod";
import type { Content } from "./content";
import type { DecisionsFile } from "./decisions";
import { Quality } from "./quality";

const Line = z.object({
  label: z.string(),
  /** The scheme in residents' words; the council's own name is `label`. */
  plain: z.string(),
  years: z.array(z.number()).length(4),
  total: z.number().nullable(),
  page: z.number().int().positive(),
  pledges: z.array(z.string()).optional(),
  note: z.string().optional(),
});
export type CapitalLine = z.infer<typeof Line>;

const Section = z.object({
  id: z.enum(["people", "place_gf", "housing", "place_hra"]),
  account: z.enum(["gf", "hra"]),
  plain: z.string(),
  groups: z.array(z.object({ name: z.string(), plain: z.string(), lines: z.array(Line), subtotal: Line.nullable() })),
  total: Line,
  funding: z.array(Line),
});
export type CapitalSection = z.infer<typeof Section>;

export const CapitalFile = z.object({
  note: z.string(),
  programme: z.object({
    source_id: z.string(),
    quality: Quality,
    years: z.array(z.string()).length(4),
    sections: z.array(Section),
    summary: z.object({ gf: Line, hra: Line, all: Line }),
    resolution: z.object({ gf_m: z.number(), hra_m: z.number(), decision_id: z.string(), gf_gap_m: z.number(), hra_gap_m: z.number() }),
    debt: z.object({
      gf: z.object({ plain: z.string(), opening: z.number(), years: z.array(z.number()).length(4), page: z.number().int() }),
      hra: z.object({ plain: z.string(), opening: z.number(), years: z.array(z.number()).length(4), page: z.number().int() }),
    }),
    misprints: z.array(z.object({ label: z.string(), section: z.string(), used: z.number(), page: z.number().int(), note: z.string() })),
  }),
  council_homes: z.object({
    source_id: z.string(),
    quality: Quality,
    years: z.array(z.string()).length(2),
    budget: z.array(
      z.object({ key: z.string(), kind: z.enum(["income", "spend"]), label: z.string(), plain: z.string(), prev: z.number(), now: z.number(), page: z.number().int() }),
    ),
    facts: z.record(z.string(), z.object({ label: z.string(), value: z.number(), unit: z.string(), page: z.number().int(), note: z.string() })),
  }),
});
export type CapitalFile = z.infer<typeof CapitalFile>;

/** Pledges and decisions named in the tables exist; the council homes account balances. */
export function checkCapital(c: CapitalFile, content: Content, decisions: DecisionsFile, sourceIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const promises = new Set(content.promises.map((p) => p.id));
  for (const id of [c.programme.source_id, c.council_homes.source_id]) if (!sourceIds.has(id)) problems.push(`capital: unknown source ${id}`);
  if (!decisions.decisions.some((d) => d.id === c.programme.resolution.decision_id)) problems.push(`capital: unknown decision ${c.programme.resolution.decision_id}`);
  for (const s of c.programme.sections)
    for (const g of s.groups) for (const l of g.lines) for (const p of l.pledges ?? []) if (!promises.has(p)) problems.push(`capital ${l.label}: unknown pledge ${p}`);
  for (const [i, y] of c.council_homes.years.entries()) {
    const net = c.council_homes.budget.reduce((a, b) => a + (i ? b.now : b.prev), 0);
    if (Math.abs(net) > 0.05 * (c.council_homes.budget.length + 1)) problems.push(`capital: council homes ${y} does not balance (${net.toFixed(1)})`);
  }
  return problems;
}
