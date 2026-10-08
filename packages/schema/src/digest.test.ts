import { describe, expect, it } from "vitest";
import { DATA } from "./data";
import { digestFacts, draftNumbersOk, money, templateDraft, type DigestInput } from "./digest";

const base: DigestInput = {
  today: "2026-10-09",
  site: "https://boroughbook.uk",
  content: DATA.content,
  decisions: DATA.decisions,
  assessed: {},
  upcoming: [{ body: "Cabinet", date: "2026-10-12", time: "6.30 pm", url: "https://democracy.lbhf.gov.uk/x", items: ["General Fund Medium Term Financial Plan 2027/28 - 2030/31"] }],
  wardSpend: DATA.wardSpend,
  newPayments: null,
};

describe("weekly digest", () => {
  it("lists meetings in the next fortnight with their agenda, and nothing beyond it", () => {
    const later = { ...base.upcoming[0]!, date: "2026-11-16" };
    const facts = digestFacts({ ...base, upcoming: [...base.upcoming, later] });
    const coming = facts.filter((f) => f.section === "coming-up");
    expect(coming).toHaveLength(1);
    expect(coming[0]!.text).toContain("Monday 12 October");
    expect(coming[0]!.text).toContain("Medium Term Financial Plan");
  });

  it("reports a decision dated this week with the pledge it moves, and leaves older ones out", () => {
    const d = { ...DATA.decisions.decisions[0]!, id: "mg-999", date: "2026-10-06" };
    const link = { decision_id: "mg-999", promise_id: "lab-2026-parks", event: "budgeted" as const, quote: "x".repeat(20), suggested_by: "t", suggested_on: "2026-10-07" };
    const facts = digestFacts({ ...base, decisions: { ...DATA.decisions, decisions: [d, ...DATA.decisions.decisions] }, content: { ...DATA.content, decision_links: [link] } });
    const week = facts.filter((f) => f.section === "this-week" && f.url.endsWith("#mg-999"));
    expect(week).toHaveLength(1);
    expect(week[0]!.text).toContain("now has money in the budget");
    expect(facts.some((f) => f.url.endsWith(`#${DATA.decisions.decisions[0]!.id}`))).toBe(false);
  });

  it("sums a whole manifesto's new cards in one line, the same way for every party", () => {
    const facts = digestFacts({ ...base, today: "2026-10-09" });
    const cards = facts.filter((f) => f.text.includes("new pledge cards"));
    expect(cards).toHaveLength(1);
    expect(cards[0]!.text).toMatch(/\d+ Conservative and \d+ Labour|\d+ Labour and \d+ Conservative/);
  });

  it("rejects a draft with any number that is not one of the facts' numbers", () => {
    const facts = digestFacts(base);
    const ok = templateDraft(facts, base.today, base.site);
    expect(draftNumbersOk(ok, facts, ["500", base.today, base.site]).ok).toBe(true);
    const bad = `${ok}\nThe council will save £12.5m next year.`;
    expect(draftNumbersOk(bad, facts, ["500", base.today, base.site])).toEqual({ ok: false, stray: ["12.5"] });
  });

  it("writes money the way the site does", () => {
    expect(money(31_400_000)).toBe("£31.4m");
    expect(money(462_042)).toBe("£462,042");
  });
});
