import { BalanceIt } from "@/components/BalanceIt";
import { BillSection } from "@/components/BillSection";
import { BudgetFlow } from "@/components/BudgetFlow";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { LedgerStateProvider } from "@/components/LedgerState";
import { Method } from "@/components/Method";
import { Payments } from "@/components/Payments";
import { Promises } from "@/components/Promises";
import { TopBar } from "@/components/TopBar";
import { Waterfall } from "@/components/Waterfall";
import { faq } from "@/lib/faq";
import { buildModel } from "@/lib/model";
import { SITE, SITE_URL } from "@/lib/site";

/** Rebuilt daily so "today" on promise timelines and overdue filters stays current. */
export const revalidate = 86400;

export default function Home() {
  const m = buildModel();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: SITE_URL,
      description: SITE.description,
      inLanguage: "en-GB",
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
        <LedgerStateProvider input={m.balance.input}>
          <BillSection bill={m.bill} rules={m.rules} services={m.services} ctShare={m.ctShare} netBudget={m.netBudget} place={m.place} mainOtherFunding={m.mainOtherFunding} />
          <BudgetFlow m={m} />
          <Waterfall m={m} />
          <BalanceIt balance={m.balance} bill={m.bill} rules={m.rules} place={m.place} />
          <Promises promises={m.promises} today={m.today} netBudget={m.netBudget} balance={m.balance} />
        </LedgerStateProvider>
        <Payments payments={m.payments} />
        <Method m={m} />
        <Footer council={m.place.short} hasTestData={m.hasTestData} />
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
