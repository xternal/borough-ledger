"use client";

import { BANDS, derive, worst, type Figure } from "@borough-ledger/schema";
import { billFor } from "@borough-ledger/engine";
import type { PageModel } from "@/lib/model";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";
import { useLedger } from "./LedgerState";

type Props = Pick<PageModel, "bill" | "rules" | "services" | "ctShare" | "netBudget" | "place" | "mainOtherFunding">;

export function BillSection({ bill, rules, services, ctShare, netBudget, place, mainOtherFunding }: Props) {
  const { band, singlePerson, setBand, setSinglePerson } = useLedger();
  const b = billFor(rules, { council: bill.council.value, gla: bill.gla.value }, band, singlePerson);
  const inputs: Figure[] = [bill.ratios, ...(singlePerson ? [bill.spd] : [])];
  const council = derive(b.council, bill.council, ...inputs);
  const gla = derive(b.gla, bill.gla, ...inputs);
  const total = derive(b.total, bill.total, ...inputs);
  const pc = (b.council / b.total) * 100;

  const ranked = [...services].sort((a, z) => z.f.value - a.f.value);
  const shares = ranked.map((s) => ({ ...s, share: derive((s.f.value / netBudget.value) * b.council, s.f, netBudget, council) }));
  const max = shares[0]?.share.value ?? 1;
  const [lo, hi] = [Math.min(...bill.instalments.options), Math.max(...bill.instalments.options)];
  const perInstalment = (n: number) => derive(b.total / n, total, bill.instalments.f);

  return (
    <section id="bill" aria-labelledby="bill-h">
      <div className="sec-head">
        <h2 id="bill-h">Your bill</h2>
        <p>
          Pick your band. The council keeps <Num f={bill.councilShare} fmt="share0" /> of it; the rest goes to the Mayor of London.
        </p>
      </div>
      <div className="bill">
        <div className="bill-main">
          <div className="seg" role="group" aria-label="Council tax band">
            {BANDS.map((x) => (
              <button key={x} type="button" aria-pressed={x === band} onClick={() => setBand(x)}>
                {x}
              </button>
            ))}
          </div>
          <div>
            <div className="muted small">
              Band {band}, {place.yearLabel}
              {singlePerson ? ", with single person discount" : ""}
            </div>
            <div className="big" aria-live="polite">
              <Num f={total} fmt="gbp2" />
            </div>
            <div className="muted">
              <Num f={perInstalment(lo)} fmt="gbp2" /> a month over {lo} instalments, or <Num f={perInstalment(hi)} fmt="gbp2" /> over {hi}
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={singlePerson} onChange={(e) => setSinglePerson(e.target.checked)} />
            <span>
              I live alone (<Num f={bill.spd} fmt="share0" /> single person discount)
            </span>
          </label>
          <div className="split">
            <div className="barline" aria-hidden="true">
              <i style={{ width: `${pc}%`, background: "var(--fund)" }} />
              <i style={{ width: `${100 - pc}%`, background: "var(--gla)" }} />
            </div>
            <div className="legend2">
              <span className="sw" style={{ background: "var(--fund)" }} />
              <span>{place.short} Council</span>
              <span className="amt">
                <Num f={council} fmt="gbp2" />
              </span>
              <span className="sw" style={{ background: "var(--gla)" }} />
              <span>Mayor of London (GLA)</span>
              <span className="amt">
                <Num f={gla} fmt="gbp2" />
              </span>
              <span className="sub">{bill.glaNote}</span>
            </div>
          </div>
          <div className="qrow">
            <QualityGroup q={bill.total.quality} text={`Band D bill for ${place.yearLabel}`} />
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: 14 }}>
            Your <Num f={council} fmt="gbp2" /> to the council pays for
          </h3>
          <div className="rows">
            {shares.map((s) => (
              <div className="row" key={s.id}>
                <span>{s.label}</span>
                <span className="v">
                  <Num f={s.share} fmt="gbp0" />
                </span>
                <div className="track" aria-hidden="true">
                  <i style={{ width: `${((s.share.value / max) * 100).toFixed(1)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>
            Split in proportion to the council&rsquo;s net budget. Your council tax pays about <Num f={ctShare} fmt="pence" /> of every £1 the
            council spends; the rest comes from{" "}
            {mainOtherFunding ? `${mainOtherFunding[0].toLowerCase()}, ${mainOtherFunding[1].toLowerCase()} and other funding` : "other funding"}.
          </p>
          <div className="qrow">
            <QualityGroup q={worst(...services.map((s) => s.f.quality))} text="Split by service" />
          </div>
        </div>
      </div>
    </section>
  );
}
