import { computeBalance, type BalanceInput, type BalanceStatus, type Scenario } from "./balance";

/** One year of the council's own medium-term forecast: the cumulative gap if nothing new is done. */
export interface ForecastYear {
  year: string;
  gapM: number;
}

export interface MediumTermYear {
  year: string;
  /** The council's forecast gap for this year, before the choices made in the tool. */
  forecastGapM: number;
  /** Choices that keep saving every year (a higher council tax rise, permanent savings, services stopped). */
  recurringM: number;
  /** One-off money used next year that is no longer there: it reappears in this year's gap. Zero in the first year. */
  comesBackM: number;
  /** Still to find in this year if nothing else changes. Positive: still to find. Negative: spare. */
  remainingM: number;
  status: BalanceStatus;
  reservesLeftM: number;
}

/**
 * docs/MODEL.md §5: gap_{t+1} = pressures_{t+1} − Δfunding_{t+1} + reserves_used_t + Σ one-off savings_t.
 *
 * The council's forecast already gives the cumulative gap for each year, so with choices made for next year:
 *   year 1:   remaining = forecast_1 − recurring − one-off
 *   year t>1: remaining = forecast_t − recurring
 * One-off money closes next year's gap once and is not subtracted again, so it comes back; recurring choices
 * keep closing the gap every year. Reserves are spent once and stay spent.
 */
export function mediumTerm(input: BalanceInput, forecast: readonly ForecastYear[], scenario: Scenario): MediumTermYear[] {
  const [first, ...later] = forecast;
  if (!first) return [];
  const r = computeBalance({ ...input, gapM: first.gapM }, scenario);
  const recurringM = r.closedM - r.flags.oneOffM;
  const status = (remaining: number): BalanceStatus =>
    remaining > input.toleranceM ? "short" : remaining < -input.toleranceM ? "spare" : "balanced";
  return [
    { year: first.year, forecastGapM: first.gapM, recurringM, comesBackM: 0, remainingM: r.remainingM, status: r.status, reservesLeftM: r.reservesLeftM },
    ...later.map((f) => {
      const remainingM = f.gapM - recurringM;
      return { year: f.year, forecastGapM: f.gapM, recurringM, comesBackM: r.flags.oneOffM, remainingM, status: status(remainingM), reservesLeftM: r.reservesLeftM };
    }),
  ];
}
