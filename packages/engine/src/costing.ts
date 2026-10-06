/** docs/MODEL.md §6: a yearly cost per Band D equivalent home, in £. */
export function perBandDHome(costM: number, taxBaseBandDEq: number): number {
  return (costM * 1e6) / taxBaseBandDEq;
}

/** A yearly cost as a share of the council's net budget, 0–1. */
export function shareOfBudget(costM: number, netBudgetM: number): number {
  return costM / netBudgetM;
}
