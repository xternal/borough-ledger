import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FamilySwitcher } from "@/components/FamilySwitcher";
import { FAMILY, THIS_SITE } from "@/lib/family";
import { logbook, watchTiles } from "@/lib/home";
import { buildModel, type PromiseModel } from "@/lib/model";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: () => {} }) }));

const m = buildModel();
const base = m.promises[0]!;
/** A card with only what the rules read. */
const card = (id: string, over: Partial<PromiseModel> & { recorded?: string }): PromiseModel => ({
  ...base,
  id,
  text: `T ${id}`,
  partyId: over.partyId ?? "labour",
  partyShort: over.partyShort ?? "Labour",
  status: over.status ?? "promised",
  deadline: over.deadline ?? null,
  timeline: over.timeline ?? [],
  replies: over.replies ?? [],
  versions: [{ ...base.versions[0]!, recorded_on: over.recorded ?? "2026-10-07" }],
  editorCheck: over.editorCheck ?? false,
});

describe("the first screen's promises to watch", () => {
  it("picks the latest delivered, the latest not met, the soonest open deadline and the latest step forward, by fixed rules", () => {
    const cards = [
      card("d1", { status: "delivered", timeline: [{ date: "2026-09-01", type: "delivered", event: "" }] }),
      card("d2", { status: "delivered", timeline: [{ date: "2026-10-01", type: "delivered", event: "" }] }),
      card("f1", { status: "failed", timeline: [{ date: "2026-07-21", type: "failed", event: "" }] }),
      card("o1", { deadline: "2026-11-30" }),
      card("o2", { deadline: "2026-10-28" }),
      card("o3", { deadline: "2026-10-01" }),
      card("hidden", { deadline: "2026-10-24", editorCheck: true }),
      card("p1", { status: "delivering", timeline: [{ date: "2026-08-01", type: "delivering", event: "" }] }),
      card("p2", { status: "in_plan", timeline: [{ date: "2026-12-01", type: "in_plan", event: "" }] }),
    ];
    const t = watchTiles(cards, "2026-10-23");
    expect([t.delivered?.card.id, t.notMet?.card.id, t.dueNext?.card.id, t.dueNext?.date, t.forward?.card.id]).toEqual(["d2", "f1", "o2", "2026-10-28", "p1"]);
  });

  it("reads nothing about who made a promise: swapping every card's party picks the same cards", () => {
    const swapped = m.promises.map((p) => ({ ...p, partyId: p.partyId === "labour" ? "conservative" : "labour", side: p.side === "administration" ? ("opposition" as const) : ("administration" as const) }));
    const ids = (t: ReturnType<typeof watchTiles>) => Object.values(t).map((x) => x?.card.id ?? null);
    expect(ids(watchTiles(swapped, m.today))).toEqual(ids(watchTiles(m.promises, m.today)));
  });
});

describe("the logbook", () => {
  it("groups one party's new cards on one day, puts moves first within a day, adds the day's decision checks, newest first", () => {
    const cards = [
      card("a1", { recorded: "2026-10-14" }),
      card("a2", { recorded: "2026-10-14" }),
      card("b1", { recorded: "2026-10-14", partyId: "conservative", partyShort: "Conservative" }),
      card("m1", { status: "delivering", timeline: [{ date: "2026-10-14", type: "delivering", event: "" }] }),
      card("later", { recorded: "2026-12-01" }),
      card("hidden", { recorded: "2026-10-20", editorCheck: true }),
    ];
    const assessed = { x: { on: "2026-10-16", links: 0 }, y: { on: "2026-10-16", links: 1 }, z: { on: "2026-10-30", links: 0 } };
    expect(logbook(cards, "2026-10-23", 6, assessed).map((e) => `${e.date} ${e.label} ${e.text}`)).toEqual([
      "2026-10-16 Checked 2 council decisions checked against every pledge: 1 moves a pledge",
      "2026-10-14 Delivering Labour: “T m1”",
      "2026-10-14 New Conservative: “T b1”",
      "2026-10-14 New Labour: 2 new pledges",
      "2026-10-07 New Labour: “T m1”",
    ]);
  });

  it("has six lines on the real data, each with a date and a link", () => {
    const log = logbook(m.promises, m.today);
    expect(log).toHaveLength(6);
    for (const l of log) expect(l.href).toMatch(/^\/(promise|party|decisions)/);
  });
});

describe("the family switcher", () => {
  const html = renderToStaticMarkup(createElement(FamilySwitcher));
  it("lists the six sites of the family, marks this one, and credits the maker", () => {
    expect(FAMILY.map((s) => s.name)).toEqual(["LedgerGov.UK", "BoroughBook.UK", "USLedger.org", "RussiaLedger.com", "UkraineLedger.com", "Ruminator.xyz"]);
    for (const s of FAMILY) expect(html).toContain(`href="${s.href}"`);
    expect(html).toContain(`<a href="https://boroughbook.uk" aria-current="page"><b>${THIS_SITE}<span class="family-here">you are here</span></b>`);
    expect(html).toContain("Made by Pavel Guzhikov, guzh.uk");
  });
});
