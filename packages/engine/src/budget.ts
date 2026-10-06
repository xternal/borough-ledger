/** docs/MODEL.md §2: Σ funding + reserves drawn = Σ net service spend, every year. */
export interface BudgetCheck {
  fundingM: number;
  spendingM: number;
  differenceM: number;
  balances: boolean;
}

export function checkBudget(funding: readonly { m: number }[], services: readonly { m: number }[], toleranceM: number): BudgetCheck {
  const fundingM = sum(funding.map((f) => f.m));
  const spendingM = sum(services.map((s) => s.m));
  const differenceM = fundingM - spendingM;
  return { fundingM, spendingM, differenceM, balances: Math.abs(differenceM) <= toleranceM };
}

export function sum(xs: readonly number[]): number {
  return xs.reduce((a, x) => a + x, 0);
}
