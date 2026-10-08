"use client";

import { useState } from "react";
import { encodeScenario, defaultScenario } from "@borough-ledger/engine";
import type { Status } from "@borough-ledger/schema";
import { formatDay, formatMonthYear } from "@/lib/format";
import type { PageModel, PromiseModel } from "@/lib/model";
import { Num, TestMark } from "./Num";
import { isOverdue, sides } from "@/lib/promises";
import { useLedger } from "./LedgerState";
import { CONTACT } from "@/lib/site";

type Props = Pick<PageModel, "promises" | "today" | "generalBudget" | "balance">;

const LADDER = ["promised", "in_plan", "budgeted", "delivering", "delivered"] as const;
const LABEL: Record<Status, string> = {
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
const VENUE: Record<string, string> = {
  manifesto: "Manifesto",
  leaflet: "Leaflet",
  hustings: "Hustings",
  council_meeting: "Council meeting",
  press: "Press statement",
  social: "Social media",
};
const SINGLE: Partial<Record<Status, string>> = {
  unscoreable: "Unscoreable. No who, how much, when or from where, so it is a slogan.",
  not_in_power: "Opposition pledge. Costed so voters can compare, but it cannot be delivered from opposition.",
  quietly_dropped: "Quietly dropped. The deadline passed with no delivery and no statement.",
  failed: "Failed.",
};
type Filter = "all" | "administration" | "opposition" | "overdue";

/** Timeline event types map onto the ladder; "funded" is the older name for "budgeted". */
const EVENT_CLASS: Record<string, string> = { funded: "budgeted" };

const overdue = isOverdue;

function who(p: PromiseModel): string {
  return p.party ? `${p.actor}, ${p.party}` : p.actor;
}

export function Promises({
  promises,
  today,
  generalBudget,
  balance,
  heading = true,
  limit,
}: Props & { heading?: boolean; /** Show only this many cards, with a link to all of them. */ limit?: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState(promises[0]?.id);
  const { scenario, setToggle } = useLedger();

  // One rule for every side: the filter reads `side` from data, never a party name; labels name the parties from the data.
  const overdueCount = promises.filter((p) => overdue(p, today)).length;
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: promises.length },
    ...sides(promises).map((g) => ({ id: g.id as Filter, label: g.label, count: g.count })),
    ...(overdueCount ? [{ id: "overdue" as Filter, label: "Overdue", count: overdueCount }] : []),
  ];
  const all = promises.filter((p) => filter === "all" || (filter === "overdue" ? overdue(p, today) : p.side === filter));
  const list = limit ? all.slice(0, limit) : all;
  const current = list.find((p) => p.id === sel) ?? list[0];

  return (
    <section id="promises" aria-labelledby="promises-h">
      {heading ? (
        <div className="sec-head">
          <h2 id="promises-h">Promises</h2>
          <p>
            Each party&rsquo;s headline pledges from its 2026 manifesto, quoted word for word, with the cost to the council and a timeline that ends in
            delivery or in silence. <a href="/promises">All promises</a>, and <a href="/wards">your ward&rsquo;s councillors</a>.
          </p>
        </div>
      ) : (
        <h2 id="promises-h" className="sr-only">
          Promises
        </h2>
      )}
      <div className="promises">
        <div>
          <div className="filters" role="group" aria-label="Filter promises">
            {filters.map((f) => (
              <button key={f.id} type="button" className="chip" aria-pressed={f.id === filter} onClick={() => setFilter(f.id)}>
                {f.label} <span className="count">{f.count}</span>
              </button>
            ))}
          </div>
          <div className="plist">
            {list.length ? (
              list.map((p) => (
                <button key={p.id} type="button" className="pcard" aria-pressed={p.id === current?.id} onClick={() => setSel(p.id)}>
                  <div className="who">
                    <span>{who(p)}</span>
                    <span>{formatDay(p.made_on)}</span>
                  </div>
                  <div className="txt">&ldquo;{p.text}&rdquo;</div>
                  <div className="meta">
                    <span className={`pill st-${p.status}`}>{LABEL[p.status]}</span>
                    <span>
                      {p.cost ? (
                        <>
                          <Num f={p.cost.low} fmt="m1" />
                          {" to "}
                          <Num f={p.cost.high} fmt="m1" /> a year
                        </>
                      ) : p.capital ? (
                        <>
                          <Num f={p.capital.central} fmt="m1" /> capital
                        </>
                      ) : (
                        "Cost not stated"
                      )}
                    </span>
                    {p.deadline ? <span>Due {formatMonthYear(p.deadline)}</span> : null}
                    {p.editorCheck ? <span className="checkmark">Awaiting editor check</span> : null}
                    {p.test ? <TestMark what={`promise card ${p.id}`}>Test card</TestMark> : null}
                  </div>
                </button>
              ))
            ) : (
              <p className="muted" style={{ padding: "16px 0" }}>
                No promises match this filter.
              </p>
            )}
            {limit && all.length > list.length ? (
              <a className="linkbtn more" href={filter === "administration" || filter === "opposition" ? `/promises?side=${filter}` : "/promises"}>
                See all {all.length} promises
              </a>
            ) : null}
          </div>
        </div>
        {current ? (
          <Detail
            p={current}
            today={today}
            generalBudget={generalBudget}
            toggle={balance.toggles.find((t) => t.id === current.lever_or_toggle_id)}
            toggleOn={current.lever_or_toggle_id ? scenario.toggles[current.lever_or_toggle_id] : undefined}
            onTry={(id, on) => {
              // On the full statement, change the tool in place; elsewhere, open a balance-it link with this choice.
              if (document.getElementById("balance")) {
                setToggle(id, on);
                location.hash = "#balance";
              } else {
                const s = defaultScenario(balance.input);
                s.toggles[id] = on;
                const code = encodeScenario(balance.input, s);
                location.href = `/balance${code ? `?s=${code}` : ""}`;
              }
            }}
          />
        ) : (
          <div className="detail" />
        )}
      </div>
    </section>
  );
}

