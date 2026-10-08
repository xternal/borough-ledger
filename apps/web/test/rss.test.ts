import { describe, expect, it } from "vitest";
import { DATA } from "@borough-ledger/schema";
import { allFeeds, councillorFeed, decisionsFeed, paymentsFeed, promiseFeed, wardFeed } from "@/lib/feeds";
import { escapeXml, rfc822, renderFeed, sortItems } from "@/lib/rss";

describe("RSS feeds", () => {
  it("escapes text and dates items the way RSS readers expect", () => {
    expect(escapeXml(`Fish & chips <b>"now"</b> 'please'`)).toBe("Fish &amp; chips &lt;b&gt;&quot;now&quot;&lt;/b&gt; &apos;please&apos;");
    expect(rfc822("2026-10-08")).toBe("Thu, 08 Oct 2026 12:00:00 GMT");
    const items = [
      { title: "b", path: "/", guid: "1", date: "2026-01-01", description: "" },
      { title: "a", path: "/", guid: "2", date: "2026-05-01", description: "" },
    ];
    expect(sortItems(items).map((i) => i.guid)).toEqual(["2", "1"]);
  });

  it("gives every pledge, ward and councillor a feed, with unique item ids and no middle dots", () => {
    const feeds = allFeeds();
    expect(feeds.length).toBe(4 + DATA.content.promises.length + DATA.content.wards.wards.length + DATA.content.councillors.length);
    for (const f of feeds) {
      const guids = f.items.map((i) => i.guid);
      expect(new Set(guids).size).toBe(guids.length);
      const xml = renderFeed(f);
      expect(xml).not.toContain("·");
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
      expect(xml).toContain(`rel="self"`);
      for (const i of f.items) expect(i.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("follows a pledge through its events and replies, for every party alike", () => {
    for (const p of DATA.content.promises) {
      const f = promiseFeed(p.id)!;
      expect(f.items.length).toBe(1 + p.events.length + p.replies.length);
      expect(f.items[0]!.guid).toMatch(/^tag:borough-ledger,2026:promise\//);
    }
  });

  it("puts each month of payments and each month of a ward's building work in its feed", () => {
    expect(paymentsFeed().items.length).toBe(DATA.payments.months.length);
    const wc = wardFeed("white-city")!;
    expect(wc.items.some((i) => i.title.startsWith("Building work in White City"))).toBe(true);
    expect(wardFeed("nowhere")).toBeNull();
  });

  it("has one item for every council decision", () => {
    expect(decisionsFeed().items.length).toBe(DATA.decisions.decisions.length);
  });

  it("follows a councillor through their party's manifesto pledges", () => {
    const c = DATA.content.councillors[0]!;
    const f = councillorFeed(c.id)!;
    const party = DATA.content.promises.filter((p) => p.actor.kind === "party" && p.actor.id === c.party);
    expect(f.items.length).toBeGreaterThanOrEqual(party.length);
  });
});
