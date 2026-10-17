/* Links into Balance it (/balance): a shared set of choices (?s=), and a pledge to try (?promise=). */
import { decodeScenario, defaultScenario, encodeScenario, type BalanceInput, type Scenario } from "@borough-ledger/engine";

/** A pledge tried in Balance it: the card's id, and the service choice its cost is on. */
export interface PledgeTry {
  id: string;
  toggleId: string;
}

/** The pledge's choice switched from where `from` has it: on if it is off, off if it is on. */
export function withPledge(input: BalanceInput, toggleId: string, from: Scenario = defaultScenario(input)): Scenario {
  const on = from.toggles[toggleId] ?? input.toggles.find((t) => t.id === toggleId)?.on ?? false;
  return { ...from, toggles: { ...from.toggles, [toggleId]: !on } };
}

/**
 * The choices a /balance address opens on. `s` is exact whenever it is there, even empty (the council's own forecast).
 * Without it, a pledge (?promise=) opens on the forecast with that pledge's choice switched, so /balance?promise=<id>
 * is next year with the pledge (or, for a service the forecast already pays for, without it).
 */
export function scenarioFromQuery(input: BalanceInput, s: string | undefined, pledge: PledgeTry | null): Scenario {
  if (s !== undefined || !pledge) return decodeScenario(input, s);
  return withPledge(input, pledge.toggleId);
}

/** The shortest /balance address that opens on `scenario`, with the pledge it came from when there is one. */
export function balancePath(input: BalanceInput, scenario: Scenario, pledge?: PledgeTry | null): string {
  const code = encodeScenario(input, scenario);
  if (!pledge) return `/balance${code ? `?s=${code}` : ""}`;
  const implied = encodeScenario(input, withPledge(input, pledge.toggleId));
  return `/balance?promise=${encodeURIComponent(pledge.id)}${code === implied ? "" : `&s=${code}`}`;
}
