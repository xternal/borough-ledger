import { derive } from "@borough-ledger/schema";
import { versusText, type CareComparison, type careResults } from "@/lib/adultCare";
import { ordinal } from "@/lib/makeYourCase";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

/** How one council's care costs sit among similar councils', and who the money is for. Costs only: how well care works
    (people's satisfaction, the regulator's rating) is not on the site yet, and the block says so. */
export function CareCompare({ cmp, yearLabel, results }: { cmp: CareComparison; yearLabel: string; results?: ReturnType<typeof careResults> }) {
  const { byAge } = cmp;
  const total = derive(byAge.older.value + byAge.workingAge.value, byAge.older, byAge.workingAge);
  return (
    <div className="myc-compare">
      {cmp.units.map((u) => {
        const span = u.high.f.value - u.low.f.value || 1;
        const at = (v: number) => `${(((v - u.low.f.value) / span) * 100).toFixed(1)}%`;
        const fmt = u.per === "week" ? "gbp0" : "gbp2";
        return (
          <div key={u.id} className="myc-unit">
            <p>
              {u.label}: <Num f={u.f} fmt={fmt} />, the {ordinal(u.rank)} lowest of {u.of} {cmp.group}. The one in the middle pays <Num f={u.median} fmt={fmt} />.
            </p>
            <div className="myc-range" aria-hidden="true">
              <i className="track" />
              <i className="mid" style={{ left: at(u.median.value) }} />
              <i className="dot" style={{ left: at(u.f.value) }} />
            </div>
            <div className="myc-ends small muted">
              <span>
                {u.low.name} <Num f={u.low.f} fmt={fmt} />
              </span>
              <span>
                {u.high.name} <Num f={u.high.f} fmt={fmt} />
              </span>
            </div>
          </div>
        );
      })}
      <p>
        Who long-term care is for: people aged 65 and over, <Num f={byAge.older} fmt="m1" /> (<Num f={derive(byAge.older.value / total.value, byAge.older, total)} fmt="share0" />
        ), and adults aged 18 to 64 with a disability or a mental illness, <Num f={byAge.workingAge} fmt="m1" />. In {cmp.moreForWorkingAge.count} of the{" "}
        {cmp.moreForWorkingAge.of} English councils on Borough Book, working-age adults get more.
      </p>
      {results ? (
        <p>
          Does it work? In the government&rsquo;s {results.yearLabel} survey, <Num f={results.items[0]!.f} fmt="share0" /> of people who get care here{" "}
          {results.items[0]!.label}, {versusText(results.items[0]!)}. <a href="#care-results">All three answers, with their margins of error</a>. The care
          regulator&rsquo;s rating of the council is not on Borough Book yet.
        </p>
      ) : (
        <p className="myc-gap small">
          Does it work? How satisfied people are with their care, and the care regulator&rsquo;s rating of the council, are not on Borough Book yet, and a low cost
          is not the same as good value, so this compares costs only.
        </p>
      )}
      <div className="qrow">
        <QualityGroup q={cmp.units[0]?.f.quality ?? byAge.older.quality} text={`Adult social care finance report, ${yearLabel}: the government's own averages for each council`} />
      </div>
    </div>
  );
}
