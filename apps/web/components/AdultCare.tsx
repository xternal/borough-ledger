/* What care for adults costs in a council: the government's own average costs (a week in a care home, an hour of care at
   home) and where the council's adult care money went, from its return to government. The same for every English
   council on the site. */
import { derive } from "@borough-ledger/schema";
import { versusText, type AdultCareModel, type careResults } from "@/lib/adultCare";
import { ChartTable, DataTable } from "./ChartTable";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

export function AdultCare({ care, council, results }: { care: AdultCareModel; council: string; results?: ReturnType<typeof careResults> }) {
  const max = Math.max(...care.parts.map((p) => p.f.value));
  return (
    <section id="adult-care" aria-labelledby="adult-care-h">
      <div className="sec-head">
        <h2 id="adult-care-h">What care for adults costs</h2>
        <p>
          In {care.yearLabel}, the latest year the government has published, {council} spent <Num f={care.total} fmt="m1" /> on care for older people and for
          adults with a disability or a mental illness, before what people pay towards their own care and money from the NHS. What some of it costs:
        </p>
      </div>
      <div className="kpis care-kpis">
        {care.units.map((u) => (
          <div className="kpi" key={u.id}>
            <span className="l">{u.label}</span>
            <span className="v">
              <Num f={u.f} fmt={u.per === "hour" ? "gbp2" : "gbp0"} />
            </span>
            {u.prev ? (
              <span className="s">
                {u.f.value >= u.prev.value ? "up" : "down"} from <Num f={u.prev} fmt={u.per === "hour" ? "gbp2" : "gbp0"} /> in {care.prevLabel}
              </span>
            ) : null}
          </div>
        ))}
      </div>
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
              <i style={{ width: `${((p.f.value / max) * 100).toFixed(1)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <ChartTable summary="Show adult care spending as a table">
        <DataTable
          caption={`${council}: spending on care for adults, ${care.yearLabel}`}
          head={["", "Spending", "Share"]}
          rows={care.parts.map((p) => ({
            key: p.id,
            cells: [p.label, <Num key="v" f={p.f} fmt="m1" />, <Num key="s" f={derive(p.f.value / care.total.value, p.f, care.total)} fmt="share0" />],
          }))}
          foot={["All care for adults", <Num key="v" f={care.total} fmt="m1" />, "100%"]}
        />
      </ChartTable>
      <p className="small muted">
        From the council&rsquo;s own return to government, published in the <a href={care.source.url}>adult social care finance report</a>. Spending is before
        income, and for {care.yearLabel}, so it differs from this year&rsquo;s budget above. The weekly and hourly costs are the government&rsquo;s own averages
        for the council, not spending divided by people.
      </p>
      <div className="qrow">
        <QualityGroup q={care.total.quality} text={`Adult social care finance report, ${care.yearLabel}`} />
      </div>
      {results ? (
        <>
          <h3 className="care-h" id="care-results">
            What people who get care say
          </h3>
          <p>
            In the government&rsquo;s survey of people who get care and support from their council, {results.yearLabel}, about{" "}
            {results.respondents.toLocaleString("en-GB")} people answered here. Of them:
          </p>
          <ul className="care-results">
            {results.items.map((r) => (
              <li key={r.id}>
                <b>
                  <Num f={r.f} fmt="share0" />
                </b>{" "}
                {r.label} <span className="muted">(give or take {Math.round(r.moe)} points)</span>.{" "}
                {r.london ? (
                  <>
                    London <Num f={r.london.f} fmt="share0" />,{" "}
                  </>
                ) : null}
                England <Num f={r.england.f} fmt="share0" />: {versusText(r)}.
              </li>
            ))}
          </ul>
          <p className="small muted">
            A difference counts as lower or higher only where it is bigger than the survey&rsquo;s margins of error. These are people&rsquo;s own answers, not a
            rating of the council; the care regulator&rsquo;s rating of each council is not on Borough Book yet. From the{" "}
            <a href={results.source.url}>adult social care outcomes framework</a>, {results.yearLabel}.
          </p>
          <div className="qrow">
            <QualityGroup q={results.items[0]!.f.quality} text={`Adult social care survey, ${results.yearLabel}`} />
          </div>
        </>
      ) : null}
    </section>
  );
}
