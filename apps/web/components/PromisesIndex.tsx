"use client";

import { useEffect, useMemo, useState } from "react";
import type { Status } from "@borough-ledger/schema";
import { formatMonthYear } from "@/lib/format";
import type { PromiseModel } from "@/lib/model";
import { STATUS_LABEL, STATUS_ORDER, sides } from "@/lib/promises";
import { Num } from "./Num";

type Side = PromiseModel["side"] | "all";

/**
 * /promises: every pledge in one clean, scannable list. Filters by party (from seats in the data), status and topic,
 * kept in the address so a filtered view can be shared. Each row opens the card page.
 */
export function PromisesIndex({ promises }: { promises: PromiseModel[] }) {
  const [side, setSide] = useState<Side>("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [topic, setTopic] = useState("all");

  // Read the filters from the address once, then keep it in step without adding history entries.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("side");
    if (s === "administration" || s === "opposition") setSide(s);
    const st = q.get("status");
    if (st && (STATUS_ORDER as string[]).includes(st)) setStatus(st as Status);
    const t = q.get("topic");
    if (t) setTopic(t);
  }, []);
  useEffect(() => {
    const q = new URLSearchParams();
    if (side !== "all") q.set("side", side);
    if (status !== "all") q.set("status", status);
    if (topic !== "all") q.set("topic", topic);
    const next = `${window.location.pathname}${q.size ? `?${q}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [side, status, topic]);

  const groups = sides(promises);
  const bySide = side === "all" ? promises : promises.filter((p) => p.side === side);
  const statuses = STATUS_ORDER.map((s) => ({ s, n: bySide.filter((p) => p.status === s).length })).filter((x) => x.n > 0);
  const topics = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of promises) c.set(p.area, (c.get(p.area) ?? 0) + 1);
    return [...c].sort((a, z) => a[0].localeCompare(z[0]));
  }, [promises]);
  const list = bySide.filter((p) => (status === "all" || p.status === status) && (topic === "all" || p.area === topic));
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
              <a className="prow" href={`/promise/${p.id}`}>
                <span className="prow-who">
                  <b>{p.partyShort}</b>
                  <span className="muted">{p.side === "administration" ? "runs the council" : "opposition"}</span>
                </span>
                <span className="prow-quote">&ldquo;{p.text}&rdquo;</span>
                <span className="prow-meta">
                  <span className={`pill st-${p.status}`}>{STATUS_LABEL[p.status]}</span>
                  <span>{p.area}</span>
                  <span>
                    {p.cost ? (
                      <>
                        <Num f={p.cost.low} fmt="m1" />
                        {" to "}
                        <Num f={p.cost.high} fmt="m1" /> a year
                      </>
                    ) : p.capital ? (
                      <>
                        <Num f={p.capital.central} fmt="m1" /> to build, once
                      </>
                    ) : (
                      "No cost stated"
                    )}
                  </span>
                  {p.deadline ? <span>Due {formatMonthYear(p.deadline)}</span> : null}
                  {!allAwaitCheck && p.editorCheck ? <span className="checkmark">Awaiting editor check</span> : null}
                </span>
              </a>
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
