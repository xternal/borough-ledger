import type { Lever, Toggle } from "@borough-ledger/schema";
import type { BalanceInput } from "./balance";

/**
 * A frozen balance-it input (the M0 prototype numbers) for the five reference scenarios.
 * Scenario tests check the engine's arithmetic, so they must not move when the data improves.
 */
const p = { quality: "test" as const, source_id: "fixture" };
const levers: Lever[] = [
  { id: "ct_rise", label: "Council tax rise", unit: "%", base: 4.99, min: 0, max: 8, step: 0.25, m_per_unit: 0.807, limit: 4.99, controlled_by: "council", ...p },
  { id: "savings", label: "Savings programme", unit: "£m", base: 0, min: 0, max: 15, step: 0.5, m_per_unit: 1, controlled_by: "council", ...p },
  { id: "reserves", label: "Use reserves", unit: "£m", base: 0, min: 0, max: 15, step: 0.5, m_per_unit: 1, controlled_by: "council", one_off: true, ...p },
  { id: "fees", label: "Parking and fees", unit: "%", base: 0, min: 0, max: 10, step: 1, m_per_unit: 0.4, controlled_by: "council", ...p },
  { id: "settlement", label: "Government settlement", unit: "%", base: 0, min: -5, max: 5, step: 0.5, m_per_unit: 0.763, controlled_by: "government", ...p },
];
const toggles: Toggle[] = [
  { id: "free_home_care", label: "Keep free home care", on: true, cost_m: 2.5, ...p },
  { id: "weekly_bins", label: "Keep weekly rubbish collections", on: true, cost_m: 1.5, ...p },
  { id: "library_hours", label: "Keep library opening hours", on: true, cost_m: 0.6, ...p },
  { id: "extra_officers", label: "Add 20 law enforcement officers", on: false, cost_m: 1.0, ...p },
];

export const REFERENCE_INPUT: BalanceInput = {
  gapM: 15,
  levers,
  toggles,
  reserves: { general_m: 45, minimum_safe_m: 15 },
  referendumThresholdPct: 5,
  toleranceM: 0.005,
};
