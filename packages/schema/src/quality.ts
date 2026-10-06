import { z } from "zod";

/** How much to trust a value. `test` is invented and must never reach production. */
export const QUALITIES = ["sourced", "approx", "modelled", "test"] as const;
export const Quality = z.enum(QUALITIES);
export type Quality = z.infer<typeof Quality>;

const RANK: Record<Quality, number> = { sourced: 0, approx: 1, modelled: 2, test: 3 };

/** A value derived from several inputs is only as good as its weakest input. */
export function worst(...qs: Quality[]): Quality {
  let out: Quality = "sourced";
  for (const q of qs) if (RANK[q] > RANK[out]) out = q;
  return out;
}

/**
 * A number ready to render: the value plus the provenance it inherits.
 * Every number the app shows is a Figure; components never format bare numbers.
 */
export interface Figure {
  value: number;
  quality: Quality;
  sources: readonly string[];
}

export function fig(value: number, quality: Quality, ...sources: string[]): Figure {
  return { value, quality, sources: [...new Set(sources)] };
}

/** A Figure computed from other Figures: worst quality, union of sources. */
export function derive(value: number, first: Figure, ...rest: Figure[]): Figure {
  const inputs = [first, ...rest];
  return {
    value,
    quality: worst(...inputs.map((f) => f.quality)),
    sources: [...new Set(inputs.flatMap((f) => f.sources))],
  };
}
