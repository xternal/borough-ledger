import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATA, derive } from "@borough-ledger/schema";
import { BillSection } from "@/components/BillSection";
import { BudgetFlow } from "@/components/BudgetFlow";
import { ChartTable, DataTable } from "@/components/ChartTable";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { LedgerStateProvider } from "@/components/LedgerState";
import { Num } from "@/components/Num";
import { QualityGroup } from "@/components/QualityLegend";
import { TopBar } from "@/components/TopBar";
import { HeroTop } from "@/components/HeroTop";
import { PostcodeFinder } from "@/components/PostcodeFinder";
import { COVERED, PLACES } from "@/lib/places";
import { BOROUGHS, boroughModel, type BoroughModel } from "@/lib/boroughs";
import { format, formatDay } from "@/lib/format";
import { SITE, SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ borough: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return BOROUGHS.map((b) => ({ borough: b.slug }));
}

const SECTIONS = [
  ["bill", "Your bill"],
  ["budget", "Budget"],
  ["history", "Over the years"],
  ["councillors", "Councillors"],
] as const;

function words(m: BoroughModel) {
  const title = `Where your council tax goes in ${m.place.short} | ${SITE.name}`;
  const description = `${m.place.short}: a Band D council tax bill of ${format("gbp2", m.bill.total.value)} in ${m.place.yearLabel}, split between the council and the Mayor of London; the council's ${format("m0", m.netBudget.value)} budget by service and where the money comes from; council tax over the years; and every ward's councillors and election result. From government returns and the council's own records.`;
  return { title, description };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { borough } = await params;
  const m = boroughModel(borough);
  if (!m) return {};
  const { title, description } = words(m);
  return { title, description, alternates: { canonical: `/${borough}` }, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

/** A borough's wards drawn from the ONS boundaries; each opens its part of the page. */
function BoroughMap({ m }: { m: BoroughModel }) {
  const [w, h] = m.map.view_box;
  const byCode = new Map(m.people.wards.map((x) => [x.ons_code, x]));
  return (
    <figure className="wardmap">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Map of ${m.place.short} and its wards`}>
        {m.map.wards.map((s) => {
          const ward = byCode.get(s.ons_code);
          return (
            <a key={s.ons_code} href={ward ? `#ward-${ward.id}` : undefined} tabIndex={-1}>
              <title>{ward?.name ?? s.ons_name}</title>
              <path d={s.path} className="wm" />
            </a>
          );
        })}
      </svg>
    </figure>
  );
}

