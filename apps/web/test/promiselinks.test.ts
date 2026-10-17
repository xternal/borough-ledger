import { describe, expect, it } from "vitest";
import { defaultScenario, encodeScenario } from "@borough-ledger/engine";
import { balancePath, scenarioFromQuery, withPledge } from "@/lib/balanceLink";
import { buildModel } from "@/lib/model";
import { NO_FILTERS, applyFilters, filtersFromQuery, filtersQuery } from "@/lib/promiseFilters";
import { topicSlug } from "@/lib/topics";

const m = buildModel();
const input = m.balance.input;
const toggle = input.toggles[0]!;
// No card names a Balance it choice yet; any pledge that does works the same way.
const pledge = { id: "a-pledge", toggleId: toggle.id };

/** What /balance opens on for an address, as the page reads it. */
function open(path: string) {
  const q = new URL(path, "https://example.org").searchParams;
  return scenarioFromQuery(input, q.has("s") ? q.get("s")! : undefined, q.get("promise") === pledge.id ? pledge : null);
}

describe("a pledge in Balance it", () => {
  it("switches the pledge's choice from the council's forecast", () => {
    const s = withPledge(input, toggle.id);
    expect(s.toggles[toggle.id]).toBe(!toggle.on);
    expect(withPledge(input, toggle.id, s).toggles[toggle.id]).toBe(toggle.on);
  });

  it("opens /balance?promise=<id> with the pledge switched, and ?s= exactly as shared", () => {
    expect(balancePath(input, withPledge(input, toggle.id), pledge)).toBe("/balance?promise=a-pledge");
    expect(open("/balance?promise=a-pledge").toggles[toggle.id]).toBe(!toggle.on);
    // ?s= wins, even empty: the forecast as it is.
    expect(open("/balance?promise=a-pledge&s=")).toEqual(defaultScenario(input));
    // An unknown pledge is ignored.
    expect(scenarioFromQuery(input, undefined, null)).toEqual(defaultScenario(input));
  });

  it("keeps the reader's other choices, and every address opens on the choices it was made from", () => {
    const lever = input.levers.find((l) => l.max > l.base)!;
    const moved = { ...defaultScenario(input), levers: { ...defaultScenario(input).levers, [lever.id]: lever.max } };
    const scenarios = [defaultScenario(input), withPledge(input, toggle.id), withPledge(input, toggle.id, moved), moved];
    for (const s of scenarios) {
      const withIt = balancePath(input, s, pledge);
      expect(withIt.startsWith("/balance?promise=a-pledge")).toBe(true);
      expect(encodeScenario(input, open(withIt)), withIt).toBe(encodeScenario(input, s));
      const plain = balancePath(input, s);
      expect(plain).not.toContain("promise=");
      expect(encodeScenario(input, open(plain)), plain).toBe(encodeScenario(input, s));
    }
    expect(balancePath(input, defaultScenario(input))).toBe("/balance");
  });
});

describe("filters on /promises", () => {
  const area = m.promises[0]!.area;

  it("reads the filters from the address, dropping anything that names nothing", () => {
    expect(filtersFromQuery(m.promises, {})).toEqual(NO_FILTERS);
    expect(filtersFromQuery(m.promises, { side: "opposition", status: "promised", topic: topicSlug(area) })).toEqual({
      side: "opposition",
      status: "promised",
      topic: area,
    });
    // Older links carried the topic's name.
    expect(filtersFromQuery(m.promises, { topic: area }).topic).toBe(area);
    expect(filtersFromQuery(m.promises, { status: "overdue" }).status).toBe("overdue");
    expect(filtersFromQuery(m.promises, { side: "labour", status: "nope", topic: "nowhere" })).toEqual(NO_FILTERS);
    expect(filtersFromQuery(m.promises, { side: ["administration", "opposition"] }).side).toBe("administration");
  });

  it("writes only the filters in use, and reads back what it wrote", () => {
    expect(filtersQuery(NO_FILTERS)).toBe("");
    const f = { side: "administration" as const, status: "overdue" as const, topic: area };
    const q = filtersQuery(f);
    expect(q).toBe(`?side=administration&status=overdue&topic=${topicSlug(area)}`);
    expect(filtersFromQuery(m.promises, Object.fromEntries(new URLSearchParams(q)))).toEqual(f);
  });

  it("shows the same pledges for the same filters, overdue by today's date", () => {
    expect(applyFilters(m.promises, NO_FILTERS, m.today)).toHaveLength(m.promises.length);
    const late = { ...m.promises[0]!, deadline: "2026-01-01", status: "promised" as const };
    const done = { ...late, id: "done", status: "delivered" as const };
    const overdue = { ...NO_FILTERS, status: "overdue" as const };
    expect(applyFilters([late, done], overdue, "2026-10-17").map((p) => p.id)).toEqual([late.id]);
    expect(applyFilters([late, done], overdue, "2025-12-31")).toEqual([]);
    for (const p of applyFilters(m.promises, { ...NO_FILTERS, side: "opposition" }, m.today)) expect(p.side).toBe("opposition");
  });
});
