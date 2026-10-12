import { placeOf, pence, type ServiceComparison } from "@/lib/makeYourCase";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

/** How much of the money a London borough pays for itself goes on one service, beside the others: priorities, not
    efficiency. After fees and charges, so a council that collects more for a service than it spends shows below zero. */
export function ServiceCompare({ cmp, council }: { cmp: ServiceComparison; council: string }) {
  const lo = Math.min(cmp.low.f.value, 0);
  const span = cmp.high.f.value - lo || 1;
  const at = (v: number) => `${(((v - lo) / span) * 100).toFixed(1)}%`;
  return (
    <div className="myc-compare">
      <p>
        Of every £1 {council} pays for itself in {cmp.yearLabel}, {pence(cmp.f.value)} goes on {cmp.label.toLowerCase()} (<Num f={cmp.m} fmt="m1" />
        ): {placeOf(cmp.rank, cmp.of)} London boroughs. The borough in the middle puts {pence(cmp.median.value)}.
      </p>
      <div className="myc-range" aria-hidden="true">
        <i className="track" />
        <i className="mid" style={{ left: at(cmp.median.value) }} />
        <i className="dot" style={{ left: at(cmp.f.value) }} />
      </div>
      <div className="myc-ends small muted">
        <span>
          {cmp.low.name} {pence(cmp.low.f.value)}
        </span>
        <span>
          {cmp.high.name} {pence(cmp.high.f.value)}
        </span>
      </div>
      <p className="small muted">
        This compares priorities, not value for money: what each council spends after fees and charges and after grants tied to the service, from its budget
        return to government.
        {cmp.low.f.value < 0 ? ` Below zero means the fees and charges a council collects for the service are more than it spends on it (${cmp.low.name}).` : ""}
      </p>
      <div className="qrow">
        <QualityGroup q={cmp.f.quality} text={`Budget returns to government, ${cmp.yearLabel}`} />
      </div>
    </div>
  );
}
