import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import type { Status } from "@borough-ledger/schema";
import { HOME_PROMISES_ID, HomePromises, promisesTracked } from "@/components/HomePromises";
import { FIRST_SCREEN_ID } from "@/components/HomeFirstScreen";
import { LedgerPage } from "@/components/LedgerPage";
import { Promises } from "@/components/Promises";
import { PromisesIndex } from "@/components/PromisesIndex";
import { TopBar } from "@/components/TopBar";
import { DECODER_NAV } from "@/lib/decoderPage";
import { buildModel, type PromiseModel } from "@/lib/model";
import { NO_FILTERS } from "@/lib/promiseFilters";
import { STATUS_LABEL } from "@/lib/promises";
import { SPOTLIGHT_SIZE, lastChanged, spotlight, type SpotlightCard } from "@/lib/spotlight";

/** Pages render outside Next.js here: the postcode finder's router does nothing, and the menu reads the path set below. */
const router = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, forward() {}, refresh() {} }),
  usePathname: () => router.path,
}));

/**
 * Promises close to the way in (docs/PRE_SHIP_REVIEW.md, "Promises close to the way in (19 Oct 2026)"; OpenPromises
 * decision 30): the rule that picks the home page's cards, its blindness to who made a promise (invariant 7), the block
 * it draws, the line in the opening, one-click links to every card, and Promises in every menu.
 */

const TODAY = "2026-10-19";

interface Spec {
  status?: Status;
  /** Timeline event dates; the first is the promise itself. */
  events?: string[];
  /** Each version's recorded_on. */
  versions?: string[];
  replies?: string[];
  deadline?: string;
  /** Still waiting for the editor's approval. */
  awaiting?: boolean;
}

/** A card with only what the rule reads filled in. */
function card(id: string, s: Spec = {}): SpotlightCard {
  const events = s.events ?? ["2024-01-01"];
  return {
    id,
    status: s.status ?? "promised",
    deadline: s.deadline ?? null,
    versions: (s.versions ?? [events[0]!]).map((recorded_on) => ({ recorded_on })),
    timeline: events.map((date) => ({ date })),
    replies: (s.replies ?? []).map((date) => ({ date })),
    editorCheck: s.awaiting ?? false,
  };
}

const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);

describe("lastChanged", () => {
  it("is the latest event, version or reply date up to today", () => {
    expect(lastChanged(card("a", { events: ["2024-01-01", "2026-03-01"] }), TODAY)).toBe("2026-03-01");
    expect(lastChanged(card("a", { events: ["2024-01-01"], versions: ["2024-01-01", "2026-04-02"] }), TODAY)).toBe("2026-04-02");
    expect(lastChanged(card("a", { events: ["2024-01-01"], replies: ["2026-05-03"] }), TODAY)).toBe("2026-05-03");
  });

  it("counts today and ignores anything dated after it", () => {
    expect(lastChanged(card("a", { events: ["2024-01-01", TODAY] }), TODAY)).toBe(TODAY);
    expect(lastChanged(card("a", { events: ["2024-01-01", "2026-10-20"], versions: ["2024-01-01", "2027-01-01"], replies: ["2026-12-31"] }), TODAY)).toBe("2024-01-01");
    expect(lastChanged(card("a", { events: ["2027-01-01"], versions: ["2027-01-01"] }), TODAY)).toBeUndefined();
  });
});

