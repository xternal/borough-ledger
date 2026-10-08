/* What each RSS feed holds. Every item comes from data with a source; quality is checked like any rendered number. */
import { DATA, type EVENT_TYPES } from "@borough-ledger/schema";
import { format, formatMonth } from "./format";
import { buildModel, type CouncillorModel, type PromiseModel } from "./model";
import { STATUS_LABEL } from "./promises";
import { assertRenderable } from "./quality";
import { type Feed, type FeedItem, shorten, tag } from "./rss";
import { SITE } from "./site";
import { WARD_SPEND, wardsOf } from "./wards";
import { DECISIONS, STEP_LABEL } from "./decisions";

type EventType = (typeof EVENT_TYPES)[number];

const EVENT_LABEL: Record<EventType, string> = {
  promised: "Promised",
  in_plan: "In a council plan",
  budgeted: "In the budget",
  delivering: "Being delivered",
  delivered: "Delivered",
  failed: "Failed",
  deadline: "Deadline set",
  deadline_missed: "Deadline passed",
  quietly_dropped: "Quietly dropped",
  reworded: "Reworded",
  reply: "Reply",
};

const lastDay = (ym: string) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
/** £45.6m for big amounts, £462,042 under a million. */
const money = (v: number) => format(Math.abs(v) >= 1e6 ? "pm1" : "gbp0", v);

/** A pledge's history: the card being added, each dated event and each reply. Same for every party. */
export function promiseItems(p: PromiseModel): FeedItem[] {
  const path = `/promise/${p.id}`;
  const q = `“${shorten(p.text, 80)}”`;
  const who = p.party ? `${p.actor}, ${p.party}` : p.partyShort;
  const now = `Status today: ${STATUS_LABEL[p.status]}.`;
  return [
    {
      title: `New pledge card (${who}): ${q}`,
      path,
      guid: tag("promise", p.id, "added"),
      date: p.versions[0]!.recorded_on,
      description: `${p.actor} pledged: “${p.text}” ${now}`,
    },
    ...p.timeline.map((e, i) => ({
      title: `${EVENT_LABEL[e.type as EventType] ?? e.type} (${who}): ${q}`,
      path,
      guid: tag("promise", p.id, "event", i),
      date: e.date,
      description: `${e.event.replace(/\.?$/, ".")} ${now}`,
    })),
    ...p.replies.map((r, i) => ({
      title: `Reply from ${r.from}: ${q}`,
      path,
      guid: tag("promise", p.id, "reply", i),
      date: r.date,
      description: r.text,
    })),
  ];
}

/** One item a month: what the council's spend files show it paid. */
export function paymentItems(): FeedItem[] {
  const p = DATA.payments;
  assertRenderable(p.meta.quality, "payments feed");
  return p.months.map((m) => ({
    title: `Payments in ${formatMonth(m.month)}: ${money(m.total)}`,
    path: `/payments/${m.month}`,
    guid: tag("payments", m.month),
    date: lastDay(m.month),
    description: `${format("int", m.rows)} payments over £500 in the council's own spend files, ${money(m.total)} excluding VAT. ${money(m.withheld_total)} of it was paid to people and is shown only as totals.`,
  }));
}

const PROMISES_FEED = (ps: PromiseModel[]): FeedItem[] => ps.flatMap(promiseItems);

/** One item per Cabinet or Full Council decision, naming any pledge an editor confirmed it moves. */
export function decisionItems(): FeedItem[] {
  const m = buildModel();
  const promises = new Map(m.promises.map((p) => [p.id, p]));
  return DECISIONS.decisions.map((d) => {
    const moves = DATA.content.decision_links
      .filter((l) => l.decision_id === d.id && promises.has(l.promise_id))
      .map((l) => `${STEP_LABEL[l.event]}: ${promises.get(l.promise_id)!.partyShort} pledge \u201c${shorten(promises.get(l.promise_id)!.text, 70)}\u201d.`);
    return {
      title: `${d.body}: ${d.title}`,
      path: `/decisions#${d.id}`,
      guid: tag("decision", d.id),
      date: d.date,
      description: [...moves, shorten(d.text.replace(/\n/g, " "), 600)].join(" "),
    };
  });
}

