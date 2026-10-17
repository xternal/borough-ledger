import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BalanceIt } from "@/components/BalanceIt";
import { LedgerStateProvider } from "@/components/LedgerState";
import { Detail } from "@/components/Promises";
import { balancePath, scenarioFromQuery, withPledge } from "@/lib/balanceLink";
import { buildModel } from "@/lib/model";

const m = buildModel();
const toggle = m.balance.toggles[0]!;
// No card names a Balance it choice yet; this one stands in for any that does.
const p = { ...m.promises[0]!, lever_or_toggle_id: toggle.id };
const pledge = { id: p.id, toggleId: toggle.id, text: p.text, partyShort: p.partyShort };

function balance(view: "overview" | "own", withPledgeOpen: boolean) {
  const scenario = scenarioFromQuery(m.balance.input, undefined, withPledgeOpen ? pledge : null);
  return renderToStaticMarkup(
    createElement(LedgerStateProvider, {
      input: m.balance.input,
      initialScenario: scenario,
      children: createElement(BalanceIt, { balance: m.balance, bill: m.bill, rules: m.rules, place: m.place, view, pledge: withPledgeOpen ? pledge : undefined }),
    }),
  );
}

describe("a pledge's way into Balance it", () => {
  it("is a link to /balance with the pledge in the address, not a jump within the page", () => {
    const html = renderToStaticMarkup(
      createElement(Detail, {
        p,
        today: m.today,
        generalBudget: m.generalBudget,
        toggle,
        toggleOn: toggle.on,
        tryHref: balancePath(m.balance.input, withPledge(m.balance.input, toggle.id), pledge),
      }),
    );
    expect(html).toContain(`href="/balance?promise=${p.id}"`);
    expect(html).toContain(`href="/promise/${p.id}"`);
  });

  it("opens Balance it with the pledge's choice switched, marked, and linked back to its card", () => {
    const html = balance("own", true);
    expect(html).toContain('class="check picked"');
    expect(html).toContain(`href="/promise/${p.id}"`);
    expect(html).toMatch(new RegExp(`id="tg-${toggle.id}"[^>]*${toggle.on ? "" : "checked"}`));
    expect(balance("own", false)).not.toContain("picked");
  });

  it("puts the heading and a band picker on its own page, and a link to that page on the overview", () => {
    const own = balance("own", false);
    expect(own).toContain('<h1 id="balance-h"');
    expect(own).toContain('aria-labelledby="bal-band-l"');
    const overview = balance("overview", false);
    expect(overview).toContain('<h2 id="balance-h"');
    expect(overview).toContain('href="/balance"');
    expect(overview).not.toContain("bal-band");
  });
});
