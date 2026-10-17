/* The filters on /promises, kept in its address so a filtered view is a link anyone can open, and read on the server so
   the first page shown is already filtered. One rule for every party: sides come from seats in the data. */
import type { Status } from "@borough-ledger/schema";
import type { PromiseModel } from "./model";
import { STATUS_ORDER, isOverdue } from "./promises";
import { topicSlug } from "./topicSlug";

export type SideFilter = PromiseModel["side"] | "all";
/** A status, or every pledge past its deadline and not yet delivered or failed. */
export type StatusFilter = Status | "overdue" | "all";

export interface PromiseFilters {
  side: SideFilter;
  status: StatusFilter;
  /** The topic's name as in the data (the address carries its slug), or "all". */
  topic: string;
}

export const NO_FILTERS: PromiseFilters = { side: "all", status: "all", topic: "all" };

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The filters an address asks for. Anything that names nothing on the site is dropped, never an error. */
export function filtersFromQuery(promises: readonly PromiseModel[], q: Query): PromiseFilters {
  const side = one(q.side);
  const status = one(q.status);
  const topic = one(q.topic);
  return {
    side: side === "administration" || side === "opposition" ? side : "all",
    status: status === "overdue" || (STATUS_ORDER as string[]).includes(status ?? "") ? (status as StatusFilter) : "all",
    // By slug (/promises?topic=housing, as /topic/<slug>), or by the topic's own name, as older links carried it.
    topic: (topic && promises.find((p) => topicSlug(p.area) === topic || p.area === topic)?.area) || "all",
  };
}

/** The query string for a view: only the filters in use, the topic by its slug; "" for every pledge. */
export function filtersQuery(f: PromiseFilters): string {
  const q = new URLSearchParams();
  if (f.side !== "all") q.set("side", f.side);
  if (f.status !== "all") q.set("status", f.status);
  if (f.topic !== "all") q.set("topic", topicSlug(f.topic));
  return q.size ? `?${q}` : "";
}

/** The pledges a view shows, in the order given. */
export function applyFilters(promises: readonly PromiseModel[], f: PromiseFilters, today: string): PromiseModel[] {
  return promises.filter(
    (p) =>
      (f.side === "all" || p.side === f.side) &&
      (f.status === "all" || (f.status === "overdue" ? isOverdue(p, today) : p.status === f.status)) &&
      (f.topic === "all" || p.area === f.topic),
  );
}