export function decisionsFeed(): Feed {
  const m = buildModel();
  return {
    title: `${SITE.name}: council decisions in ${m.place.short}`,
    description: "Every Cabinet and Full Council decision, with the pledges an editor confirmed it moves.",
    path: "/decisions",
    self: "/decisions/feed.xml",
    items: decisionItems(),
  };
}

export function everythingFeed(): Feed {
  const m = buildModel();
  return {
    title: `${SITE.name}: everything new`,
    description: `New pledge cards, changes to every pledge, replies, council decisions and each month of payments, for ${m.place.short}.`,
    path: "/",
    self: "/feed.xml",
    items: [...PROMISES_FEED(m.promises), ...decisionItems(), ...paymentItems()],
  };
}

export function promisesFeed(): Feed {
  const m = buildModel();
  return {
    title: `${SITE.name}: promises in ${m.place.short}`,
    description: "Every pledge card: new cards, status changes, deadlines and replies, for every party alike.",
    path: "/promises",
    self: "/promises/feed.xml",
    items: PROMISES_FEED(m.promises),
  };
}

export function promiseFeed(id: string): Feed | null {
  const p = buildModel().promises.find((x) => x.id === id);
  if (!p) return null;
  return {
    title: `${SITE.name}: ${shorten(p.text, 70)}`,
    description: `Changes to one pledge by ${p.actor}: its status, deadlines and replies.`,
    path: `/promise/${p.id}`,
    self: `/promise/${p.id}/feed.xml`,
    items: promiseItems(p),
  };
}

export function paymentsFeed(): Feed {
  const m = buildModel();
  return {
    title: `${SITE.name}: payments over £500 in ${m.place.short}`,
    description: "One item for each month of the council's spend files, as each quarter is added.",
    path: "/payments",
    self: "/payments/feed.xml",
    items: paymentItems(),
  };
}

/** The councillor's own pledges, and their party's manifesto pledges. */
export function councillorFeed(id: string): Feed | null {
  const m = buildModel();
  const c: CouncillorModel | undefined = m.people.councillors.find((x) => x.id === id);
  if (!c) return null;
  const own = m.promises.filter((p) => p.actor === c.name);
  const party = m.promises.filter((p) => p.partyId === c.partyId && p.party === null);
  return {
    title: `${SITE.name}: ${c.name}, ${c.ward}`,
    description: `Pledges by ${c.name} and by the ${c.party} party: new cards, status changes and replies.`,
    path: `/councillor/${c.id}`,
    self: `/councillor/${c.id}/feed.xml`,
    items: PROMISES_FEED([...own, ...party]),
  };
}

/** Pledges about the ward, pledges by its councillors, and each month's building work there. */
export function wardFeed(id: string): Feed | null {
  const m = buildModel();
  const w = wardsOf(m).find((x) => x.id === id);
  if (!w) return null;
  assertRenderable(WARD_SPEND.quality, `ward feed ${id}`);
  const names = new Set(w.councillors.map((c) => c.name));
  const pledges = m.promises.filter((p) => p.wardId === id || names.has(p.actor));
  const months = Object.entries(WARD_SPEND.wards[id]?.months ?? {}).filter(([, v]) => v !== 0);
  return {
    title: `${SITE.name}: ${w.name} ward`,
    description: `Pledges about ${w.name}, pledges by its councillors, and building work the council pays for there.`,
    path: `/ward/${id}`,
    self: `/ward/${id}/feed.xml`,
    items: [
      ...PROMISES_FEED(pledges),
      ...months.map(([ym, v]) => ({
        title: `Building work in ${w.name}, ${formatMonth(ym)}: ${money(v)}`,
        path: `/ward/${id}`,
        guid: tag("ward", id, "building", ym),
        date: lastDay(ym),
        description: `The council's spend files show ${money(v)} paid in ${formatMonth(ym)} for building schemes in ${w.name}, excluding VAT. Which ward each scheme is in is our estimate from its name${WARD_SPEND.quality === "sourced" ? ", checked by hand" : ""}.`,
      })),
    ],
  };
}

/** Every feed with a fixed address, for /follow and the tests. */
export function allFeeds(): Feed[] {
  return [
    everythingFeed(),
    promisesFeed(),
    decisionsFeed(),
    paymentsFeed(),
    ...DATA.content.promises.map((p) => promiseFeed(p.id)!),
    ...DATA.content.wards.wards.map((w) => wardFeed(w.id)!),
    ...DATA.content.councillors.map((c) => councillorFeed(c.id)!),
  ];
}
