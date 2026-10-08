import { Fragment } from "react";
import { derive, type Figure } from "@borough-ledger/schema";
import type { PageModel, WaterfallRowModel } from "@/lib/model";
import { Num } from "./Num";
import { SavingsList } from "./SavingsList";
import { QualityLegend } from "./QualityLegend";
import { ChartTable, DataTable, type TableLine } from "./ChartTable";

const CLOSING = new Set<WaterfallRowModel["kind"]>(["close", "close_saving", "close_oneoff"]);

function heading(kind: WaterfallRowModel["kind"]): string | null {
  if (kind === "pressure") return "What changed in costs";
  if (kind === "funding") return "What changed in funding";
  if (CLOSING.has(kind)) return "How it was closed";
  return null;
}

const CLOSED_WITH: Partial<Record<WaterfallRowModel["kind"], string>> = {
  close: "more council tax",
  close_saving: "savings",
  close_oneoff: "a one-off draw on reserves",
};

function sum(rows: WaterfallRowModel[]): Figure | null {
  const [first, ...rest] = rows.map((r) => r.f);
  return first ? derive(rows.reduce((a, r) => a + r.f.value, 0), first, ...rest) : null;
}

function joinAnd(xs: string[]): string {
  return xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** Each step with the gap left after it, grouped as in the chart. */
function stepTable(rows: WaterfallRowModel[]): TableLine[] {
  const out: TableLine[] = [];
  const seen: Figure[] = [];
  const groups = new Set<string>();
  let run = 0;
  rows.forEach((r, i) => {
    const h = heading(r.kind);
    if (h && !groups.has(h)) {
      groups.add(h);
      out.push({ key: `g${i}`, group: h });
    }
    const step = r.kind !== "subtotal" && r.kind !== "total";
    if (step) {
      run += r.f.value;
      seen.push(r.f);
    }
    const after = step ? derive(run, seen[0]!, ...seen.slice(1)) : r.f;
    out.push({ key: String(i), cells: [r.label, step ? <Num key="c" f={r.f} fmt="sm1" /> : "", <Num key="a" f={after} fmt="m1" />] });
  });
  return out;
}

export function Waterfall({ m }: { m: PageModel }) {
  const { rows, maxM } = m.waterfall;
  const pct = (x: number) => `${((x / maxM) * 100).toFixed(2)}%`;
  const shown = new Set<string>();
  const costs = sum(rows.filter((r) => r.kind === "pressure"));
  const fundingLoss = sum(rows.filter((r) => r.kind === "funding"));
  const abs = (f: Figure): Figure => ({ ...f, value: Math.abs(f.value) });
  const closedWith = [...new Set(rows.filter((r) => CLOSING.has(r.kind)).map((r) => CLOSED_WITH[r.kind]!))];
  return (
    <section id="gap" aria-labelledby="gap-h">
      <div className="sec-head">
        <h2 id="gap-h">How this year&rsquo;s gap opened and closed</h2>
        <p>
          {costs ? (
            <>
              Costs {costs.value >= 0 ? "rose" : "fell"} by <Num f={abs(costs)} fmt="m1" />
              {fundingLoss ? (
                <>
                  {" "}and the council&rsquo;s funding {fundingLoss.value >= 0 ? "fell" : "rose"} by <Num f={abs(fundingLoss)} fmt="m1" />
                </>
              ) : null}
              , leaving a <Num f={m.waterfall.gap} fmt="m1" /> gap.{" "}
            </>
          ) : null}
          The council closed it with {joinAnd(closedWith)}.
        </p>
      </div>
      <div className="wf">
        {rows.map((r, i) => {
          const h = heading(r.kind);
          const head = h && !shown.has(h) ? (shown.add(h), h) : null;
          return (
            <Fragment key={i}>
              {head ? <div className="wf-group">{head}</div> : null}
              <div className={`wf-row ${r.kind}`}>
                <span className="wf-l">
                  {r.label}
                  {r.f.quality === "sourced" && r.kind !== "subtotal" && r.kind !== "total" ? (
                    <>
                      {" "}
                      <span className="q sourced" title="sourced" />
                    </>
                  ) : null}
                </span>
                <div className="wf-track" aria-hidden="true">
                  <i style={{ left: r.kind === "total" ? pct(0) : pct(r.from), width: r.kind === "total" ? "2px" : pct(r.to - r.from) }} />
                </div>
                <span className="wf-v">
                  <Num f={r.f} fmt={r.kind === "subtotal" || r.kind === "total" ? "m1" : "sm1"} />
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
      <ChartTable summary="Show the gap as a table">
        <DataTable caption={`How the ${m.place.yearLabel} gap opened and closed, £m`} head={["Step", "Change", "Gap after this step"]} rows={stepTable(rows)} />
      </ChartTable>
      <QualityLegend items={m.qualityLegend.gap} />
      <SavingsList savings={m.savings} place={m.place} />
    </section>
  );
}
