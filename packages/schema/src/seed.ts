import { z } from "zod";
import { Quality } from "./quality";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const finYear = z.string().regex(/^\d{4}-\d{2}$/, "expected a financial year like 2026-27");

export const Source = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  url: z.url().optional(),
  published_on: isoDate.optional(),
  page: z.string().optional(),
  licence: z.string().optional(),
  note: z.string().optional(),
});
export type Source = z.infer<typeof Source>;

/** Fields every value-bearing record carries. */
const provenance = {
  quality: Quality,
  source_id: z.string(),
  todo: z.string().optional(),
  note: z.string().optional(),
};

export const BANDS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const Band = z.enum(BANDS);
export type Band = z.infer<typeof Band>;

/* ------------------------------------------------------------------ rules */

export const Rules = z.object({
  meta: z.object({ note: z.string(), vintage: isoDate, sources: z.array(Source) }),
  band_ratios: z.object({
    value: z.record(Band, z.tuple([z.number().int().positive(), z.number().int().positive()])),
    ...provenance,
  }),
  single_person_discount: z.object({ value: z.number().min(0).max(1), ...provenance }),
  balanced_budget: z.object({
    tolerance_m: z.number().nonnegative(),
    tolerance_note: z.string(),
    s114_source_id: z.string(),
    ...provenance,
  }),
  referendum_limit_pct: z.record(
    finYear,
    z.object({
      value: z.number().positive(),
      core: z.number(),
      adult_social_care: z.number(),
      applies_to: z.string(),
      ...provenance,
    }),
  ),
  instalments: z.object({
    options: z.array(z.number().int().positive()).min(1),
    default: z.number().int().positive(),
    ...provenance,
  }),
});
export type Rules = z.infer<typeof Rules>;

/* ------------------------------------------------------------------ council year */

export const FundingLine = z.object({
  id: z.string(),
  label: z.string(),
  m: z.number(),
  gap: z.boolean().optional(),
  ...provenance,
});
export type FundingLine = z.infer<typeof FundingLine>;

export const ServiceLine = z.object({
  id: z.string(),
  label: z.string(),
  m: z.number(),
  desc: z.string(),
  ...provenance,
});
export type ServiceLine = z.infer<typeof ServiceLine>;

export const GAP_KINDS = ["pressure", "funding", "close", "close_saving", "close_oneoff"] as const;
export const GapValueLine = z.object({ label: z.string(), m: z.number(), kind: z.enum(GAP_KINDS), ...provenance });
export const GapMarkerLine = z.object({ label: z.string(), kind: z.enum(["subtotal", "total"]) });
export const GapLine = z.union([GapValueLine, GapMarkerLine]);
export type GapValueLine = z.infer<typeof GapValueLine>;
export type GapLine = z.infer<typeof GapLine>;

export const LEVER_IDS = ["ct_rise", "savings", "reserves", "fees", "settlement"] as const;
export const LeverId = z.enum(LEVER_IDS);
export type LeverId = z.infer<typeof LeverId>;

export const Lever = z
  .object({
    id: LeverId,
    label: z.string(),
    unit: z.enum(["%", "£m"]),
    base: z.number(),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    m_per_unit: z.number(),
    controlled_by: z.enum(["council", "government"]),
    limit: z.number().optional(),
    limit_note: z.string().optional(),
    one_off: z.boolean().optional(),
    ...provenance,
  })
  .refine((l) => l.min <= l.base && l.base <= l.max, "lever base must lie between min and max");
export type Lever = z.infer<typeof Lever>;

export const Toggle = z.object({
  id: z.string(),
  label: z.string(),
  on: z.boolean(),
  cost_m: z.number().nonnegative(),
  promise_id: z.string().optional(),
  ...provenance,
});
export type Toggle = z.infer<typeof Toggle>;

