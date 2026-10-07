/* Shared promise labels and filters. One rule for every party: sides come from seats in the data, never from a name. */
import type { Status } from "@borough-ledger/schema";
import type { PromiseModel } from "@/lib/model";

export const STATUS_LABEL: Record<Status, string> = {
  promised: "Promised",
  in_plan: "In plan",
  budgeted: "Budgeted",
  delivering: "Delivering",
  delivered: "Delivered",
  failed: "Failed",
  quietly_dropped: "Quietly dropped",
  unscoreable: "Unscoreable",
  not_in_power: "Opposition pledge",
};

/** What each status means, in a line. */
export const STATUS_MEANS: Record<Status, string> = {
  promised: "Pledged, with an archived source. Nothing in council papers yet.",
  in_plan: "A Cabinet or committee decision, or an adopted strategy.",
  budgeted: "A line in the revenue budget or capital programme.",
  delivering: "Under way: the service has started, a contract is let or works are on site.",
  delivered: "Done, as worded.",
  failed: "The deadline passed with evidence it was not done, or it was abandoned.",
  quietly_dropped: "The deadline passed with no statement and no sign of delivery.",
  unscoreable: "No who, how much, when or from where, so it cannot be tracked.",
  not_in_power: "Made by a party that does not run the council. Tracked if it ever can be delivered.",
};

export const STATUS_ORDER: Status[] = ["promised", "in_plan", "budgeted", "delivering", "delivered", "failed", "quietly_dropped", "unscoreable", "not_in_power"];

export interface SideGroup {
  id: PromiseModel["side"];
  /** "Labour, runs the council" or "Conservative, opposition": party names from the data. */
  label: string;
  parties: string[];
  count: number;
}

export function sides(promises: readonly PromiseModel[]): SideGroup[] {
  return (["administration", "opposition"] as const)
    .map((id) => {
      const ps = promises.filter((p) => p.side === id);
      const parties = [...new Set(ps.map((p) => p.partyShort))];
      return { id, parties, count: ps.length, label: `${parties.join(", ")}, ${id === "administration" ? "runs the council" : "opposition"}` };
    })
    .filter((s) => s.count > 0);
}

export function isOverdue(p: PromiseModel, today: string): boolean {
  return !!p.deadline && p.deadline < today && p.status !== "delivered" && p.status !== "failed";
}

/** "£8.0m capital" style cost words, or null when no cost is stated. Numbers are rendered by the caller through <Num>. */
export const hasCost = (p: PromiseModel) => !!(p.cost || p.capital);
