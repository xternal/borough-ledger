import { describe, expect, it } from "vitest";
import { buildModel } from "@/lib/model";
import { councillorJsonLd, promiseJsonLd, promisesJsonLd } from "@/lib/structured";

describe("structured data", () => {
  const m = buildModel();

  it("quotes each pledge from whoever made it, citing its source", () => {
    const p = m.promises.find((x) => x.id === "lab-2026-hospital")!;
    const [quote, crumbs] = promiseJsonLd(p);
    expect(quote).toMatchObject({ "@type": "Quotation", text: p.text, dateCreated: p.made_on, creator: { "@type": "Organization", name: p.actor } });
    expect(quote).toHaveProperty("isBasedOn", p.sources[0]!.url);
    expect(crumbs.itemListElement).toHaveLength(3);
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