describe("the rule (OpenPromises decision 30)", () => {
  it("picks the 3 cards that changed last, newest first, ties by id, whatever order they come in", () => {
    const cards = [
      card("e", { events: ["2026-01-01"] }),
      card("d", { events: ["2026-05-01"] }),
      card("c", { events: ["2026-05-01"] }),
      card("b", { events: ["2026-02-01"] }),
      card("a", { events: ["2026-01-01"] }),
    ];
    expect(SPOTLIGHT_SIZE).toBe(3);
    expect(ids(spotlight(cards, TODAY).recent)).toEqual(["c", "d", "b"]);
    expect(ids(spotlight([...cards].reverse(), TODAY).recent)).toEqual(["c", "d", "b"]);
  });

  it("orders by events, rewordings and replies, ignoring anything dated after today", () => {
    const cards = [
      card("future", { events: ["2025-01-01", "2026-12-01"], replies: ["2026-11-01"] }),
      card("replied", { events: ["2025-01-03"], replies: ["2026-10-01"] }),
      card("reworded", { events: ["2025-01-04"], versions: ["2025-01-04", "2026-09-01"] }),
      card("old", { events: ["2025-01-05"] }),
    ];
    expect(ids(spotlight(cards, TODAY).recent)).toEqual(["replied", "reworded", "old"]);
  });

  it("picks up to 3 open cards by nearest deadline from today on, ties by id, never one already in the latest changes", () => {
    const cards = [
      // The three latest changes: one has the nearest deadline of all, and is not repeated.
      card("r1", { events: ["2026-10-10"], deadline: "2026-10-20" }),
      card("r2", { events: ["2026-10-09"] }),
      card("r3", { events: ["2026-10-08"] }),
      card("today", { deadline: TODAY }),
      card("passed", { deadline: "2026-10-18" }),
      card("z-dec", { deadline: "2026-12-31", status: "delivering" }),
      card("a-dec", { deadline: "2026-12-31", status: "budgeted" }),
      card("later", { deadline: "2030-12-31", status: "in_plan" }),
      card("no-deadline"),
    ];
    const { recent, due } = spotlight(cards, TODAY);
    expect(ids(recent)).toEqual(["r1", "r2", "r3"]);
    expect(ids(due)).toEqual(["today", "a-dec", "z-dec"]);
    for (const c of due) expect(ids(recent)).not.toContain(c.id);
  });

  it("takes only open promises: never delivered, failed, quietly dropped or unscoreable", () => {
    const finished: Status[] = ["delivered", "failed", "quietly_dropped", "unscoreable"];
    const open: Status[] = ["promised", "in_plan", "budgeted", "delivering", "not_in_power"];
    const recent = ["x1", "x2", "x3"].map((id) => card(id, { events: ["2026-10-01"] }));
    // Finished cards have the nearer deadlines, so only the status keeps them out.
    const cards = [...recent, ...finished.map((status) => card(status, { status, deadline: "2026-11-01" })), ...open.map((status) => card(status, { status, deadline: "2027-01-01" }))];
    expect(ids(spotlight(cards, TODAY).due)).toEqual(["budgeted", "delivering", "in_plan"]);
    for (const status of open) expect(ids(spotlight([...recent, card(status, { status, deadline: "2027-01-01" })], TODAY).due)).toEqual([status]);
    for (const status of finished) expect(spotlight([...recent, card(status, { status, deadline: "2027-01-01" })], TODAY).due).toEqual([]);
  });

  it("never picks a card that awaits the editor's check", () => {
    const cards = [card("awaiting", { events: [TODAY], deadline: TODAY, awaiting: true }), card("a", { deadline: "2027-01-01" }), card("b", { deadline: "2027-01-01" })];
    const { recent, due } = spotlight(cards, TODAY);
    expect(ids(recent)).toEqual(["a", "b"]);
    expect(due).toEqual([]);
  });

  it("returns empty lists for no cards", () => {
    expect(spotlight([], TODAY)).toEqual({ recent: [], due: [] });
  });
});

const m = buildModel();

describe("one standard for every party (invariant 7)", () => {
  // The real cards, with deadlines added so "due next" has something to choose from on every day tried.
  const dated: PromiseModel[] = m.promises.map((p, i) => ({ ...p, deadline: i % 3 ? `${2026 + (i % 5)}-${String((i % 12) + 1).padStart(2, "0")}-15` : p.deadline }));
  const days = [TODAY, "2026-01-01", "2027-06-30", "2031-01-01"];
  const same = (cards: PromiseModel[]) => {
    for (const day of days) {
      expect(ids(spotlight(cards, day).recent), day).toEqual(ids(spotlight(dated, day).recent));
      expect(ids(spotlight(cards, day).due), day).toEqual(ids(spotlight(dated, day).due));
    }
  };

  it("has cards from more than one party to choose from, and something due on some day", () => {
    expect(new Set(m.promises.map((p) => p.partyId)).size).toBeGreaterThan(1);
    expect(days.some((d) => spotlight(dated, d).due.length > 0)).toBe(true);
  });

  it("picks the same cards when every card's party is swapped", () => {
    const swapped = dated.map((p, i) => {
      const other = dated[(i + 1) % dated.length]!;
      return { ...p, actor: other.actor, party: other.party, partyId: other.partyId, partyShort: other.partyShort, side: other.side };
    });
    same(swapped);
  });

  it("picks the same cards when no party is named", () => {
    for (const side of ["administration", "opposition"] as const) same(dated.map((p) => ({ ...p, actor: "", party: null, partyId: "", partyShort: "", side })));
  });

  it("takes only the cards and the day, and its code reads nothing about who made a promise", () => {
    expect(spotlight.length).toBe(2);
    const file = join(import.meta.dirname, "../lib/spotlight.ts");
    const code = ts.createPrinter({ removeComments: true }).printFile(ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true));
    expect(code).not.toMatch(/actor|party|side|councillor|name|ward/i);
  });
});

