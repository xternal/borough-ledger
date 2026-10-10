import { DATA, listTestValues } from "@borough-ledger/schema";
import { OTHER_BOROUGHS } from "@/lib/boroughList";
import { buildModel } from "@/lib/model";
import { partiesOf, topicsOf } from "@/lib/topics";
import { STATUS_LABEL } from "@/lib/promises";
import { CONTACT, MAKER, REPO, SITE, SITE_URL, STAGE } from "@/lib/site";

export const dynamic = "force-static";

/** A plain-text summary for AI search tools (llmstxt.org). */
export function GET() {
  const c = DATA.council.meta;
  const test = listTestValues(DATA).length;
  const body = `# ${SITE.name}

> ${SITE.description}

${SITE.name} is an independent project. It is not run by, endorsed by or affiliated with ${c.council_short} Council. Made by ${MAKER.name} (${MAKER.url}).

## What is on the site

- Your bill: pick a council tax band and see what you pay, how it splits between the council and the Mayor of London, and what your share pays for.
- The budget: where the council's day-to-day money comes from and what it pays for. By law it must balance every year.
- The gap: how this year's gap between costs and funding opened, and how it was closed with council tax, savings and reserves.
- Council tax next year (${SITE_URL}/council-tax-rise): the council's three options for 2027/28 from its report to Cabinet on 12 October 2026 (its own share of the bill up 100%, 125% or 150%), worked out for every band as the whole bill and the extra a week; why it is happening; and the timetable to the decision, with how to have your say. The percentages apply to the council's share, not the whole bill, which includes the Mayor of London's.
- Balance it: next year's gap with the real choices a council has, including the referendum limit on council tax rises and the one-off nature of reserves.
- Promises: each party's headline pledges from its 2026 manifesto, quoted word for word with the manifesto page, an archived copy, a status and a timeline. Pledges are costed per Band D home where a cost can be sourced. The party with more than half the seats is the administration; every party is held to the same rules.
- Council decisions: every Cabinet and Full Council decision since January 2026 from the council's own records, with the pledges each one moves; a link is suggested by an AI with the decision's exact words and added only when an editor confirms it.
- Your ward: find any of the 21 wards by postcode or on a map, with its councillors (all 50, with their posts, from the council's own records), pledges about the ward, the wards next to it and a link to report street problems on FixMyStreet.
- What the council is building (${SITE_URL}/building): the four-year capital programme, scheme by scheme, how it is paid for and the debt it leaves.
- Council homes (${SITE_URL}/council-homes): the ring-fenced account council rents pay into, where the money goes, council rents against private rents, and the building work on council homes.
- Other councils: ${OTHER_BOROUGHS.map((b) => `${b.short} (${SITE_URL}${b.href})`).join(", ")}: the bill by band, the budget by service, council tax over five years, and every ward's councillors and election result, from government returns and the council's own records, with the same checks. In Belfast, homes pay rates rather than council tax: the bill is worked out from a home's capital value, split between the council's district rate and the Northern Ireland Executive's regional rate, and councillors are shown by district electoral area.
- Payments over £500: every payment in the council's quarterly spend files (excluding VAT), by month, organisation and service, reconciled to each file. Payments to people, such as direct payments for care, appear only as totals and nobody is named. Companies, charities and public bodies have their own pages.

This is the ${STAGE.toLowerCase()} version. Every figure comes from the council's own documents or government returns, and the promise cards and the way payments are grouped into services have been checked by hand. More is being added.

Corrections, and replies from anyone named on a card: ${CONTACT}. The code, data tables and promise cards are open at ${REPO}. Our own text and data are CC BY 4.0 (credit "${SITE.name} (${MAKER.name})"), the code is MIT, and council, government and ONS data keep their own licences.

## For AI tools

- Everything in one file: ${SITE_URL}/llms-full.txt
- Each pledge as Markdown: add .md to its address, for example ${SITE_URL}/promise/${DATA.content.promises[0]!.id}.md
- Feeds of every change: ${SITE_URL}/follow

## How to cite figures

Every figure is labelled sourced, approx or test, with a link to its source on the page. Do not quote figures labelled test or approx as fact.${
    test ? `\n\nThis build contains ${test} test values and is not indexed. Do not cite it.` : ""
  }

Data vintage: ${c.vintage}.

- [Home](${SITE_URL}/)
- [Promises](${SITE_URL}/promises)
- [Council decisions](${SITE_URL}/decisions)
${partiesOf(buildModel()).map((pt) => `- [${pt.name}: 2026 manifesto pledges](${SITE_URL}/party/${pt.id})`).join("\n")}
${topicsOf(buildModel()).map((t) => `- [${t.area}: pledges from every party](${SITE_URL}/topic/${t.slug})`).join("\n")}
- [Your ward: wards and councillors](${SITE_URL}/wards)
- [Balance next year's budget](${SITE_URL}/balance)
- [Payments over £500](${SITE_URL}/payments)
- [Sources](${SITE_URL}/sources)
- [Follow changes by RSS](${SITE_URL}/follow): feeds for everything (${SITE_URL}/feed.xml), every pledge, each ward, each councillor and payments
${buildModel()
  .promises.map((p) => `- [${p.actor}: \u201c${p.text}\u201d (${STATUS_LABEL[p.status]})](${SITE_URL}/promise/${p.id}.md)`)
  .join("\n")}
${DATA.content.wards.wards.map((w) => `- [${w.name} ward](${SITE_URL}/ward/${w.id})`).join("\n")}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
