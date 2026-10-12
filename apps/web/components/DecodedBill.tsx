import { derive } from "@borough-ledger/schema";
import { DECODER, type DecodedCouncil } from "@/lib/decoder";
import { DataTable } from "./ChartTable";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

/** One council's Band D bill, decoded: who gets each part, and what changed on last year. The bar is a picture of the
    table, which carries every figure in words. */
export function DecodedBill({ c }: { c: DecodedCouncil }) {
  const shown = c.parts.filter((p) => p.f.value > 0);
  return (
    <div className="dc">
      <div className="dc-bar" aria-hidden="true">
        {shown.map((p) => (
          <i key={p.id} className={`dc-${p.id}`} style={{ width: `${(p.share.value * 100).toFixed(2)}%` }} title={`${p.body}: ${p.f.value.toFixed(2)}`} />
        ))}
      </div>
      <ul className="dc-legend">
        {shown.map((p) => (
          <li key={p.id}>
            <span className={`sw dc-${p.id}`} aria-hidden="true" />
            <span>
              <b>{p.body}</b>
              {p.id === "council" ? <span className="muted"> (its own share)</span> : p.id === "parish" ? <span className="muted"> (on average)</span> : null}
            </span>
            <span className="amt">
              <Num f={p.f} fmt="gbp2" />
            </span>
          </li>
        ))}
      </ul>
      <DataTable
        caption={`Band D council tax in ${c.place}, ${DECODER.yearLabel}, and the change on ${DECODER.prevLabel}`}
        head={["Who gets it", "Band D", "Share", "Change", "Change, %"]}
        rows={c.parts.map((p) => ({
          key: p.id,
          cells: [
            p.body,
            <Num key="v" f={p.f} fmt="gbp2" />,
            <Num key="s" f={p.share} fmt="share1" />,
            <Num key="c" f={p.change} fmt="sgbp2" />,
            p.prev.value > 0 ? <Num key="p" f={derive((p.change.value / p.prev.value) * 100, p.f, p.prev)} fmt="pct1" /> : "new",
          ],
        }))}
        foot={["Whole Band D bill", <Num key="v" f={c.total} fmt="gbp2" />, "100%", <Num key="c" f={c.change} fmt="sgbp2" />, <Num key="p" f={c.changePct} fmt="pct1" />]}
      />
      <div className="qrow">
        <QualityGroup q={c.total.quality} text={`Council tax requirement tables, ${DECODER.yearLabel} and ${DECODER.prevLabel}`} />
      </div>
    </div>
  );
}
