import type { PageModel } from "@/lib/model";
import { ALLOW_TEST_DATA } from "@/lib/quality";
import { Num } from "./Num";
import { HeroTop } from "./HeroTop";

export function Hero({ m }: { m: PageModel }) {
  const { bill, place, balance } = m;
  const kpis: { l: string; v: React.ReactNode; s: React.ReactNode }[] = [
    { l: "Band D bill", v: <Num f={bill.total} fmt="gbp0" />, s: <>up <Num f={bill.risePct} fmt="pct1" /> on last year</> },
    { l: "Council budget", v: <Num f={m.netBudget} fmt="m0" />, s: "day-to-day, including schools" },
    { l: "Paid by council tax", v: <Num f={m.ctShare} fmt="share0" />, s: <><Num f={m.funding.find((f) => f.id === "council_tax")!.f} fmt="m1" /> a year</> },
    { l: "Savings this year", v: <Num f={m.savingsThisYear} fmt="m1" />, s: `to balance ${place.yearLabel}` },
    { l: "Reserves", v: <Num f={balance.reservesGeneral} fmt="m0" />, s: <>safe minimum <Num f={balance.reservesMin} fmt="m0" /></> },
    { l: "Council control", v: m.politics.control, s: <><Num f={m.politics.seats} fmt="int" /> of <Num f={m.politics.totalSeats} fmt="int" /> seats</> },
  ];
  return (
    <>
      <div className="hero">
        <HeroTop current={place.short} council={`${place.short} Council`} example="W6 9JU">
          {m.hasTestData && ALLOW_TEST_DATA ? <span className="tagline">Prototype with test data. Figures underlined in red are invented.</span> : null}
        </HeroTop>
        <h1>Where your council tax goes in {place.short}</h1>
        <p className="lede">
          A Band D home pays <b><Num f={bill.total} fmt="gbp2" /></b> this year, up <Num f={bill.risePct} fmt="pct2" />. Council tax covers about{" "}
          <b><Num f={m.ctShare} fmt="share0" /></b> of what the council spends on day-to-day services. Government grants pay for{" "}
          <Num f={m.grantsShare} fmt="share0" />, including the money passed straight to schools, and business rates for{" "}
          <Num f={m.ratesShare} fmt="share0" />.
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
