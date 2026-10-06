import { Fragment } from "react";
import type { PageModel, WaterfallRowModel } from "@/lib/model";
import { Num } from "./Num";
import { QualityLegend } from "./QualityLegend";

const CLOSING = new Set<WaterfallRowModel["kind"]>(["close", "close_saving", "close_oneoff"]);

function heading(kind: WaterfallRowModel["kind"]): string | null {
  if (kind === "pressure") return "What pushed costs up";
  if (CLOSING.has(kind)) return "How it was closed";
  return null;
}

export function Waterfall({ m }: { m: PageModel }) {
  const { rows, maxM } = m.waterfall;
  const pct = (x: number) => `${((x / maxM) * 100).toFixed(2)}%`;
  const shown = new Set<string>();
  return (
    <section id="gap" aria-labelledby="gap-h">
      <div className="sec-head">
        <h2 id="gap-h">How this year&rsquo;s gap opened and closed</h2>
        <p>Costs rose faster than funding. The council closed the gap with a council tax rise, savings and a one-off draw on reserves.</p>
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
      <QualityLegend items={m.qualityLegend.gap} />
    </section>
  );
}
