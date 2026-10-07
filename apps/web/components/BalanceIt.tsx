"use client";

import { useEffect, useState } from "react";
import { derive, fig, worst, type Figure, type Lever, type LeverId } from "@borough-ledger/schema";
import { billFor, computeBalance, encodeScenario, leverValue, mediumTerm, nextYearCouncil, type MediumTermYear, type PartId } from "@borough-ledger/engine";
import { formatLever } from "@/lib/format";
import type { PageModel } from "@/lib/model";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";
import { useLedger } from "./LedgerState";

type Props = Pick<PageModel, "balance" | "bill" | "rules" | "place">;

const PART: Record<PartId, { label: string; colour: string }> = {
  council_tax: { label: "Council tax", colour: "var(--fund)" },
  fees: { label: "Fees and parking", colour: "color-mix(in srgb,var(--fund) 60%,var(--bg))" },
  settlement: { label: "Government settlement", colour: "color-mix(in srgb,var(--fund) 35%,var(--bg))" },
  savings: { label: "Savings", colour: "var(--spend)" },
  services: { label: "Service choices", colour: "color-mix(in srgb,var(--spend) 55%,var(--bg))" },
  reserves: { label: "Reserves, one-off", colour: "hatch" },
};

export function BalanceIt({ balance, bill, rules, place }: Props) {
  const { band, singlePerson, scenario, setLever, setToggle } = useLedger();
  const r = computeBalance(balance.input, scenario);
  // Outcomes depend on the gap and every choice; each lever's own effect carries only that lever's provenance.
  const q = balance.computed;
  const at = (value: number): Figure => ({ ...q, value });
  const byLever = (id: LeverId, value: number): Figure => derive(value, balance.coef[id]);
  const toggleQ = fig(0, worst(...balance.toggles.map((t) => t.quality)), ...balance.toggles.map((t) => t.source_id));
  const PART_LEVER: Partial<Record<PartId, LeverId>> = { council_tax: "ct_rise", fees: "fees", settlement: "settlement", savings: "savings", reserves: "reserves" };
  const partFig = (id: PartId, value: number): Figure => {
    const lever = PART_LEVER[id];
    return lever ? byLever(lever, value) : derive(value, toggleQ);
  };

  const current = billFor(rules, { council: bill.council.value, gla: bill.gla.value }, band, singlePerson);
  const ctRise = leverValue(scenario, balance.levers.find((l) => l.id === "ct_rise")!);
  const nextCouncil = derive(nextYearCouncil(current.council, ctRise), bill.council, bill.ratios);
  const nowCouncil = derive(current.council, bill.council, bill.ratios);

  const status =
    r.status === "balanced"
      ? { c: "ok", t: "Balanced", f: at(0) }
      : r.status === "short"
        ? { c: "short", t: "Still to find", f: at(r.remainingM) }
        : { c: "spare", t: "Spare", f: at(-r.remainingM) };
  const scale = Math.max(balance.input.gapM, r.closedM);
  const general = balance.input.reserves.general_m;
  const forecast = balance.strip.filter((y) => y.gap).map((y) => ({ year: y.year, gapM: y.gap!.value }));
  const years = mediumTerm(balance.input, forecast, scenario);

  // Keep a shared /balance link in step with the choices, so reloading or copying the address keeps them.
  const code = encodeScenario(balance.input, scenario);
  const path = `/balance${code ? `?s=${code}` : ""}`;
  useEffect(() => {
    if (window.location.pathname === "/balance") window.history.replaceState(null, "", path);
  }, [path]);
  const [copied, setCopied] = useState<"idle" | "copied" | "manual">("idle");
  useEffect(() => setCopied("idle"), [path]);
  const copy = () => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard?.writeText(url).then(
      () => setCopied("copied"),
      () => setCopied("manual"),
    ) ?? setCopied("manual");
  };

  function hint(l: Lever, v: number) {
    const raised = byLever(l.id, v * l.m_per_unit);
    switch (l.id) {
      case "ct_rise": {
        const assumed = balance.ctAssumed;
        const diff = byLever(l.id, (v - (assumed?.value ?? 0)) * l.m_per_unit);
        return (
          <>
            Band {band}: <Num f={nextCouncil} fmt="gbp2" /> next year, {v > 0 ? "+" : ""}
            <Num f={derive(nextCouncil.value - nowCouncil.value, nextCouncil, nowCouncil)} fmt="gbp2" />.{" "}
            {!assumed ? (
              <>
                Raises <Num f={raised} fmt="m1" />.
              </>
            ) : Math.abs(diff.value) < 1e-9 ? (
              "The forecast already assumes this rise."
            ) : (
              <>
                Raises <Num f={{ ...diff, value: Math.abs(diff.value) }} fmt="m1" /> {diff.value > 0 ? "more" : "less"} than the forecast assumes.
              </>
            )}
            {balance.referendumNote ? <span title={balance.referendumNote.text}> No referendum limit for {place.short} in {place.nextYearLabel}.</span> : null}
          </>
        );
      }
      case "settlement":
        return v === 0 ? "Assumes a flat cash settlement" : <><Num f={raised} fmt="sm1" /> to the council</>;
      case "fees":
        return <>Raises <Num f={raised} fmt="m1" /></>;
      case "reserves":
        return <>Leaves <Num f={derive(general - v * l.m_per_unit, balance.reservesGeneral, balance.coef.reserves)} fmt="m1" /> in reserves</>;
      case "savings":
        return "Cuts or efficiencies, to be named";
    }
  }

  return (
    <section id="balance" aria-labelledby="balance-h">
      <div className="sec-head">
        <h2 id="balance-h">Balance next year&rsquo;s budget</h2>
        <p>
          {balance.ctAssumed ? (
            <>
              In the council&rsquo;s own forecast, {place.nextYearLabel} starts with a <Num f={balance.gap} fmt="m1" /> gap, after the{" "}
              <Num f={balance.ctAssumed} fmt="pct2" /> council tax rise it already assumes. Every choice below changes that.
            </>
          ) : (
            <>
              {place.nextYearLabel} starts with a <Num f={balance.gap} fmt="m1" /> gap. Every choice closes part of it.
            </>
          )}{" "}
          Reserves close it once; the gap returns the year after.
        </p>
      </div>
      <div className="balance">
        <div className="levers">
          {balance.levers.map((l) => {
            const v = leverValue(scenario, l);
            const over = l.id === "ct_rise" && r.flags.referendum;
            return (
              <div className="lever" key={l.id}>
                <div className="top">
                  <label htmlFor={`lv-${l.id}`}>{l.label}</label>
                  <span className={over ? "val over" : "val"}>{formatLever(l.unit, v, l.id === "settlement")}</span>
                </div>
                <input
                  type="range"
                  id={`lv-${l.id}`}
                  min={l.min}
                  max={l.max}
                  step={l.step}
                  value={v}
                  list={l.marks ? `marks-${l.id}` : undefined}
                  onChange={(e) => setLever(l.id, Number(e.target.value))}
                />
                {l.marks ? (
                  <datalist id={`marks-${l.id}`}>
                    {l.marks.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                ) : null}
                <div className="hint">
                  <span>{hint(l, v)}</span>
                  <b>{l.controlled_by === "government" ? "Decided by government" : "Council decides"}</b>
                </div>
              </div>
            );
          })}
          <div className="toggles">
            <h3 style={{ marginBottom: 2 }}>Services and pledges</h3>
            {balance.toggles.map((t) => (
              <div className="check" key={t.id}>
                <label>
                  <input type="checkbox" id={`tg-${t.id}`} checked={scenario.toggles[t.id] ?? t.on} onChange={(e) => setToggle(t.id, e.target.checked)} />
                  {t.label}
                </label>
                <span>
                  <Num f={fig(t.cost_m, t.quality, t.source_id)} fmt="m1" /> a year
                </span>
              </div>
            ))}
            {balance.pendingToggles.length ? (
              <p className="muted small">
                Coming once their cost is found in the council&rsquo;s papers: {balance.pendingToggles.join(", ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}.
              </p>
            ) : null}
          </div>
        </div>
        <aside className="result" aria-live="polite">
          <div>
            <div className={`status ${status.c}`}>{status.t}</div>
            <div className="big">
              <Num f={status.f} fmt="mAuto" />
            </div>
            <div className="muted small">
              of a <Num f={balance.gap} fmt="m1" /> gap in {place.nextYearLabel}
            </div>
          </div>
          <div className="stackbar" aria-hidden="true">
            {r.parts
              .filter((p) => p.m > 0.001)
              .map((p) => (
                <i
                  key={p.id}
                  className={PART[p.id].colour === "hatch" ? "hatch" : undefined}
                  style={{ width: `${((p.m / scale) * 100).toFixed(2)}%`, background: PART[p.id].colour === "hatch" ? undefined : PART[p.id].colour }}
                />
              ))}
            {r.status === "short" ? (
              <i style={{ width: `${((r.remainingM / scale) * 100).toFixed(2)}%`, background: "transparent", boxShadow: "inset 0 0 0 1.5px var(--bad)", borderRadius: 3 }} />
            ) : null}
          </div>
          <div className="keys">
            {r.parts.map((p) => (
              <div key={p.id}>
                <span className={PART[p.id].colour === "hatch" ? "sw hatch" : "sw"} style={PART[p.id].colour === "hatch" ? undefined : { background: PART[p.id].colour }} />
                <span>{PART[p.id].label}</span>
                <span>
                  <Num f={partFig(p.id, p.m)} fmt="sm1" />
                </span>
              </div>
            ))}
          </div>
          <div className="kv">
            <span>
              Your council part, Band {band}
              {singlePerson ? ", single person" : ""}
            </span>
            <span>
              <Num f={nextCouncil} fmt="gbp2" />
            </span>
          </div>
          <div className="meter">
            <div className="kv">
              <span>Reserves left</span>
              <span>
                <Num f={derive(r.reservesLeftM, balance.reservesGeneral, balance.coef.reserves)} fmt="m1" />
              </span>
            </div>
            <div className="m" aria-hidden="true">
              <i style={{ width: `${Math.max(0, (r.reservesLeftM / general) * 100).toFixed(1)}%` }} />
              <b style={{ left: `${((balance.input.reserves.minimum_safe_m / general) * 100).toFixed(1)}%` }} />
            </div>
            <div className="muted small">Red line: safe minimum</div>
          </div>
          <Flags r={r} ctRise={ctRise} balance={balance} place={place} at={(v) => byLever("reserves", v)} />
          <Strip strip={balance.strip} years={years} q={q} />
          <div className="share">
            <button type="button" className="btn secondary" onClick={copy}>
              Copy a link to these choices
            </button>
            <span className="small muted" aria-live="polite">
              {copied === "copied" ? "Link copied" : copied === "manual" ? `Copy this link: ${window.location.origin}${path}` : null}
            </span>
          </div>
          <div className="qrow" style={{ paddingTop: 0 }}>
            <QualityGroup q={q.quality} text="Gap, costs and yields" />
          </div>
        </aside>
      </div>
    </section>
  );
}

/** The next three years if nothing else changes: recurring choices keep saving, one-off money comes back. */
function Strip({ strip, years, q }: { strip: PageModel["balance"]["strip"]; years: MediumTermYear[]; q: Figure }) {
  const max = Math.max(1, ...years.map((y) => Math.abs(y.remainingM)));
  return (
    <div className="strip" aria-label="The next three years if nothing else changes">
      <div className="muted small">If nothing else changes</div>
      <div className="strip-years">
        {strip.map((cell) => {
          const y = years.find((x) => x.year === cell.year);
          if (!cell.gap || !y)
            return (
              <div className="strip-year" key={cell.year}>
                <span className="y">{cell.label}</span>
                <span className="s">Not yet forecast by the council</span>
              </div>
            );
          const f = derive(Math.abs(y.remainingM), q, cell.gap);
          const word = y.status === "short" ? "to find" : y.status === "spare" ? "spare" : "balanced";
          const width = (Math.abs(y.remainingM) / max) * 100;
          const back = y.status === "short" ? Math.min(100, (y.comesBackM / Math.abs(y.remainingM)) * 100) : 0;
          return (
            <div className="strip-year" key={cell.year}>
              <span className="y">{cell.label}</span>
              <span className={`n ${y.status}`}>{y.status === "balanced" ? "£0.0m" : <Num f={f} fmt="mAuto" />}</span>
              <span className="s">{word}</span>
              <span className="bar" aria-hidden="true">
                <i className={y.status} style={{ width: `${width.toFixed(1)}%` }}>
                  {back > 0 ? <b className="hatch" style={{ width: `${back.toFixed(1)}%` }} /> : null}
                </i>
              </span>
              {y.comesBackM > 0 ? (
                <span className="s">
                  including <Num f={derive(y.comesBackM, q)} fmt="m1" /> of reserves coming back
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Flags({
  r,
  ctRise,
  balance,
  place,
  at,
}: {
  r: ReturnType<typeof computeBalance>;
  ctRise: number;
  balance: PageModel["balance"];
  place: PageModel["place"];
  at: (v: number) => Figure;
}) {
  const flags: { c: "bad" | "warn"; body: React.ReactNode }[] = [];
  if (r.flags.referendum && balance.referendumLimit)
    flags.push({
      c: "bad",
      body: (
        <>
          A {formatLever("%", ctRise, false)} rise reaches the <Num f={balance.referendumLimit} fmt="pct0" /> referendum threshold. The council would
          have to hold a local referendum.
        </>
      ),
    });
  if (r.flags.oneOffM > 0)
    flags.push({
      c: "warn",
      body: (
        <>
          <Num f={at(r.flags.oneOffM)} fmt="m1" /> from reserves is one-off. The same amount reappears in the {place.yearAfterLabel} gap.
        </>
      ),
    });
  if (r.flags.belowSafeMinimum)
    flags.push({
      c: "bad",
      body: (
        <>
          Reserves fall below the <Num f={balance.reservesMin} fmt="m0" /> safe minimum.
        </>
      ),
    });
  if (r.flags.section114)
    flags.push({
      c: "bad",
      body: "A council cannot set an unbalanced budget. Without a plan, the finance director must issue a section 114 notice.",
    });
  if (!flags.length) return null;
  return (
    <div className="flags">
      {flags.map((f, i) => (
        <div key={i} className={`flag ${f.c}`}>
          {f.body}
        </div>
      ))}
    </div>
  );
}
