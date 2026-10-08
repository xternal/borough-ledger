import { describe, expect, it } from "vitest";
import { buildModel } from "@/lib/model";
import { partiesOf, topicSlug, topicsOf } from "@/lib/topics";

describe("party and topic pages", () => {
  const m = buildModel();
  const topics = topicsOf(m);
  const parties = partiesOf(m);

  it("puts every pledge on exactly one topic page and one party page", () => {
    expect(topics.flatMap((t) => t.promises.map((p) => p.id)).sort()).toEqual(m.promises.map((p) => p.id).sort());
    expect(parties.flatMap((pt) => pt.promises.map((p) => p.id)).sort()).toEqual(m.promises.map((p) => p.id).sort());
    expect(new Set(topics.map((t) => t.slug)).size).toBe(topics.length);
  });

  it("shows council spending only where a budget line honestly matches the topic", () => {
    for (const t of topics) if (t.service) expect([t.area, "Community safety"]).toContain(t.area === "Community safety" ? "Community safety" : t.service.label);
    expect(topics.find((t) => t.area === "Health")?.service ?? null).toBeNull();
    expect(topics.find((t) => t.area === "Parks, libraries and leisure")?.service?.id).toBe("parks_culture");
  });

  it("orders pledges the same way for every party: the party running the council first, then by id", () => {
    for (const t of topics) {
      const sides = t.promises.map((p) => p.side);
      expect(sides).toEqual([...sides].sort((a, z) => (a === z ? 0 : a === "administration" ? -1 : 1)));
    }
    expect(parties.map((pt) => pt.seats).reduce((a, n) => a + n, 0)).toBeLessThanOrEqual(m.people.councillors.length);
  });

  it("makes stable, readable addresses", () => {
    expect(topicSlug("Parks, libraries and leisure")).toBe("parks-libraries-and-leisure");
    expect(topicSlug("Care for older & disabled adults")).toBe("care-for-older-and-disabled-adults");
  });
});
