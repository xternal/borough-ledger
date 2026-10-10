import type { Scenario } from "@borough-ledger/engine";
import { BalanceIt } from "@/components/BalanceIt";
import { BillSection } from "@/components/BillSection";
import { CouncilTaxOptions } from "@/components/CouncilTaxOptions";
import { BudgetFlow } from "@/components/BudgetFlow";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { JsonLd } from "@/components/JsonLd";
import { LedgerStateProvider } from "@/components/LedgerState";
import { Method } from "@/components/Method";
import { Payments } from "@/components/Payments";
import { Promises } from "@/components/Promises";
import { ScrollTo } from "@/components/ScrollTo";
import { TopBar } from "@/components/TopBar";
import { WardSection } from "@/components/WardSection";
import { Waterfall } from "@/components/Waterfall";
import { Num } from "@/components/Num";
import { HOMES, SPAN, capFig, homesFig, totalOf } from "@/lib/capital";
import { faq } from "@/lib/faq";
import type { PageModel } from "@/lib/model";
import { MAKER, SITE, SITE_URL } from "@/lib/site";

/** The whole statement. `/` renders it as is; `/balance` opens it on a shared scenario. */
export function LedgerPage({ m, initialScenario, focus }: { m: PageModel; initialScenario?: Scenario; focus?: string }) {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: SITE_URL,
      description: SITE.description,
      inLanguage: "en-GB",
      creator: { "@type": "Person", name: MAKER.name, url: MAKER.url },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq(m.place.short).map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];
  return (
    <>
      <TopBar place={m.place.short} year={m.place.yearLabel} />
      <main className="wrap" id="top">
        <Hero m={m} />
        <LedgerStateProvider input={m.balance.input} initialScenario={initialScenario}>
          <BillSection bill={m.bill} rules={m.rules} services={m.services} ctShareGeneral={m.ctShareGeneral} generalBudget={m.generalBudget} place={m.place} />
          {m.ctOptions ? (
            <section id="next-bill" aria-labelledby="next-bill-h">
              <div className="sec-head">
                <h2 id="next-bill-h">Your bill next year: the council&rsquo;s three options</h2>
                <p>
                  The council&rsquo;s report to Cabinet on 12 October 2026 sets out three options for {m.place.nextYearLabel}. Nothing is decided yet. For the band you
                  picked above:
                </p>
              </div>
              <CouncilTaxOptions bill={m.bill} rules={m.rules} place={m.place} ct={m.ctOptions} compact />
            </section>
          ) : null}
          <BudgetFlow
            m={m}
            legend={m.qualityLegend.budget}
            more={
              <p className="flow-more">
                This is day-to-day spending. The council also plans <a href="/building">building work</a> worth <Num f={capFig(totalOf("gf").total!)} fmt="m1" />{" "}
                from {SPAN}, and <a href="/council-homes">council homes</a> have an account of their own: rents and service charges of{" "}
                <Num f={homesFig(-HOMES.budget.filter((b) => b.kind === "income").reduce((a, b) => a + b.now, 0))} fmt="m1" /> a year.
              </p>
            }
          />
          <Waterfall m={m} />
          <BalanceIt balance={m.balance} bill={m.bill} rules={m.rules} place={m.place} />
          <Promises promises={m.promises} today={m.today} generalBudget={m.generalBudget} balance={m.balance} limit={6} />
        </LedgerStateProvider>
        <WardSection m={m} />
        <Payments payments={m.payments} />
        <Method m={m} />
        <Footer council={m.place.short} hasTestData={m.hasTestData} />
      </main>
      {focus ? <ScrollTo id={focus} /> : null}
      <JsonLd data={jsonLd} />
    </>
  );
}