export const CouncilYear = z.object({
  meta: z.object({
    council: z.string(),
    council_code: z.string(),
    council_code_note: z.string().optional(),
    year: finYear,
    note: z.string(),
    vintage: isoDate,
    sources: z.array(Source),
  }),
  bill: z.object({
    band_d_total: z.number().positive(),
    band_d_council: z.number().positive(),
    band_d_gla: z.number().positive(),
    band_d_total_prev: z.number().positive(),
    council_rise_pct: z.number(),
    council_rise_split: z.string(),
    /** Kept for the static prototype only; the app reads ratios from rules. */
    band_ratios: z.record(Band, z.number()),
    gla_note: z.string(),
    ...provenance,
  }),
  tax_base: z.object({
    band_d_equivalents: z.number().positive(),
    collection_rate: z.number().min(0).max(1),
    ...provenance,
  }),
  funding: z.array(FundingLine).min(1),
  services: z.array(ServiceLine).min(1),
  gap_2026_27: z.array(GapLine).min(1),
  next_year: z.object({
    year: finYear,
    gap_m: z.number(),
    reserves: z.object({ general_m: z.number(), minimum_safe_m: z.number(), ...provenance }),
    levers: z.array(Lever),
    toggles: z.array(Toggle),
    ...provenance,
  }),
  politics: z.object({
    control: z.string(),
    seats: z.record(z.string(), z.number().int().nonnegative()),
    total_seats: z.number().int().positive(),
    leader: z.string(),
    election: isoDate,
    next_election: z.string(),
    ...provenance,
  }),
});
export type CouncilYear = z.infer<typeof CouncilYear>;

/* ------------------------------------------------------------------ promises */

export const STATUSES = [
  "promised",
  "in_plan",
  "budgeted",
  "delivering",
  "delivered",
  "failed",
  "quietly_dropped",
  "not_in_power",
  "unscoreable",
] as const;
export const Status = z.enum(STATUSES);
export type Status = z.infer<typeof Status>;

export const TimelineEvent = z.object({
  date: isoDate,
  type: z.string(),
  event: z.string(),
});

export const PromiseSeed = z
  .object({
    id: z.string(),
    actor: z.string(),
    party: z.string().nullable(),
    side: z.enum(["administration", "opposition"]),
    made_on: isoDate,
    text: z.string(),
    area: z.string(),
    cost_m: z.tuple([z.number(), z.number(), z.number()]).nullable(),
    cost_quality: Quality.nullable(),
    cost_source_id: z.string().optional(),
    status: Status,
    deadline: isoDate.nullable(),
    funded_by: z.string().nullable(),
    sources: z.array(z.object({ title: z.string(), url: z.url() })),
    timeline: z.array(TimelineEvent).min(1),
    lever_or_toggle_id: z.string().optional(),
    editor_check_required: z.boolean().optional(),
    test: z.boolean().optional(),
  })
  .refine((p) => p.cost_m === null || (p.cost_quality !== null && p.cost_source_id !== undefined), {
    message: "a costed promise needs cost_quality and cost_source_id",
  })
  .refine((p) => p.cost_m === null || (p.cost_m[0] <= p.cost_m[1] && p.cost_m[1] <= p.cost_m[2]), {
    message: "cost range must be low <= central <= high",
  })
  .refine((p) => p.test === true || p.status === "unscoreable" || p.sources.length > 0, {
    message: "a real promise card needs at least one source (PRD F5)",
  });
export type PromiseSeed = z.infer<typeof PromiseSeed>;

export const Promises = z.object({
  meta: z.object({ note: z.string(), side_note: z.string() }),
  promises: z.array(PromiseSeed),
});
export type Promises = z.infer<typeof Promises>;

/* ------------------------------------------------------------------ payments */

export const PaymentSeed = z.object({
  date: isoDate,
  supplier: z.string(),
  service: z.string(),
  amount: z.number().positive(),
});
export type PaymentSeed = z.infer<typeof PaymentSeed>;

export const Payments = z.object({
  meta: z.object({ vintage: isoDate, ...provenance, note: z.string() }),
  payments: z.array(PaymentSeed),
});
export type Payments = z.infer<typeof Payments>;

export function isGapValueLine(l: GapLine): l is GapValueLine {
  return l.kind !== "subtotal" && l.kind !== "total";
}
