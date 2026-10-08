import { describe, expect, it } from "vitest";
import { buildModel } from "@/lib/model";
import { dateModified, promiseMarkdown, promiseQA, promiseSummary } from "@/lib/promiseText";
import { councillorJsonLd, promiseJsonLd, promisesJsonLd } from "@/lib/structured";

describe("structured data", () => {
  const m = buildModel();

  it("describes each pledge as an article about the quotation, with its status in words, dates and sources", () => {
    const p = m.promises.find((x) => x.id === "lab-2026-green-schemes")!;
    const summary = promiseSummary(p, m);
    const [article, faq, crumbs] = promiseJsonLd(p, summary, dateModified(p), promiseQA(p, m), m.place.council);
    expect(article).toMatchObject({ "@type": "Article", abstract: summary, datePublished: p.versions[0]!.recorded_on, dateModified: dateModified(p) });
    expect(article.about).toMatchObject({ "@type": "Quotation", text: p.text, dateCreated: p.made_on, creator: { "@type": "Organization", name: p.actor } });
    expect(article.about).toHaveProperty("isBasedOn", p.sources[0]!.url);
    // A confirmed council decision is cited as a source.
    expect(article.citation.some((u) => u.includes("democracy.lbhf.gov.uk"))).toBe(true);
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
    expect(crumbs.itemListElement).toHaveLength(3);
  });

  it("answers the status question the same way for every party", () => {
    for (const p of m.promises) {
      const s = promiseSummary(p, m);
      expect(s).toContain(p.text);
      expect(s).toContain("Status on Borough Book");
      expect(s).not.toContain("\u00b7");
      expect(promiseMarkdown(p, m)).toContain(`/promise/${p.id}`);
    }
  });

  it("lists every card on the promises page", () => {
    const [page] = promisesJsonLd(m.promises);
    expect(page.mainEntity.numberOfItems).toBe(m.promises.length);
  });

  it("describes a councillor in their public role only", () => {
    const c = m.people.councillors[0]!;
    const about = councillorJsonLd(c)[0].about;
    expect(Object.keys(about).sort()).toEqual(["@type", "affiliation", "jobTitle", "name", "sameAs"]);
    expect(about.sameAs).toEqual([c.democracy_url]);
  });
});

describe("sources", () => {
  it("puts every source in exactly one group", async () => {
    const { groupSources } = await import("@/lib/sources");
    const m = buildModel();
    const groups = groupSources(m.sources);
    expect(groups.reduce((a, g) => a + g.items.length, 0)).toBe(m.sources.length);
    expect(groups.map((g) => g.id)).not.toContain("other");
    expect(groups.find((g) => g.id === "spend")?.items.length).toBe(15);
  });
});
