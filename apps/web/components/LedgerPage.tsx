import type { Scenario } from "@borough-ledger/engine";
import { BalanceIt } from "@/components/BalanceIt";
import { BillSection } from "@/components/BillSection";
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
import { Waterfall } from "@/components/Waterfall";
import { faq } from "@/lib/faq";
import type { PageModel } from "@/lib/model";
import { SITE, SITE_URL } from "@/lib/site";

/** The whole statement. `/` renders it as is; `/balance` opens it on a shared scenario. */
export function LedgerPage({ m, initialScenario, focus }: { m: PageModel; initialScenario?: Scenario; focus?: string }) {
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: SITE_URL, description: SITE.description, inLanguage: "en-GB" },
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
          <BudgetFlow m={m} />
          <Waterfall m={m} />
          <BalanceIt balance={m.balance} bill={m.bill} rules={m.rules} place={m.place} />
          <Promises promises={m.promises} today={m.today} generalBudget={m.generalBudget} balance={m.balance} />
        </LedgerStateProvider>
        <Payments payments={m.payments} />
        <Method m={m} />
        <Footer council={m.place.short} hasTestData={m.hasTestData} />
      </main>
      {focus ? <ScrollTo id={focus} /> : null}
      <JsonLd data={jsonLd} />
    </>
  );
}
