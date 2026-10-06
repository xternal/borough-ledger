import type { Band, Rules } from "@borough-ledger/schema";

/** Statutory band proportion, e.g. A = 6/9, H = 18/9. */
export function bandRatio(rules: Rules, band: Band): number {
  const [num, den] = rules.band_ratios.value[band];
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
  const r = bandRatio(rules, band) * (singlePerson ? 1 - rules.single_person_discount.value : 1);
  const council = bandD.council * r;
  const gla = bandD.gla * r;
  return { council, gla, total: council + gla };
}

/** Council tax yield in £m: tax base (Band D equivalents) × Band D council element × collection rate. */
export function councilTaxYieldM(taxBaseBandDEq: number, bandDCouncil: number, collectionRate: number): number {
  return (taxBaseBandDEq * bandDCouncil * collectionRate) / 1e6;
}
