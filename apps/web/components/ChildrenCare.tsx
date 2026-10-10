/* What care for children costs in a council: how many children it looks after and where they live, and what it spends on
   their care, from the Department for Education. No cost per child for a council: the Department publishes none and
   councils' accounts vary; England's, worked out the National Audit Office's way, is given as context. */
import { derive } from "@borough-ledger/schema";
import type { ChildrenCareModel } from "@/lib/childrenCare";
import { formatDay } from "@/lib/format";
import { ChartTable, DataTable } from "./ChartTable";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

export function ChildrenCare({ care, council, short }: { care: ChildrenCareModel; council: string; short: string }) {
  const max = Math.max(...care.parts.map((p) => p.f.value), 0);
  return (
    <section id="children-care" aria-labelledby="children-care-h">
      <div className="sec-head">
        <h2 id="children-care-h">What care for children costs</h2>
        <p>
          {care.total ? (
            <>
              In {care.yearLabel}, {council} spent <Num f={care.total} fmt="m1" /> on children in its care
              {care.childrensServices ? (
                <>
                  , out of <Num f={care.childrensServices} fmt="m1" /> on all its services for children and young people
                </>
              ) : null}
              .{" "}
            </>
          ) : (
            <>The Department for Education has not published {short}&rsquo;s {care.yearLabel} spending on children in care, over concerns about its quality. </>
          )}
          On {formatDay(care.countDate)} it was looking after <Num f={care.children} fmt="int" /> children:
        </p>
      </div>
      <div className="kpis care-kpis">
        {care.placements.slice(0, 4).map((p) => (
          <div className="kpi" key={p.id}>
            <span className="v">
              <Num f={p.f} fmt="int" />
            </span>
            <span className="s">{p.label}</span>
          </div>
        ))}
      </div>
      {care.placements.length > 4 || care.someWithheld ? (
        <p className="small muted">
          {care.placements.length > 4 ? (
            <>
              Also{" "}
              {care.placements.slice(4).map((p, i, all) => (
                <span key={p.id}>
                  {i ? (i === all.length - 1 ? " and " : ", ") : ""}
                  <Num f={p.f} fmt="int" /> {p.label}
                </span>
              ))}
              .{" "}
            </>
          ) : null}
          {care.someWithheld ? "Some small numbers are withheld by the Department to protect children's identities." : null}
        </p>
      ) : null}
      {care.total ? (
        <>
          <h3 className="care-h">
            Where the <Num f={care.total} fmt="m1" /> went
          </h3>
          <div className="rows">
            {care.parts.map((p) => (
              <div className="row" key={p.id}>
                <span>{p.label}</span>
                <span className="v">
                  <Num f={p.f} fmt="m1" />
                </span>
                <div className="track" aria-hidden="true">
                  <i style={{ width: `${max ? ((p.f.value / max) * 100).toFixed(1) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <ChartTable summary="Show spending on children in care as a table">
            <DataTable
              caption={`${council}: spending on children in care, ${care.yearLabel}`}
              head={["", "Spending", "Share"]}
              rows={care.parts.map((p) => ({
                key: p.id,
                cells: [p.label, <Num key="v" f={p.f} fmt="m1" />, <Num key="s" f={derive(p.f.value / care.total!.value, p.f, care.total!)} fmt="share0" />],
              }))}
              foot={["All spending on children in care", <Num key="v" f={care.total} fmt="m1" />, "100%"]}
            />
          </ChartTable>
        </>
      ) : null}
      <p className="small muted">
        Across England, a year in a children&rsquo;s home costs councils about <Num f={care.englandHomeYear} fmt="gbp0" /> a child: our own sum, done the National
        Audit Office&rsquo;s way, dividing what councils spend on children&rsquo;s homes by the children living in them. Councils record this spending in
        different ways, so we do not work it out for each council. Spending is before income, for {care.yearLabel}; the counts are for one day. From the Department
        for Education&rsquo;s <a href={care.sources[0]?.url}>Section 251 outturn</a> and <a href={care.sources[2]?.url ?? care.sources[1]?.url}>children looked after statistics</a>.
      </p>
      <div className="qrow">
        <QualityGroup q={care.children.quality} text={`Department for Education, ${care.yearLabel}`} />
        <QualityGroup q="modelled" text="England's cost of a year in a children's home: our own sum" />
      </div>
    </section>
  );
}
