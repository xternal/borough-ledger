import type { Lever, LeverId, Toggle } from "@borough-ledger/schema";

export interface BalanceInput {
  /** Next year's gap in £m, before any choices. */
  gapM: number;
  levers: readonly Lever[];
  toggles: readonly Toggle[];
  reserves: { general_m: number; minimum_safe_m: number };
  /** The referendum limit for next year, in %. */
  referendumLimitPct: number;
  toleranceM: number;
}

export interface Scenario {
  levers: Partial<Record<LeverId, number>>;
  toggles: Record<string, boolean>;
}

export const PART_IDS = ["council_tax", "fees", "settlement", "savings", "services", "reserves"] as const;
export type PartId = (typeof PART_IDS)[number];

export type BalanceStatus = "short" | "balanced" | "spare";

export interface BalanceResult {
  /** How much each kind of choice closes, in £m. Negative widens the gap. */
  parts: { id: PartId; m: number }[];
  closedM: number;
  /** gap − closed. Positive: still to find. Negative: spare. */
  remainingM: number;
  status: BalanceStatus;
  reservesLeftM: number;
  flags: {
    /** Council tax rise above the referendum limit. Flagged, not blocked. */
    referendum: boolean;
    /** One-off money used this year, which returns in next year's gap. */
    oneOffM: number;
    belowSafeMinimum: boolean;
    /** Unbalanced: the finance director must report under section 114. */
    section114: boolean;
  };
}

const LEVER_PART: Record<LeverId, PartId> = {
  ct_rise: "council_tax",
  fees: "fees",
  settlement: "settlement",
  savings: "savings",
  reserves: "reserves",
};

export function defaultScenario(input: BalanceInput): Scenario {
  return {
    levers: Object.fromEntries(input.levers.map((l) => [l.id, l.base])),
    toggles: Object.fromEntries(input.toggles.map((t) => [t.id, t.on])),
  };
}

export function leverValue(scenario: Scenario, lever: Lever): number {
  return scenario.levers[lever.id] ?? lever.base;
}

/**
 * Switching off a service that is on in the base saves its cost; switching on one that is off adds it.
 * The base gap already assumes the default on/off state.
 */
export function serviceChoicesM(toggles: readonly Toggle[], scenario: Scenario): number {
  let m = 0;
  for (const t of toggles) {
    const on = scenario.toggles[t.id] ?? t.on;
    if (t.on && !on) m += t.cost_m;
    if (!t.on && on) m -= t.cost_m;
  }
  return m;
}

/** docs/MODEL.md §4. Never auto-balances: whatever is not closed is reported as still to find. */
export function computeBalance(input: BalanceInput, scenario: Scenario): BalanceResult {
  const byPart = new Map<PartId, number>(PART_IDS.map((id) => [id, 0]));
  let oneOffM = 0;
  let reservesUsedM = 0;
  let ctRisePct = 0;
  for (const l of input.levers) {
    const v = leverValue(scenario, l);
    const m = v * l.m_per_unit;
    const part = LEVER_PART[l.id];
    byPart.set(part, (byPart.get(part) ?? 0) + m);
    if (l.one_off) oneOffM += m;
    if (l.id === "reserves") reservesUsedM = m;
    if (l.id === "ct_rise") ctRisePct = v;
  }
  byPart.set("services", serviceChoicesM(input.toggles, scenario));

  const parts = PART_IDS.map((id) => ({ id, m: byPart.get(id) ?? 0 }));
  const closedM = parts.reduce((a, p) => a + p.m, 0);
  const remainingM = input.gapM - closedM;
  const status: BalanceStatus =
    remainingM > input.toleranceM ? "short" : remainingM < -input.toleranceM ? "spare" : "balanced";
  const reservesLeftM = input.reserves.general_m - reservesUsedM;

  return {
    parts,
    closedM,
    remainingM,
    status,
    reservesLeftM,
    flags: {
      referendum: ctRisePct > input.referendumLimitPct + 1e-9,
      oneOffM,
      belowSafeMinimum: reservesLeftM < input.reserves.minimum_safe_m,
      section114: status === "short",
    },
  };
}

/** Council element next year for a given bill, after the chosen rise. */
export function nextYearCouncil(currentCouncil: number, ctRisePct: number): number {
  return currentCouncil * (1 + ctRisePct / 100);
}
