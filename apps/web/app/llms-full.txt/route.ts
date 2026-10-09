import { DATA, type Figure } from "@borough-ledger/schema";
import { DECISIONS, STEP_LABEL } from "@/lib/decisions";
import { format } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { STATUS_LABEL, STATUS_MEANS, STATUS_ORDER } from "@/lib/promises";
import { promiseMarkdown } from "@/lib/promiseText";
import { assertRenderable } from "@/lib/quality";
import { MAKER, REPO, SITE, SITE_URL } from "@/lib/site";
import { WARD_SPEND, electionOf, wardsOf } from "@/lib/wards";
import { HOMES, SPAN, capFig, fact, groupsOf, homesFig, totalOf } from "@/lib/capital";

export const dynamic = "force-static";

/**
 * Everything on the site in one plain-text file, for AI tools that read a site in one request (llmstxt.org's
 * llms-full.txt). Every figure says where it comes from and whether it is an estimate, as on the pages.
 */
export function GET() {
  const m = buildModel();
  const src = (f: Figure) => f.sources.map((id) => DATA.sources.get(id)?.title ?? id).join("; ");
  const fig = (f: Figure, fmt: Parameters<typeof format>[0]) => {
    assertRenderable(f.quality, "llms-full.txt");
    return `${format(fmt, f.value)}${f.quality === "sourced" ? "" : " (estimate)"} [source: ${src(f)}]`;
  };
  // Each pledge sits under "## Pledges": its title becomes ###, its sections ####.
  const demote = (md: string) => md.replace(/^(#+) /gm, "##$1 ");
  const promises = [...m.promises].sort((a, z) => (a.side === z.side ? a.id.localeCompare(z.id) : a.side === "administration" ? -1 : 1));
  const linked = DATA.content.decision_links;
  const body = `# ${SITE.name}: everything in one file

> ${SITE.description}

${SITE.name} (${SITE_URL}) is an independent project by ${MAKER.name}. It is not run by, endorsed by or affiliated with ${m.place.short} Council. Every figure links to its source on the site; figures marked "(estimate)" are ours, not the council's. Code and data: ${REPO}. Text and data: CC BY 4.0, credit "${SITE.name} (${MAKER.name})".

## How pledges are tracked

Each party's headline manifesto pledges are quoted word for word with the page, and archived. The party with more than half the council's seats runs it (${m.politics.control}, ${format("int", m.politics.seats.value)} of ${format("int", m.politics.totalSeats.value)} seats); its pledges move up a ladder only on evidence from council papers, and every party is held to the same rules. Statuses:

${STATUS_ORDER.map((s) => `- ${STATUS_LABEL[s]}: ${STATUS_MEANS[s]}`).join("\n")}

## ${m.place.short} Council's money, ${m.place.yearLabel}

- Council tax for a Band D home: ${fig(m.bill.total, "gbp2")}, of which the council's share is ${fig(m.bill.council, "gbp2")} and the Mayor of London's ${fig(m.bill.gla, "gbp2")}.
${m.bill.glaSplit.length ? `- The Mayor of London's share at Band D, by body: ${m.bill.glaSplit.map((g) => `${g.phrase} ${fig(g.f, "gbp2")}`).join(", ")}.\n` : ""}- Day-to-day budget (net, including schools): ${fig(m.netBudget, "m1")}. The council funds ${fig(m.generalBudget, "m1")} of it itself, and council tax covers ${fig(m.ctShareGeneral, "share0")} of that.
- This year's gap between costs and funding, closed before the budget was set: ${fig(m.waterfall.gap, "m1")}; savings this year: ${fig(m.savingsThisYear, "m1")}.
- Next year's gap (${m.place.nextYearLabel}): ${fig(m.balance.gap, "m1")} in February's forecast${m.balance.revised ? `; ${fig(m.balance.revised.gap, "m1")} before savings in the council's October report to Cabinet, rising to ${fig(m.balance.revised.last, "m1")} by ${m.balance.revised.lastLabel}` : ""}. General reserves: ${fig(m.balance.reservesGeneral, "m1")}, against a safe minimum of ${fig(m.balance.reservesMin, "m1")}.
- Spending by service:
${m.services.map((s) => `  - ${s.label}: ${fig(s.f, "m1")}`).join("\n")}

More: ${SITE_URL}/ (your bill, the budget, the gap), ${SITE_URL}/balance (balance next year yourself), ${SITE_URL}/sources.

## Pledges

${promises.map((p) => demote(promiseMarkdown(p, m))).join("\n\n")}

## Council decisions since ${DECISIONS.from}

Every Cabinet and Full Council decision, from the council's own records. A link to a pledge is suggested by an AI with the decision's exact words and added only when an editor confirms it. Full list: ${SITE_URL}/decisions

${DECISIONS.decisions
  .map((d) => {
    const moves = linked.filter((l) => l.decision_id === d.id).map((l) => `${STEP_LABEL[l.event]}: ${SITE_URL}/promise/${l.promise_id}`);
    return `- ${d.date}, ${d.body}, item ${d.item}: ${d.title}. ${d.url}${moves.length ? ` Moves a pledge (${moves.join("; ")}).` : ""}`;
  })
  .join("\n")}

## Wards and councillors

${wardsOf(m)
  .map((w) => {
    const build = w.spend.schemes.length ? ` Building work paid for in the ward ${WARD_SPEND.first} to ${WARD_SPEND.last}: ${fig(w.spend.total, w.spend.total.value >= 1e6 ? "pm1" : "gbp0")}.` : "";
    const e = electionOf(w.id);
    const vote = e ? ` Turnout on ${e.date}: ${fig(e.turnout, "pct1")}; seats won: ${[...new Set(e.candidates.filter((c) => c.councillor).map((c) => c.party))].join(", ")}.` : "";
    return `- ${w.name} (${SITE_URL}/ward/${w.id}): ${w.councillors.map((c) => `${c.name} (${c.party})`).join(", ")}.${vote}${build}`;
  })
  .join("\n")}

## Building work and council homes

- The four-year building programme (${SPAN}): ${fig(capFig(totalOf("gf").total!), "m1")} across the borough. Largest areas: ${groupsOf("gf").slice(0, 4).map((g) => `${g.plain} ${fig(capFig(g.total), "m1")}`).join("; ")}. ${SITE_URL}/building
- Council homes: about ${format("int", fact("homes").value)} homes; rent and service charges bring in ${fig(homesFig(-HOMES.budget.filter((b) => b.kind === "income").reduce((a, b) => a + b.now, 0)), "m1")} in ${HOMES.years[1]!.replace("-", "/")}; rents rise ${fig(fact("rent_rise_pct"), "pct1")} from April 2026; interest takes ${fig(fact("interest_to_rent_pct"), "pct0")} of rent income. Building work on council homes, ${SPAN}: ${fig(capFig(totalOf("hra").total!), "m1")}. ${SITE_URL}/council-homes

## Payments over £500

The council's quarterly spend files, ${m.payments.months} months from ${m.payments.firstMonth}, reconciled to each file; payments to people appear only as totals. Search by organisation: ${SITE_URL}/payments. Latest quarter (${m.payments.from} to ${m.payments.to}): ${fig(m.payments.total, "pm1")} in ${format("int", m.payments.rows)} payments.
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