export default async function BoroughPage({ params }: Props) {
  const { borough } = await params;
  const m = boroughModel(borough);
  if (!m) notFound();
  const { title, description } = words(m);
  const P = m.people;
  const control = P.parties.find((x) => x.id === P.control);
  const seats = P.councillors.length;
  const fig = (v: number) => ({ value: v, quality: "sourced" as const, sources: [P.sources[0]!.url] });
  const shortOf = new Map(P.parties.map((x) => [x.id, x.short]));
  const vacant = P.wards.reduce((a, w) => a + w.election.seats, 0) - seats;
  const byId = new Map(P.councillors.map((c) => [c.id, c]));
  const first = m.history[0]!;
  const last = m.history[m.history.length - 1]!;
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebPage", name: title.split(" | ")[0], description, url: `${SITE_URL}/${borough}`, inLanguage: "en-GB", about: { "@type": "GovernmentOrganization", name: m.place.council } },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: m.place.short, item: `${SITE_URL}/${borough}` },
      ],
    },
  ];
  return (
    <>
      <TopBar place={m.place.short} year={m.place.yearLabel} borough={{ base: `/${borough}`, items: SECTIONS }} />
      <main className="wrap" id="top">
        <div className="hero">
          <HeroTop current={m.place.short} council={`the ${m.place.council}`} />
          <h1>Where your council tax goes in {m.place.short}</h1>
          <p className="lede">
            A Band D home pays <Num f={m.bill.total} fmt="gbp2" /> this year, up <Num f={m.bill.risePct} fmt="pct1" />. Council tax covers about{" "}
            <Num f={m.ctShare} fmt="share0" /> of what the council spends on day-to-day services; government grants pay{" "}
            <Num f={m.grantsShare} fmt="share0" />, including the money passed straight to schools, and business rates{" "}
            <Num f={m.ratesShare} fmt="share0" />.
          </p>
          <PostcodeFinder places={PLACES} covered={COVERED} example={m.b.example_postcode ?? "W6 9JU"} compact />
          <div className="kpis">
            <div className="kpi">
              <span className="l">Band D bill</span>
              <span className="v">
                <Num f={m.bill.total} fmt="gbp0" />
              </span>
              <span className="s">
                up <Num f={m.bill.risePct} fmt="pct1" /> on last year
              </span>
            </div>
            <div className="kpi">
              <span className="l">Council budget</span>
              <span className="v">
                <Num f={m.netBudget} fmt="m0" />
              </span>
              <span className="s">day-to-day, including schools</span>
            </div>
            <div className="kpi">
              <span className="l">Paid by council tax</span>
              <span className="v">
                <Num f={m.ctShare} fmt="share0" />
              </span>
              <span className="s">of the budget</span>
            </div>
            {P.mayor ? (
              <div className="kpi">
                <span className="l">Run by an elected mayor</span>
                <span className="v">{shortOf.get(P.mayor.party_id) ?? P.mayor.party}</span>
                <span className="s">{P.mayor.name}</span>
              </div>
            ) : (
              <div className="kpi">
                <span className="l">Council control</span>
                <span className="v">{control?.short ?? "No overall control"}</span>
                <span className="s">
                  {control ? (
                    <>
                      <Num f={fig(control.seats)} fmt="int" /> of <Num f={fig(seats)} fmt="int" /> seats
                    </>
                  ) : (
                    "no party has more than half the seats"
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        <LedgerStateProvider
          input={{ gapM: 0, levers: [], toggles: [], reserves: { general_m: 0, minimum_safe_m: 0 }, referendumThresholdPct: null, toleranceM: DATA.rules.balanced_budget.tolerance_m }}
        >
          <BillSection bill={m.bill} rules={DATA.rules} services={m.services} ctShareGeneral={m.ctShareGeneral} generalBudget={m.generalBudget} place={m.place} />
        </LedgerStateProvider>
        <BudgetFlow m={m} legend={m.budgetLegend} />

        <section id="history" aria-labelledby="history-h">
          <div className="sec-head">
            <h2 id="history-h">Council tax over the years</h2>
            <p>
              The council&rsquo;s own share of a Band D bill went from <Num f={first.council} fmt="gbp2" /> in {first.label} to <Num f={last.council} fmt="gbp2" /> in{" "}
              {last.label}, up <Num f={derive((last.council.value / first.council.value - 1) * 100, last.council, first.council)} fmt="pct0" />.
            </p>
          </div>
          <div className="tablewrap">
            <table>
              <caption className="sr-only">Band D council tax in {m.place.short} each year</caption>
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  <th scope="col" className="n">
                    The council&rsquo;s share
                  </th>
                  <th scope="col" className="n">
                    Whole bill, with the Mayor of London
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.history.map((y) => (
                  <tr key={y.year}>
                    <th scope="row">{y.label}</th>
                    <td className="n">
                      <Num f={y.council} fmt="gbp2" />
                    </td>
                    <td className="n">
                      <Num f={y.area} fmt="gbp2" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="councillors" aria-labelledby="councillors-h">
          <div className="sec-head">
            <h2 id="councillors-h">Councillors and how each ward voted</h2>
            <p>
              {P.parties.map((x, i) => (
                <span key={x.id}>
                  {i ? (i === P.parties.length - 1 ? " and " : ", ") : ""}
                  {x.short} <Num f={fig(x.seats)} fmt="int" />
                </span>
              ))}{" "}
              of the <Num f={fig(seats)} fmt="int" /> councillors on the council&rsquo;s list
              {vacant > 0 ? (
                <>
                  , with <Num f={fig(vacant)} fmt="int" /> {vacant === 1 ? "seat" : "seats"} empty
                </>
              ) : null}
              .{" "}
              {P.mayor ? (
                <>
                  The council is run by its elected mayor, {P.mayor.name} ({shortOf.get(P.mayor.party_id) ?? P.mayor.party}), elected on {formatDay(P.election.date)}
                  {P.mayor.votes ? (
                    <>
                      {" "}
                      with <Num f={fig(P.mayor.votes)} fmt="int" /> votes
                    </>
                  ) : null}{" "}
                  (<a href={P.mayor.result_url}>result</a>).{" "}
                  {control ? `${control.short} has more than half the seats.` : "No party has more than half the seats."}
                </>
              ) : control ? (
                `${control.short} has more than half the seats, so runs the council.`
              ) : (
                "No party has more than half the seats."
              )}{" "}
              Only the councillors elected are named here; everyone else stood as their party&rsquo;s candidate.
            </p>
          </div>
          <div className="ward-page">
            <div>
              {P.wards.map((w) => {
                const top = Math.max(...w.election.candidates.map((c) => c.votes));
                return (
                  <section key={w.id} id={`ward-${w.id}`} aria-labelledby={`ward-${w.id}-h`} className="ward-sec">
                    <h3 id={`ward-${w.id}-h`}>{w.name}</h3>
                    <ul className="cllrs">
                      {w.councillor_ids.map((id) => {
                        const c = byId.get(id)!;
                        return (
                          <li key={id}>
                            <a href={c.democracy_url} rel="noopener">
                              {c.name}
                            </a>
                            <span className="muted">{shortOf.get(c.party) ?? c.party_name}</span>
                            {c.roles.length ? <span className="small muted block">{c.roles.join("; ")}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                    <details className="chart-table">
                      <summary>
                        How {w.name} voted
                        {w.election.turnout_pct !== null ? (
                          <>
                            : turnout <Num f={fig(w.election.turnout_pct)} fmt="pct1" />
                          </>
                        ) : null}
                      </summary>
                      <div className="tablewrap votes">
                        <table>
                          <caption className="sr-only">Votes for each candidate in {w.name} ward</caption>
                          <thead>
                            <tr>
                              <th scope="col">Party</th>
                              <th scope="col" className="n">
                                Votes
                              </th>
                              <th scope="col">Elected</th>
                            </tr>
                          </thead>
                          <tbody>
                            {w.election.candidates.map((c, i) => (
                              <tr key={i} className={c.elected ? "won" : undefined}>
                                <th scope="row">{c.party}</th>
                                <td className="n">
                                  <span className="vbar" aria-hidden="true" style={{ width: `calc((100% - 80px) * ${(c.votes / top).toFixed(3)})` }} />
                                  <Num f={fig(c.votes)} fmt="int" />
                                </td>
                                <td>{c.councillor_id ? byId.get(c.councillor_id)?.name : c.left ? <span className="muted">No longer on the council&rsquo;s list</span> : null}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="small muted">
                        {w.election.ballots !== null ? (
                          <>
                            <Num f={fig(w.election.ballots)} fmt="int" /> people voted.{" "}
                          </>
                        ) : (
                          "The declaration gave no turnout. "
                        )}
                        {w.election.rejected !== null ? (
                          <>
                            <Num f={fig(w.election.rejected)} fmt="int" /> ballot papers were rejected.{" "}
                          </>
                        ) : null}
                        From
                        the <a href={w.election.result_url}>council&rsquo;s declaration</a>, via <a href={w.election.dc_url}>Democracy Club</a> (CC BY-SA 4.0).
                      </p>
                    </details>
                  </section>
                );
              })}
            </div>
            <aside className="ward-aside">
              <BoroughMap m={m} />
              <p className="small muted">{m.map.source.attribution}</p>
            </aside>
          </div>
        </section>

        <section aria-labelledby="next-h" className="pay-section">
          <div className="sec-head">
            <h2 id="next-h">Still to come for {m.place.short}</h2>
          </div>
          <p>
            For Hammersmith &amp; Fulham, Borough Book also tracks every party&rsquo;s manifesto pledges, every council payment over £500, Cabinet and Full Council
            decisions, how this year&rsquo;s budget gap was closed and a tool to balance next year. Those need the council&rsquo;s own papers, read by hand, and come
            here next. <a href="/">See Hammersmith &amp; Fulham</a>.
          </p>
          <div className="qrow">
            <QualityGroup q="sourced" text={`Bill, budget and history: government returns, checked against their own totals (${formatDay(m.vintage)})`} />
          </div>
          <ChartTable summary="Where every figure on this page comes from">
            <ul className="small">
              {m.sources.map((s) => (
                <li key={s.url + s.title}>
                  <a href={s.url}>{s.title}</a>
                </li>
              ))}
            </ul>
          </ChartTable>
        </section>
        <Footer council={m.place.short} full={`the ${m.place.council}`} hasTestData={false} />
      </main>
      <JsonLd data={jsonLd} />
    </>
  );
}
