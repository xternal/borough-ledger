import { formatMonth, formatPeriod } from "@/lib/format";
import type { PageModel } from "@/lib/model";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

/** The home page's view of the payments ledger: the latest quarter in the council's files, and a way in to every payment. */
export function Payments({ payments: p }: Pick<PageModel, "payments">) {
  const period = formatPeriod(`${p.from}-01`, `${p.to}-01`);
  return (
    <section id="payments" aria-labelledby="payments-h">
      <div className="sec-head">
        <h2 id="payments-h">Payments over £500</h2>
        <p>
          The council publishes every payment over £500, a quarter at a time. The latest quarter here is {period}. Search every payment since{" "}
          {formatMonth(p.firstMonth)} on the <a href="/payments">payments page</a>.
        </p>
      </div>
      <div className="kpis kpis-3">
        <div className="kpi">
          <span className="l">Paid out, {period}</span>
          <span className="v">
            <Num f={p.total} fmt="pm1" />
          </span>
          <span className="s">
            <Num f={{ ...p.total, value: p.rows }} fmt="int" /> payments, excluding VAT
          </span>
        </div>
        <div className="kpi">
          <span className="l">Shown only as totals</span>
          <span className="v">
            <Num f={p.withheld} fmt="pm1" />
          </span>
          <span className="s">
            <Num f={{ ...p.withheld, value: p.withheldRows }} fmt="int" /> payments to people, such as care paid directly to residents. Names are never shown
          </span>
        </div>
        <div className="kpi">
          <span className="l">Organisations paid</span>
          <span className="v">
            <Num f={{ ...p.total, value: p.suppliers }} fmt="int" />
          </span>
          <span className="s">in {p.months} months of the council&rsquo;s files</span>
        </div>
      </div>
      <h3 className="pay-h3">Paid the most, {period}</h3>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Organisation</th>
              <th className="n">Paid</th>
            </tr>
          </thead>
          <tbody>
            {p.top.map((s) => (
              <tr key={s.id}>
                <td>{s.page ? <a href={`/supplier/${s.id}`}>{s.name}</a> : s.name}</td>
                <td className="n">
                  <Num f={s.total} fmt="gbp0" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="more">
        <a className="linkbtn" href="/payments">
          Search every payment
        </a>
      </p>
      <div className="qrow">
        <QualityGroup q={p.total.quality} text="From the council's own quarterly spend files, each checked against its total" />
      </div>
    </section>
  );
}
