"use client";

import { useEffect, useMemo, useState } from "react";
import type { PromiseModel } from "@/lib/model";
import { applyFilters, filtersQuery, type PromiseFilters, type SideFilter, type StatusFilter } from "@/lib/promiseFilters";
import { STATUS_LABEL, STATUS_ORDER, isOverdue, sides } from "@/lib/promises";
import { PromiseRow } from "./PledgeRows";

/**
 * /promises: every pledge in one clean, scannable list. Filters by party (from seats in the data), status (or overdue)
 * and topic. The page reads them from the address, so the first view is already filtered; changes keep the address in
 * step without adding history entries, so a filtered view can be shared. Each row is one link to its card page.
 */
export function PromisesIndex({ promises, today, initial }: { promises: PromiseModel[]; today: string; initial: PromiseFilters }) {
  const [side, setSide] = useState<SideFilter>(initial.side);
  const [status, setStatus] = useState<StatusFilter>(initial.status);
  const [topic, setTopic] = useState(initial.topic);

  useEffect(() => {
    const next = `${window.location.pathname}${filtersQuery({ side, status, topic })}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [side, status, topic]);

  const groups = sides(promises);
  const bySide = side === "all" ? promises : promises.filter((p) => p.side === side);
  // Statuses that side has, and the one picked even when it has none, so a shared link always shows what it filters by.
  const statuses = STATUS_ORDER.map((s) => ({ s, n: bySide.filter((p) => p.status === s).length })).filter((x) => x.n > 0 || x.s === status);
  const overdue = bySide.filter((p) => isOverdue(p, today)).length;
  const topics = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of promises) c.set(p.area, (c.get(p.area) ?? 0) + 1);
    return [...c].sort((a, z) => a[0].localeCompare(z[0]));
  }, [promises]);
  const list = applyFilters(promises, { side, status, topic }, today);
  const allAwaitCheck = promises.every((p) => p.editorCheck);

  return (
    <>
      <div className="ptools" role="group" aria-label="Filter promises">
        <div className="ptool">
          <span className="ptool-l">Party</span>
          <div className="filters">
            <button type="button" className="chip" aria-pressed={side === "all"} onClick={() => setSide("all")}>
              All <span className="count">{promises.length}</span>
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className="chip"
                aria-pressed={side === g.id}
                onClick={() => {
                  setSide(g.id);
                  setStatus("all");
                }}
              >
                {g.label} <span className="count">{g.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ptool">
          <span className="ptool-l">Status</span>
          <div className="filters">
            <button type="button" className="chip" aria-pressed={status === "all"} onClick={() => setStatus("all")}>
              Any <span className="count">{bySide.length}</span>
            </button>
            {statuses.map(({ s, n }) => (
              <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
                {STATUS_LABEL[s]} <span className="count">{n}</span>
              </button>
            ))}
            {overdue || status === "overdue" ? (
              <button type="button" className="chip" aria-pressed={status === "overdue"} onClick={() => setStatus("overdue")}>
                Overdue <span className="count">{overdue}</span>
              </button>
            ) : null}
          </div>
        </div>
        <div className="ptool">
          <label className="ptool-l" htmlFor="ptopic">
            Topic
          </label>
          <select id="ptopic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="all">All topics</option>
            {topics.map(([t, n]) => (
              <option key={t} value={t}>
                {t} ({n})
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="pcount muted small" aria-live="polite">
        {list.length === promises.length ? `All ${list.length} pledges` : `${list.length} of ${promises.length} pledges`}, newest first.
        {allAwaitCheck ? " Every card is awaiting an editor check." : null}
      </p>

      {list.length ? (
        <ol className="prows">
          {list.map((p) => (
            <li key={p.id}>
              <PromiseRow p={p} area check={!allAwaitCheck} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">
          No pledges match.{" "}
          <button
            type="button"
            className="linkbtn"
            onClick={() => {
              setSide("all");
              setStatus("all");
              setTopic("all");
            }}
          >
            Clear the filters
          </button>
        </p>
      )}
    </>
  );
}