/** The text a reader sees: tags dropped, entities read back. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
const OPEN = '<span class="spot-open" aria-hidden="true">Open the promise →</span>';

describe("the promises block on the home page", () => {
  const html = renderToStaticMarkup(createElement(HomePromises, { promises: m.promises, today: TODAY }));
  const { recent, due } = spotlight(m.promises, TODAY);

  it("counts every promise on the promises page, linking there, with each status in the site's words", () => {
    expect(promisesTracked(1)).toBe("1 promise tracked");
    expect(promisesTracked(26)).toBe("26 promises tracked");
    expect(html).toContain(`<h2 id="${HOME_PROMISES_ID}-h"><a href="/promises">${promisesTracked(m.promises.length)}</a></h2>`);
    for (const s of new Set(m.promises.map((p) => p.status)))
      expect(html).toContain(`<b class="num">${m.promises.filter((p) => p.status === s).length}</b> <span class="pill st-${s}">${STATUS_LABEL[s]}</span>`);
  });

  it("lists the latest changes and what is due next, each one link to its card ending \"Open the promise →\"", () => {
    expect(recent).toHaveLength(SPOTLIGHT_SIZE);
    expect(text(html)).toContain("Latest changes");
    expect(text(html)).toContain("Due next");
    const items = [...html.matchAll(/<li><a class="spot-item"(.*?)<\/a><\/li>/g)].map((x) => x[0]);
    expect(items).toHaveLength(recent.length + due.length);
    [...recent, ...due].forEach((p, i) => {
      const item = items[i]!;
      expect(item.match(/<a /g)).toHaveLength(1);
      expect(item.startsWith(`<li><a class="spot-item" href="/promise/${p.id}">`)).toBe(true);
      expect(text(item)).toContain(p.partyShort);
      expect(text(item)).toContain(`“${p.text}”`);
      expect(item).toContain(`<span class="pill st-${p.status}">${STATUS_LABEL[p.status]}</span>`);
      expect(item).toContain(OPEN);
    });
    // Today no open card has a deadline still to come, and the block says so.
    if (!due.length) expect(text(html)).toContain("No open promise has a deadline still to come.");
  });

  it("shows a card's deadline in \"Due next\"", () => {
    const soon = m.promises.filter((p) => !p.editorCheck && p.status !== "delivered").slice(-1)[0]!;
    const out = renderToStaticMarkup(createElement(HomePromises, { promises: m.promises.map((p) => (p.id === soon.id ? { ...p, deadline: "2027-03-31" } : p)), today: TODAY }));
    expect(out).toMatch(new RegExp(`<a class="spot-item" href="/promise/${soon.id}">.*Due Mar 2027.*Open the promise →`));
  });

  it("ends with \"All promises →\", the arrow hidden from screen readers", () => {
    expect(html).toContain('<p class="spot-all"><a href="/promises">All promises <span aria-hidden="true">→</span></a></p>');
  });

  it("draws nothing, and no promise card on the first screen, when no card is published", () => {
    const none = m.promises.map((p) => ({ ...p, editorCheck: true }));
    expect(renderToStaticMarkup(createElement(HomePromises, { promises: none, today: TODAY }))).toBe("");
    expect(renderToStaticMarkup(createElement(HomePromises, { promises: [], today: TODAY }))).toBe("");
    const page = renderToStaticMarkup(createElement(LedgerPage, { m: { ...m, promises: none } }));
    expect(page).not.toContain('id="fs-promises-h"');
    expect(page).not.toContain('aria-label="Promises to watch"');
  });
});

describe("the home page", () => {
  const page = renderToStaticMarkup(createElement(LedgerPage, { m }));
  const main = page.slice(page.indexOf("<main"));

  // The first screen (docs/PRE_SHIP_REVIEW.md, "A short menu and a first screen of cards", 23 Oct 2026) replaced the
  // opening: the count now heads its promises card, beside the year's figures, and the promises block follows it.
  it("has \"N promises tracked\" on its first screen, linking to the promises page, after the year's figures", () => {
    const heading = `<h2 id="fs-promises-h"><a href="/promises">${promisesTracked(m.promises.length)}</a></h2>`;
    expect(main.indexOf(heading)).toBeGreaterThan(main.indexOf('<div class="kpis">'));
    expect(main.indexOf('<div class="kpis">')).toBeGreaterThan(main.indexOf("<h1"));
  });

  it("puts the promises block straight after the first screen, before the bill and every other section", () => {
    const sections = [...main.matchAll(/<section id="([^"]+)"/g)].map((x) => x[1]);
    expect(sections[0]).toBe(HOME_PROMISES_ID);
    expect(sections[1]).toBe("bill");
    expect(main.indexOf(`id="${FIRST_SCREEN_ID}"`)).toBeLessThan(main.indexOf(`id="${HOME_PROMISES_ID}"`));
  });

  it("opens each promise in one click: every row in its Promises section is a link to its card", () => {
    const section = main.slice(main.indexOf('<section id="promises"'));
    const own = section.slice(0, section.indexOf("</section>"));
    const rows = [...own.matchAll(/<a class="prow" href="\/promise\/([a-z0-9-]+)">(.*?)<\/a>/g)];
    expect(rows.length).toBeGreaterThan(0);
    for (const [, id, inner] of rows) {
      expect(m.promises.some((p) => p.id === id)).toBe(true);
      expect(inner).toContain('<span class="prow-open" aria-hidden="true">Open the promise →</span>');
    }
    // No select-then-open step: no pressed cards, no side pane.
    expect(own).not.toContain("pcard");
    expect(own).not.toContain('class="detail"');
  });
});

describe("the promises page", () => {
  it("makes every row one link to its card, ending \"Open the promise →\"", () => {
    const html = renderToStaticMarkup(createElement(PromisesIndex, { promises: m.promises, today: TODAY, initial: NO_FILTERS }));
    const rows = [...html.matchAll(/<li><a class="prow" href="\/promise\/([a-z0-9-]+)">(.*?)<\/a><\/li>/g)];
    expect(rows.map((r) => r[1])).toEqual(m.promises.map((p) => p.id));
    for (const row of rows) {
      const inner = row[2]!;
      expect(inner.match(/<a /g)).toBeNull();
      expect(inner.endsWith('<span class="prow-open" aria-hidden="true">Open the promise →</span>')).toBe(true);
    }
  });

  it("has no buttons standing between a card and its page on the home page's list", () => {
    const html = renderToStaticMarkup(createElement(Promises, { promises: m.promises, today: TODAY, limit: 6, view: "overview" }));
    expect(html).not.toMatch(/<button[^>]*class="pcard"/);
    expect([...html.matchAll(/<a class="prow" href="\/promise\//g)]).toHaveLength(6);
  });
});

describe("Promises in every menu", () => {
  const menu = (html: string) => html.slice(html.indexOf('<nav class="sections"'), html.indexOf("</nav>"));
  const promisesItem = '<a href="/promises" data-section="promises">Promises<span class="sr-only"> in Hammersmith &amp; Fulham</span></a>';

  it("is in Hammersmith & Fulham's menu", () => {
    expect(menu(renderToStaticMarkup(createElement(TopBar, { place: "Hammersmith & Fulham", year: "2026/27" })))).toContain('<a href="/promises" data-section="promises">Promises</a>');
  });

  it("is in the borough pages' menu, after the page's own parts, leading to Hammersmith & Fulham's promises", async () => {
    const { default: BoroughPage } = await import("@/app/[borough]/page");
    for (const borough of ["camden", "manchester", "glasgow", "cardiff", "belfast"]) {
      router.path = `/${borough}`;
      const html = renderToStaticMarkup(await BoroughPage({ params: Promise.resolve({ borough }) }));
      const nav = menu(html);
      expect(nav, borough).toContain(`href="/${borough}#bill"`);
      expect(nav, borough).toMatch(new RegExp(`${promisesItem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      // Not highlighted: the reader is not on the promises page.
      expect(nav, borough).not.toMatch(/aria-current="[^"]*"[^>]*>Promises/);
    }
  });

  it("is in the council tax decoder's menu", () => {
    const html = renderToStaticMarkup(createElement(TopBar, { place: "England", year: "2026/27", borough: { base: "/council-tax", items: DECODER_NAV } }));
    expect(menu(html)).toContain(promisesItem);
  });
});
