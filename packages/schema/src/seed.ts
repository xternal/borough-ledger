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
  /** The exact file the ETL read, and its SHA-256. */
  asset_url: z.url().optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});
export type Source = z.infer<typeof Source>;

/** Fields every value-bearing record carries. */
const provenance = {
  quality: Quality,
  source_id: z.string(),
  todo: z.string().optional(),
  note: z.string().optional(),
  method_note: z.string().optional(),
};

/** A single value with its own provenance. */
export const Valued = z.object({ m: z.number(), ...provenance });
export type Valued = z.infer<typeof Valued>;

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
      /** A rise at or above this percentage is excessive and needs a local referendum. Null: no limit set for this council. */
      threshold_pct: z.number().positive().nullable(),
      excessive_if: z.enum(["at_or_above", "none"]),
      core: z.number().nullable(),
      adult_social_care: z.number().nullable(),
      applies_to: z.string(),
      ...provenance,
    }).refine((r) => (r.threshold_pct === null) === (r.excessive_if === "none"), "a referendum threshold is null exactly when no limit is set"),
  ),
  instalments: z.object({
    options: z.array(z.number().int().positive()).min(1),
    default: z.number().int().positive(),
    ...provenance,
  }),
});
export type Rules = z.infer<typeof Rules>;

/* ------------------------------------------------------------------ council year */

export const FUNDING_KINDS = ["council_tax", "grant", "business_rates", "other", "reserves"] as const;

export const FundingLine = z.object({
  id: z.string(),
  label: z.string(),
  official_term: z.string(),
  desc: z.string(),
  kind: z.enum(FUNDING_KINDS),
  m: z.number(),
  /** One-off money, such as reserves. Drawn hatched. */
  gap: z.boolean().optional(),
  /** A ring-fenced grant can only be spent on this service group. */
  ring_fenced_to: z.string().optional(),
  detail: z.array(z.object({ label: z.string(), m: z.number() })).optional(),
  ...provenance,
});
export type FundingLine = z.infer<typeof FundingLine>;

export const ServiceLine = z.object({
  id: z.string(),
  label: z.string(),
  official_term: z.string(),
  desc: z.string(),
  /** Net spending, £m. */
  m: z.number(),
  /** Net spending less ring-fenced grants: what council tax, business rates and general grants pay for. */
  general_fund_m: z.number(),
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
    /** The value the gap already assumes (e.g. the forecast's council tax rise). Only the difference from it closes the gap. */
    assumed: z.number().optional(),
    /** Values worth marking on the slider, such as a freeze or the forecast's assumption. */
    marks: z.array(z.number()).optional(),
    ...provenance,
  })
  .refine((l) => l.min <= l.base && l.base <= l.max, "lever base must lie between min and max");

export const Saving = z.object({
  id: z.string(),
  label: z.string(),
  directorate: z.string(),
  service: z.string(),
  kind: z.enum(["service", "collection_fund"]),
  /** Saving this year and next, £m (positive = money saved). */
  m: z.number(),
  m_next_year: z.number(),
  /** Saves money this year only; the same amount comes back as a gap next year. */
  one_off: z.boolean(),
  service_group: z.string().optional(),
  ...provenance,
});
export type Saving = z.infer<typeof Saving>;
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

export const CouncilTaxYear = z.object({
  year: finYear,
  band_d_council: z.number().positive(),
  band_d_area: z.number().positive(),
  band_d_gla: z.number().positive(),
  council_tax_requirement_m: z.number().positive(),
  tax_base: z.number().positive(),
  collection_rate: z.number().min(0).max(1),
  source_ids: z.array(z.string()).min(1),
});

export const CouncilYear = z.object({
  meta: z.object({
    council: z.string(),
    council_short: z.string(),
    council_code: z.string(),
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
    band_d_council_prev: z.number().positive(),
    council_rise_pct: z.number(),
    /** Every band as published by government, to the penny. The engine must reproduce these. */
    published_bands: z.record(Band, z.number().positive()),
    gla_note: z.string(),
    ...provenance,
  }),
  tax_base: z.object({
    /** Band D equivalent homes after council tax support, before collection losses. */
    band_d_equivalents: z.number().positive(),
    collection_rate: z.number().min(0).max(1),
    /** Tax base for setting the tax: band_d_equivalents × collection_rate. */
    setting_base: z.number().positive(),
    ...provenance,
  }),
  history: z.object({
    council_tax: z.array(CouncilTaxYear).min(1),
    /** Budgeted spending by service group from each year's RA return, £m. */
    budget: z.array(
      z.object({
        year: finYear,
        revenue_expenditure_m: z.number(),
        council_tax_requirement_m: z.number(),
        services_m: z.record(z.string(), z.number()),
        source_id: z.string(),
      }),
    ),
    /** What was actually spent, from the RS and RO outturn returns, £m. Includes grants received during the year. */
    outturn: z.array(
      z.object({
        year: finYear,
        revenue_expenditure_m: z.number(),
        council_tax_requirement_m: z.number(),
        services_m: z.record(z.string(), z.number()),
        housing_benefit_net_m: z.number(),
        reserves_m: z.object({ unallocated_start: z.number(), unallocated_end: z.number(), earmarked_start: z.number(), earmarked_end: z.number() }),
        source_ids: z.array(z.string()).min(1),
      }),
    ),
    quality: Quality,
  }),
  funding: z.array(FundingLine).min(1),
  services: z.array(ServiceLine).min(1),
  gap_2026_27: z.array(GapLine).min(1),
  savings: z.array(Saving),
  next_year: z.object({
    year: finYear,
    gap_m: z.number(),
    reserves: z.object({ general: Valued, minimum_safe: Valued }),
    levers: z.array(Lever),
    toggles: z.array(Toggle),
    /** The council's medium-term forecast: cumulative gap for each year if nothing new is done. First entry is next year. */
    forecast: z.array(z.object({ year: finYear, gap_m: z.number(), ...provenance })).min(1),
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

export function isGapValueLine(l: GapLine): l is GapValueLine {
  return l.kind !== "subtotal" && l.kind !== "total";
}
