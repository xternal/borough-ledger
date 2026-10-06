import type { PageModel } from "@/lib/model";
import { ALLOW_TEST_DATA } from "@/lib/quality";
import { Num } from "./Num";

export function Hero({ m }: { m: PageModel }) {
  const { bill, place, balance } = m;
  const kpis: { l: string; v: React.ReactNode; s: React.ReactNode }[] = [
    { l: "Band D bill", v: <Num f={bill.total} fmt="gbp0" />, s: <>up <Num f={bill.risePct} fmt="pct1" /> on last year</> },
    { l: "Council budget", v: <Num f={m.netBudget} fmt="m0" />, s: "net, day-to-day" },
    { l: "Paid by council tax", v: <Num f={m.ctShare} fmt="share0" />, s: <><Num f={m.funding.find((f) => f.id === "council_tax")!.f} fmt="m1" /> a year</> },
    { l: "Savings this year", v: <Num f={m.savingsThisYear} fmt="m1" />, s: `to balance ${place.yearLabel}` },
    { l: "Reserves", v: <Num f={balance.reservesGeneral} fmt="m0" />, s: <>safe minimum <Num f={balance.reservesMin} fmt="m0" /></> },
    { l: "Council control", v: m.politics.control, s: <><Num f={m.politics.seats} fmt="int" /> of <Num f={m.politics.totalSeats} fmt="int" /> seats</> },
  ];
  const [a, b] = m.mainOtherFunding ?? [];
  return (
    <>
      <div className="hero">
        <div className="kicker">
          <span>Independent project, not run by or affiliated with {place.short} Council</span>
          {m.hasTestData && ALLOW_TEST_DATA ? <span className="tagline">Prototype with test data. Figures underlined in red are invented.</span> : null}
        </div>
        <h1>Where your council tax goes in {place.short}</h1>
        <p className="lede">
          A Band D home pays <b><Num f={bill.total} fmt="gbp2" /></b> this year, up <Num f={bill.risePct} fmt="pct2" />. Council tax covers about{" "}
          <b><Num f={m.ctShare} fmt="share0" /></b> of what the council spends on services.
          {a && b ? ` ${a} and ${b.toLowerCase()} pay for most of the rest.` : null}
        </p>
      </div>
      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.l}>
            <div className="l">{k.l}</div>
            <div className="v">{k.v}</div>
            <div className="s">{k.s}</div>
          </div>
        ))}
      </div>
    </>
  );
}