export function Detail({
  p,
  today,
  generalBudget,
  toggle,
  toggleOn,
  onTry,
  heading = "h3",
}: {
  /** The pledge is the page's main heading on its own card page, a sub-heading elsewhere. */
  heading?: "h1" | "h3";
  p: PromiseModel;
  today: string;
  generalBudget: PageModel["generalBudget"];
  toggle: PageModel["balance"]["toggles"][number] | undefined;
  toggleOn: boolean | undefined;
  onTry: (id: string, on: boolean) => void;
}) {
  const single = SINGLE[p.status];
  const idx = LADDER.indexOf(p.status as (typeof LADDER)[number]);
  const timeline = [...p.timeline.map((e) => ({ ...e, today: false })), { date: today, type: "today", event: "", today: true }].sort((a, z) =>
    a.date.localeCompare(z.date),
  );
  return (
    <div className="detail">
      <div style={{ display: "grid", gap: 6 }}>
        <span className="muted small">
          {who(p)}, {p.area}
        </span>
        {(() => {
          const H = heading;
          return <H style={{ fontSize: 20, letterSpacing: "-.02em", lineHeight: 1.3, margin: 0 }}>&ldquo;{p.text}&rdquo;</H>;
        })()}
        <span className="muted small">
          {VENUE[p.venue] ?? p.venue}, {formatDay(p.made_on)}
          {p.page ? `, page ${p.page}` : ""}
          {p.editorCheck ? <span className="checkmark"> Awaiting editor check</span> : null}
        </span>
        {p.test ? <TestMark what={`promise card ${p.id}`}>Test card with an invented actor</TestMark> : null}
      </div>
      {single ? (
        <div className="ladder single">
          <span>{single}</span>
        </div>
      ) : (
        <div className="ladder" aria-label={`Status: ${LABEL[p.status]}`}>
          {LADDER.map((s, i) => (
            <span key={s} className={i === idx ? "on" : i < idx ? "past" : undefined}>
              {LABEL[s]}
            </span>
          ))}
        </div>
      )}
      {p.cost ? (
        <div className="trio">
          <div>
            <span className="l">A year</span>
            <span className="n">
              <Num f={p.cost.central} fmt="m1" />
            </span>
            <span className="r">
              range <Num f={p.cost.low} fmt="m1" /> to <Num f={p.cost.high} fmt="m1" />
            </span>
          </div>
          <div>
            <span className="l">Per Band D home</span>
            <span className="n">
              <Num f={p.cost.perBandD} fmt="gbp0" />
            </span>
            <span className="r">a year</span>
          </div>
          <div>
            <span className="l">Share of budget</span>
            <span className="n">
              <Num f={p.cost.share} fmt="share1" />
            </span>
            <span className="r">
              of the <Num f={generalBudget} fmt="m0" /> it funds itself
            </span>
          </div>
        </div>
      ) : null}
      {!p.cost && p.capital ? (
        <div className="trio">
          <div>
            <span className="l">Capital, over the term</span>
            <span className="n">
              <Num f={p.capital.central} fmt="m1" />
            </span>
            <span className="r">{p.capital.note ?? "one-off investment"}</span>
          </div>
          <div>
            <span className="l">Per Band D home</span>
            <span className="n">
              <Num f={p.capital.perBandD} fmt="gbp0" />
            </span>
            <span className="r">once, not a year</span>
          </div>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 2 }}>
        <span className="muted small">Paid for by</span>
        <span>{p.funded_by ?? "Not stated"}</span>
      </div>
      <ol className="timeline">
        {timeline.map((e, i) => (
          <li key={i} className={`t-${e.today ? "today" : (EVENT_CLASS[e.type] ?? e.type)}`}>
            <time className="d" dateTime={e.date}>
              {e.today ? "Today" : formatMonthYear(e.date)}
            </time>
            <span className="dot" />
            <span>
              {e.event}
              {"evidence_url" in e && e.evidence_url ? (
                <>
                  {" "}
                  <a className="small" href={e.evidence_url}>
                    Source
                  </a>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <div className="actions">
        <a className="linkbtn" href={`/promise/${p.id}`}>
          Open the full card
        </a>
        {toggle && toggleOn !== undefined ? (
          <button type="button" className="btn" onClick={() => onTry(toggle.id, !toggleOn)}>
            {toggleOn ? "See next year without it" : "See next year with it"}
          </button>
        ) : null}
        <a className="btn secondary" href={`/promise/${p.id}/feed.xml`} type="application/rss+xml">
          Follow by RSS
        </a>
        <a className="linkbtn" href={`mailto:${CONTACT}?subject=${encodeURIComponent(`Evidence for ${p.id}`)}`}>
          Send evidence
        </a>
      </div>
      {p.sources.length ? (
        <div style={{ display: "grid", gap: 4 }} className="small">
          <span className="muted">Sources</span>
          {p.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener">
              {s.title}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** One card on its own page: the panel from the list, opening balance-it links instead of changing the tool in place. */
export function PromiseCardView({ p, today, generalBudget, balance }: { p: PromiseModel } & Pick<PageModel, "today" | "generalBudget" | "balance">) {
  const toggle = balance.toggles.find((t) => t.id === p.lever_or_toggle_id);
  return (
    <Detail
      heading="h1"
      p={p}
      today={today}
      generalBudget={generalBudget}
      toggle={toggle}
      toggleOn={toggle?.on}
      onTry={(id, on) => {
        const s = defaultScenario(balance.input);
        s.toggles[id] = on;
        const code = encodeScenario(balance.input, s);
        location.href = `/balance${code ? `?s=${code}` : ""}`;
      }}
    />
  );
}
