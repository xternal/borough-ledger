/* Northern Ireland: domestic rates instead of council tax (Belfast first; etl/northern_ireland.py). A home's bill is its
   capital value, capped, times two poundages: the council's district rate and the Executive's regional rate. No bands. */
import { z } from "zod";
import { Quality } from "./quality";
import { FundingLine, ServiceLine, Source } from "./seed";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const finYear = z.string().regex(/^\d{4}-\d{2}$/, "expected a financial year like 2026-27");
const provenance = { quality: Quality, source_id: z.string(), note: z.string().optional(), method_note: z.string().optional() };

/** Northern Ireland's domestic rating rules (data/config/rules_northern_ireland.json), each with its source. */
export const RatesRules = z.object({
  meta: z.object({ note: z.string(), vintage: isoDate, sources: z.array(Source) }),
  /** Value above this is ignored: a home worth more pays as if it were worth exactly this. */
  capital_value_cap: z.object({ value: z.number().positive(), ...provenance }),
  /** Capital values are what a home would have sold for on this date. */
  valuation_date: z.object({ value: isoDate, ...provenance }),
  /** 20% off for someone aged 70 or over who lives alone, by application. */
  lone_pensioner_allowance: z.object({ value: z.number().min(0).max(1), age: z.number().int().positive(), ...provenance }),
  instalments: z.object({ value: z.number().int().positive(), ...provenance }),
  /** The council must raise what its estimates say it needs: what is not met by other income comes from the rate. */
  balanced_budget: z.object({ tolerance_m: z.number().nonnegative(), ...provenance }),
});
export type RatesRules = z.infer<typeof RatesRules>;

/** A poundage in £ per £1 of capital value, as the Department of Finance publishes it (0.004492 is 0.4492p). */
const Poundage = z.number().positive().max(0.1);

export const RatesStatement = z.object({
  meta: z.object({
    council: z.string(),
    council_short: z.string(),
    council_code: z.string(),
    slug: z.string(),
    year: finYear,
    note: z.string(),
    vintage: isoDate,
    sources: z.array(Source),
  }),
  rates: z.object({
    district: Poundage,
    regional: Poundage,
    district_prev: Poundage,
    regional_prev: Poundage,
    ...provenance,
  }),
  /** The capital value the bill starts on: the official average for Northern Ireland, there being none for one council. */
  example_value: z.object({ value: z.number().positive(), label: z.string(), ...provenance }),
  /** What the council needs from rates and government grants after its own fees, charges and other grants. */
  amount_raised: z.object({ m: z.number().positive(), reserves_m: z.number(), ...provenance }),
  history: z.array(
    z.object({
      year: finYear,
      district: Poundage,
      regional: Poundage,
      /** The amount to be raised (Table 1), £m. */
      amount_raised_m: z.number().positive(),
      quality: Quality,
      source_ids: z.array(z.string()).min(1),
    }),
  ),
  funding: z.array(FundingLine).min(1),
  services: z.array(ServiceLine).min(1),
});
export type RatesStatement = z.infer<typeof RatesStatement>;

/** Funding equals spending, and the history ends with this year's poundages and amount. */
export function checkRatesStatement(s: RatesStatement, tolerance_m: number): string[] {
  const problems: string[] = [];
  const funding = s.funding.reduce((a, f) => a + f.m, 0);
  const spending = s.services.reduce((a, x) => a + x.m, 0);
  if (Math.abs(funding - spending) > tolerance_m) problems.push(`funding £${funding.toFixed(3)}m ≠ spending £${spending.toFixed(3)}m`);
  if (Math.abs(spending - s.amount_raised.m) > tolerance_m) problems.push("spending ≠ the amount to be raised");
  const last = s.history.at(-1);
  if (!last || last.year !== s.meta.year || last.district !== s.rates.district || last.regional !== s.rates.regional) problems.push("history must end with this year's poundages");
  const prev = s.history.at(-2);
  if (!prev || prev.district !== s.rates.district_prev || prev.regional !== s.rates.regional_prev) problems.push("history must hold last year's poundages");
  return problems;
}
