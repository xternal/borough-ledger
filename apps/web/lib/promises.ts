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

const IN_WORDS: Partial<Record<Status, [string, string]>> = {
  delivered: ["is delivered", "are delivered"],
  delivering: ["is being delivered", "are being delivered"],
  budgeted: ["is in the budget", "are in the budget"],
  in_plan: ["is in a council plan", "are in a council plan"],
  promised: ["is promised with nothing in council papers yet", "are promised with nothing in council papers yet"],
  failed: ["has failed", "have failed"],
  quietly_dropped: ["was quietly dropped", "were quietly dropped"],
  unscoreable: ["is too vague to track", "are too vague to track"],
};

/**
 * Where each side's pledges stand, in one sentence each: "Labour, which runs the council, made 9 headline pledges:
 * 2 are being delivered, ...". Counted from the data, the same way for every party.
 */
export function standing(promises: readonly PromiseModel[]): string[] {
  return sides(promises).map((g) => {
    const ps = promises.filter((p) => p.side === g.id);
    const who = `${g.parties.join(" and ")}${g.id === "administration" ? ", which runs the council," : ", in opposition,"}`;
    if (g.id === "opposition") return `${who} made ${ps.length} headline ${ps.length === 1 ? "pledge" : "pledges"}; opposition pledges are costed so voters can compare, but cannot be delivered from opposition.`;
    const parts = STATUS_ORDER.map((st) => [st, ps.filter((p) => p.status === st).length] as const)
      .filter(([, n]) => n > 0)
      .map(([st, n]) => `${n} ${(IN_WORDS[st] ?? [STATUS_LABEL[st], STATUS_LABEL[st]])[n === 1 ? 0 : 1]}`);
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
    return `${who} made ${ps.length} headline ${ps.length === 1 ? "pledge" : "pledges"}: ${list}.`;
  });
}
