/**
 * Northern Ireland's domestic rates: capital value (capped) × (district rate + regional rate), less the Lone Pensioner
 * Allowance where it applies. Poundages are in £ per £1 of value, as the Department of Finance gives them.
 * nidirect, "How rate bills are calculated"; Rates (Maximum Capital Value) Regulations (NI) 2007, as amended in 2009.
 */
export interface RatesBill {
  /** The value the bill is worked out on: the home's capital value, or the cap if it is worth more. */
  rateable: number;
  district: number;
  regional: number;
  total: number;
}

export function ratesBill(capitalValue: number, poundages: { district: number; regional: number }, rules: { cap: number; allowance: number }, lonePensioner: boolean): RatesBill {
  if (!Number.isFinite(capitalValue) || capitalValue < 0) throw new Error("a capital value is a positive number of pounds");
  const rateable = Math.min(capitalValue, rules.cap);
  const off = lonePensioner ? 1 - rules.allowance : 1;
  const district = rateable * poundages.district * off;
  const regional = rateable * poundages.regional * off;
  return { rateable, district, regional, total: district + regional };
}
