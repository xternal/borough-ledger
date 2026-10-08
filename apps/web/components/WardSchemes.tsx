import { DATA } from "@borough-ledger/schema";
import { formatMonth, formatMonthShort } from "@/lib/format";
import { BOROUGH_SPEND, WARD_SPEND, type SchemeView, type WardModel } from "@/lib/wards";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

const SHOWN = 6;
const when = (s: SchemeView) => (s.first === s.last ? formatMonthShort(s.first) : `${formatMonthShort(s.first)} to ${formatMonthShort(s.last)}`);
/** £45.6m for big amounts, £462,042 under a million, so small schemes do not read as £0.5m. */
const Amount = ({ s }: { s: { total: SchemeView["total"] } }) => <Num f={s.total} fmt={Math.abs(s.total.value) >= 1e6 ? "pm1" : "gbp0"} />;

function Rows({ list, names }: { list: SchemeView[]; names: Map<string, string> }) {
  return (
    <ul className="schemes">
      {list.map((s) => (
        <li key={s.label}>
          <span className="sc-l">
            {s.label}
            <span className="small muted block">
              {when(s)}
              {s.others.length ? `, also in ${s.others.map((o) => names.get(o) ?? o).join(" and ")}` : ""}
            </span>
          </span>
          <span className="sc-v">
            <Amount s={s} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** What the council's spend files show it paid for building work in the ward: schemes placed here, and those shared with the wards next door. */
export function WardSchemes({ w, names }: { w: WardModel; names: Map<string, string> }) {
  const { schemes, shared } = w.spend;
  const period = `${formatMonth(WARD_SPEND.first)} to ${formatMonth(WARD_SPEND.last)}`;
  return (
    <section aria-labelledby="build-h" className="ward-sec">
      <h2 id="build-h">Building work paid for in {w.name}</h2>
      {schemes.length ? (
        <>
          <p>
            From {period}, the council&rsquo;s spend files show{" "}
            <b>
              <Amount s={w.spend} />
            </b>{" "}
            paid for {schemes.length === 1 ? "one building scheme" : `${schemes.length} building schemes`} in {w.name}, excluding VAT. Names are as the
            council writes them.
          </p>
          <Rows list={schemes.slice(0, SHOWN)} names={names} />
          {schemes.length > SHOWN ? (
            <details className="more-schemes">
              <summary>All {schemes.length} schemes</summary>
              <Rows list={schemes.slice(SHOWN)} names={names} />
            </details>
          ) : null}
        </>
      ) : (
        <p>No building scheme in the council&rsquo;s spend files from {period} is placed in {w.name} alone.</p>
      )}
      {shared.length ? (
        <>
          <h3 className="small">Along roads and across blocks in {w.name} and next door</h3>
          <p className="small muted">The money is not split between wards, so it is not in the total above.</p>
          <Rows list={shared} names={names} />
        </>
      ) : null}
      <p className="small muted">
        The council&rsquo;s files name each scheme, never its address. We place each one in a ward from its name, using OpenStreetMap and the nearest
        postcodes, and check it by hand. Across the borough,{" "}
        <Num f={BOROUGH_SPEND.total} fmt="pm1" /> was paid for building work in this time: <Num f={BOROUGH_SPEND.place} fmt="pm1" /> on schemes in one
        ward, <Num f={BOROUGH_SPEND.several} fmt="pm1" /> on roads and schemes across wards, <Num f={BOROUGH_SPEND.borough} fmt="pm1" /> on programmes
        everywhere, such as footways and street lights, and <Num f={BOROUGH_SPEND.unknown} fmt="pm1" /> on schemes whose place the name does not
        give. <a href="/payments">See every payment</a>.
      </p>
      <div className="qrow">
        <QualityGroup q={DATA.payments.meta.quality} text="Amounts: the council's own figures, excluding VAT" />
        <QualityGroup
          q={WARD_SPEND.quality}
          text={WARD_SPEND.quality === "sourced" ? "Wards: placed by us from scheme names and checked by hand" : "Wards: placed by us from scheme names, before a final check by hand"}
        />
      </div>
    </section>
  );
}
