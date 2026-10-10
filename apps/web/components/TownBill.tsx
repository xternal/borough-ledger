import { derive } from "@borough-ledger/schema";
import type { TownModel } from "@/lib/boroughs";
import { DataTable } from "./ChartTable";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

/** A town with a town council of its own inside a district (Henley-on-Thames): the whole bill there, split between every
    body that sets part of it, and who represents the town on each council. */
export function TownBill({ t, council, county, yearLabel }: { t: TownModel; council: string; county: string | null; yearLabel: string }) {
  const parties = new Set(t.ward?.councillors.map((c) => c.party));
  const oneParty = parties.size === 1 ? [...parties][0] : null;
  return (
    <section id={t.id} aria-labelledby={`${t.id}-h`}>
      <div className="sec-head">
        <h2 id={`${t.id}-h`}>{t.town}</h2>
        <p>
          A Band D home in {t.town} pays <Num f={t.whole} fmt="gbp2" /> in {yearLabel}: the bill above, plus <Num f={t.townPart} fmt="gbp2" /> for {t.council}.
        </p>
      </div>
      <DataTable
        caption={`Who sets a Band D bill in ${t.town}, ${yearLabel}`}
        head={["", "Band D", "Share of the bill"]}
        rows={t.parts.map((x) => ({
          key: x.id,
          cells: [x.label, <Num key="v" f={x.f} fmt="gbp2" />, <Num key="s" f={derive(x.f.value / t.whole.value, x.f, t.whole)} fmt="share1" />],
        }))}
        foot={["Whole bill", <Num key="v" f={t.whole} fmt="gbp2" />, "100%"]}
      />
      <h3>Who represents {t.town}</h3>
      <ul>
        {t.ward ? (
          <li>
            On {council}, {t.ward.name} ward:{" "}
            {t.ward.councillors.map((c, i) => (
              <span key={c.name}>
                {i ? (i === t.ward!.councillors.length - 1 ? " and " : ", ") : ""}
                {c.name}
                {oneParty ? "" : ` (${c.party})`}
              </span>
            ))}
            {oneParty ? ` (${t.ward.councillors.length > 2 ? "all " : t.ward.councillors.length === 2 ? "both " : ""}${oneParty})` : ""}.{" "}
            <a href={`#ward-${t.ward.id}`}>How the ward voted</a>.
          </li>
        ) : null}
        {county && t.divisions.length ? (
          <li>
            On {county}
            {t.divisions.length > 1 ? `, the town is split between ${["", "", "two", "three", "four"][t.divisions.length] ?? t.divisions.length} divisions: ` : ": "}
            {t.divisions.map((d, i) => (
              <span key={d.division}>
                {i ? (i === t.divisions.length - 1 ? " and " : ", ") : ""}
                {d.division}, {d.councillor} ({d.party})
              </span>
            ))}
            .
          </li>
        ) : null}
        <li>
          {t.council} has councillors of its own, who set its part of the bill: <Num f={t.townPart} fmt="gbp2" /> at Band D.
        </li>
      </ul>
      <div className="qrow">
        <QualityGroup q={t.quality} text={t.methodNote} />
      </div>
    </section>
  );
}
