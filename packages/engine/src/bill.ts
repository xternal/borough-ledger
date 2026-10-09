import type { Band, Rules } from "@borough-ledger/schema";

/** Statutory band proportion, e.g. A = 6/9, H = 18/9 in England; 240/360 and 882/360 in Scotland. */
export function bandRatio(rules: Rules, band: Band): number {
  const [num, den] = rules.band_ratios.value[band];
  return num / den;
}

/** The rest of the bill's band proportion: the council's, except where it has its own (Scottish Water's water and
 *  sewerage charges kept 6/9 to 18/9 when Scottish council tax bands changed in 2017). */
export function othersRatio(rules: Rules, band: Band): number {
  const [num, den] = (rules.others_band_ratios ?? rules.band_ratios).value[band];
  return num / den;
}

export interface BandD {
  council: number;
  gla: number;
}

export interface Bill {
  council: number;
  gla: number;
  total: number;
}

/**
 * bill(band) = (BandD_council + BandD_GLA) × ratio(band) × (1 − discount × single_person)
 * docs/MODEL.md §1.
 */
export function billFor(rules: Rules, bandD: BandD, band: Band, singlePerson: boolean): Bill {
  const discount = singlePerson ? 1 - rules.single_person_discount.value : 1;
  const council = bandD.council * bandRatio(rules, band) * discount;
  const gla = bandD.gla * othersRatio(rules, band) * discount;
  return { council, gla, total: council + gla };
}

/** Council tax yield in £m: tax base (Band D equivalents) × Band D council element × collection rate. */
export function councilTaxYieldM(taxBaseBandDEq: number, bandDCouncil: number, collectionRate: number): number {
  return (taxBaseBandDEq * bandDCouncil * collectionRate) / 1e6;
}

/**
 * Split an amount in proportion to weights, in whole pence that add back up to the amount (largest remainder, ties to
 * the earlier weight). Splits any band's Mayor of London share by body: at Band D it gives the GLA's own figures.
 */
export function splitPence(amount: number, weights: number[]): number[] {
  const pence = Math.round(amount * 100);
  const sum = weights.reduce((a, w) => a + w, 0);
  if (!(sum > 0) || weights.some((w) => w < 0)) throw new Error("splitPence needs non-negative weights with a positive sum");
  const exact = weights.map((w) => (pence * w) / sum);
  const out = exact.map((x) => Math.floor(x + 1e-9));
  let left = pence - out.reduce((a, p) => a + p, 0);
  const order = exact.map((x, i) => ({ r: x - out[i]!, i })).sort((a, z) => z.r - a.r || a.i - z.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]! += 1;
    left -= 1;
  }
  return out.map((p) => p / 100);
}
