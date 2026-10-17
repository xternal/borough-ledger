import { AdultCare } from "@/components/AdultCare";
import { BalanceIt } from "@/components/BalanceIt";
import { BillSection } from "@/components/BillSection";
import { BudgetFlow } from "@/components/BudgetFlow";
import { CareCompare } from "@/components/CareCompare";
import { ChildrenCare } from "@/components/ChildrenCare";
import { CouncilTaxOptions } from "@/components/CouncilTaxOptions";
import { MakeYourCase } from "@/components/MakeYourCase";
import { Num } from "@/components/Num";
import { ServiceCases } from "@/components/ServiceCases";
import { ServiceCompare } from "@/components/ServiceCompare";
import type { SectionView } from "@/components/SecTitle";
import { adultCare, careComparison, careResults } from "@/lib/adultCare";
import type { PledgeTry } from "@/lib/balanceLink";
import { HOMES, SPAN, capFig, homesFig, totalOf } from "@/lib/capital";
import { childrenCare } from "@/lib/childrenCare";
import { adultCareCase, budgetWants, caseSetup, serviceCase } from "@/lib/makeYourCase";
import type { PageModel } from "@/lib/model";
import { SITE_URL } from "@/lib/site";
import { DATA as HF_DATA } from "@borough-ledger/schema";

/*
 * The parts of the statement that are a section of the home page and a page of their own: the same components on both,
 * each with the parts that belong to it, so an anchor works on either (/#case-care on the overview, /budget#case-care).
 * The gap (Waterfall) and the method (Method) are one component each and are used directly.
 */

const CODE = HF_DATA.council.meta.council_code;
/** What care for adults costs here (the government's finance report), shown under the budget. */
const CARE = adultCare(CODE);
/** And for children in care (the Department for Education's statistics). */
const KIDS = childrenCare(CODE);

/** Your bill, and next year's options for the band picked in it. Inside a LedgerStateProvider. */
export function BillPart({ m, view }: { m: PageModel; view: SectionView }) {
  return (
    <>
      <BillSection bill={m.bill} rules={m.rules} services={m.services} ctShareGeneral={m.ctShareGeneral} generalBudget={m.generalBudget} place={m.place} view={view} />
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
    </>
  );
}

/** The budget, then what three everyday services and care for adults and children cost, each with "make your case". */
export function BudgetPart({ m, view }: { m: PageModel; view: SectionView }) {
  // The letter points councillors to the budget's own page, where every figure in it is shown.
  const page = `${SITE_URL}/budget`;
  const careCase = adultCareCase(m, CODE);
  const serviceCases = (["streets_waste", "libraries_leisure", "housing"] as const).flatMap((t) => {
    const c = serviceCase(m, t, CODE);
    return c ? [{ setup: c.setup, wants: c.wants, facts: c.facts, compare: <ServiceCompare cmp={c.cmp} council={m.place.short} /> }] : [];
  });
  return (
    <>
      <BudgetFlow
        m={m}
        legend={m.qualityLegend.budget}
        view={view}
        more={
          <p className="flow-more">
            This is day-to-day spending. The council also plans <a href="/building">building work</a> worth <Num f={capFig(totalOf("gf").total!)} fmt="m1" />{" "}
            from {SPAN}, and <a href="/council-homes">council homes</a> have an account of their own: rents and service charges of{" "}
            <Num f={homesFig(-HOMES.budget.filter((b) => b.kind === "income").reduce((a, b) => a + b.now, 0))} fmt="m1" /> a year.
          </p>
        }
      />
      {serviceCases.length ? <ServiceCases cases={serviceCases} page={`${page}#case-services`} /> : null}
      {CARE ? <AdultCare care={CARE} council={m.place.council} results={careResults(CODE)} /> : null}
      {careCase && CARE ? (
        <MakeYourCase
          id="case-care"
          setup={careCase.setup}
          wants={careCase.wants}
          facts={careCase.facts}
          page={`${page}#case-care`}
          compare={<CareCompare cmp={careComparison(CODE)!} yearLabel={CARE.yearLabel} results={careResults(CODE)} />}
        />
      ) : null}
      {KIDS ? <ChildrenCare care={KIDS} council={m.place.council} short={m.place.short} /> : null}
    </>
  );
}

/** Balance it, with "make your case" for the reader's own budget. Inside a LedgerStateProvider. */
export function BalancePart({ m, view, pledge }: { m: PageModel; view: SectionView; pledge?: PledgeTry & { text: string; partyShort: string } }) {
  return (
    <BalanceIt
      balance={m.balance}
      bill={m.bill}
      rules={m.rules}
      place={m.place}
      view={view}
      pledge={pledge}
      makeCase={{ setup: caseSetup("budget", m), wants: budgetWants(m), site: SITE_URL }}
    />
  );
}
