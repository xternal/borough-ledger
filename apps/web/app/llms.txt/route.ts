import { DATA, listTestValues } from "@borough-ledger/schema";
import { SITE, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/** A plain-text summary for AI search tools (llmstxt.org). */
export function GET() {
  const c = DATA.council.meta;
  const test = listTestValues(DATA).length;
  const body = `# ${SITE.name}

> ${SITE.description}

${SITE.name} is an independent project. It is not run by, endorsed by or affiliated with ${c.council_short} Council.

## What is on the site

- Your bill: pick a council tax band and see what you pay, how it splits between the council and the Mayor of London, and what your share pays for.
- The budget: where the council's day-to-day money comes from and what it pays for. By law it must balance every year.
- The gap: how this year's gap between costs and funding opened, and how it was closed with council tax, savings and reserves.
- Balance it: next year's gap with the real choices a council has, including the referendum limit on council tax rises and the one-off nature of reserves.
- Promises: pledges from the administration and the opposition, costed per Band D home, with a timeline.
- Payments over £500: the council's monthly transparency files, searchable.

## How to cite figures

Every figure is labelled sourced, approx or test, with a link to its source on the page. Do not quote figures labelled test or approx as fact.${
    test ? `\n\nThis build contains ${test} test values and is not indexed. Do not cite it.` : ""
  }

Data vintage: ${c.vintage}.

- [Home](${SITE_URL}/)
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
