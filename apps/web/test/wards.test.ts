import { describe, expect, it } from "vitest";
import { DATA } from "@borough-ledger/schema";
import { buildModel } from "@/lib/model";
import { lookupWard, normalisePostcode, wardFromResult } from "@/lib/wardFinder";
import { BOROUGH_SPEND, WARD_SPEND, finderData, fixMyStreetUrl, partyMix, wardsOf } from "@/lib/wards";

const m = buildModel();
const { wards, councilCode } = finderData(m);
const broadway = wards.find((w) => w.id === "hammersmith-broadway")!;

describe("postcode to ward", () => {
  it("accepts whole postcodes however they are typed, and nothing else", () => {
    expect(normalisePostcode("w69ju")).toBe("W6 9JU");
    expect(normalisePostcode(" sw6  1ab ")).toBe("SW6 1AB");
    expect(normalisePostcode("NW10 6RB")).toBe("NW10 6RB");
    expect(normalisePostcode("W6")).toBeNull();
    expect(normalisePostcode("hello")).toBeNull();
  });

  it("finds our ward by its ONS code, and says when a postcode is in another borough", () => {
    const ours = { postcode: "W6 9JU", admin_district: "Hammersmith and Fulham", codes: { admin_ward: broadway.ons_code, admin_district: councilCode } };
    expect(wardFromResult(ours, wards, councilCode)).toEqual({ kind: "ward", id: "hammersmith-broadway", name: broadway.name, postcode: "W6 9JU" });
    const ealing = { postcode: "W3 6RS", admin_district: "Ealing", codes: { admin_ward: "E05013520", admin_district: "E09000009" } };
    expect(wardFromResult(ealing, wards, councilCode)).toEqual({ kind: "elsewhere", district: "Ealing", postcode: "W3 6RS" });
    expect(wardFromResult(null, wards, councilCode)).toEqual({ kind: "not_found" });
  });

  it("sends the postcode in the body of a POST to postcodes.io, never in the address, and survives a failure", async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const ok = (async (url: string, init?: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ status: 200, result: [{ query: "W6 9JU", result: { postcode: "W6 9JU", admin_district: "Hammersmith and Fulham", codes: { admin_ward: broadway.ons_code, admin_district: councilCode } } }] }));
    }) as unknown as typeof fetch;
    expect((await lookupWard("w6 9ju", wards, councilCode, ok)).kind).toBe("ward");
    expect(seen!.init?.method).toBe("POST");
    expect(seen!.url).not.toContain("9JU");
    expect(String(seen!.init?.body)).toContain("W6 9JU");
    expect(seen!.init?.credentials).toBe("omit");
    const notFound = (async () => new Response(JSON.stringify({ status: 200, result: [{ query: "ZZ1 1ZZ", result: null }] }))) as unknown as typeof fetch;
    expect(await lookupWard("ZZ1 1ZZ", wards, councilCode, notFound)).toEqual({ kind: "not_found" });
    const down = (async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    expect(await lookupWard("W6 9JU", wards, councilCode, down)).toEqual({ kind: "error" });
    expect(await lookupWard("W6", wards, councilCode, down)).toEqual({ kind: "invalid" });
  });
});

describe("ward pages", () => {
  const all = wardsOf(m);

  it("has every ward, each with its councillors, a shape and neighbours on the map", () => {
    expect(all.length).toBe(DATA.content.wards.wards.length);
    expect(all.flatMap((w) => w.councillors).length).toBe(m.people.councillors.length);
    for (const w of all) {
      expect(w.councillors.length).toBeGreaterThan(0);
      expect(w.shape.path.startsWith("M")).toBe(true);
      expect(w.neighbours.length).toBeGreaterThan(0);
      for (const n of w.neighbours) expect(all.find((x) => x.id === n)?.neighbours).toContain(w.id);
    }
  });

  it("links FixMyStreet by the ONS ward name, encoded as FixMyStreet expects", () => {
    expect(fixMyStreetUrl("Addison")).toBe("https://www.fixmystreet.com/reports/Hammersmith+and+Fulham/Addison");
    expect(fixMyStreetUrl("Shepherd's Bush Green")).toBe("https://www.fixmystreet.com/reports/Hammersmith+and+Fulham/Shepherd%27s+Bush+Green");
    expect(fixMyStreetUrl("College Park & Old Oak")).toBe("https://www.fixmystreet.com/reports/Hammersmith+and+Fulham/College+Park+%26+Old+Oak");
  });

  it("shows each ward's building schemes with the table's quality, adding up to its total", () => {
    for (const w of all) {
      expect(w.spend.total.quality).toBe(WARD_SPEND.quality);
      expect(w.spend.schemes.reduce((a, x) => a + x.total.value, 0)).toBeCloseTo(w.spend.total.value, 1);
      for (const x of [...w.spend.schemes, ...w.spend.shared]) expect(x.total.sources.length).toBeGreaterThan(0);
      for (const x of w.spend.shared) expect(x.others.length).toBeGreaterThan(0);
    }
    const broadway = all.find((w) => w.id === "hammersmith-broadway")!;
    expect(broadway.spend.schemes.some((x) => /Town Hall/.test(x.label))).toBe(true);
    const parts = BOROUGH_SPEND.place.value + BOROUGH_SPEND.several.value + BOROUGH_SPEND.borough.value + BOROUGH_SPEND.unknown.value;
    expect(parts).toBeLessThanOrEqual(BOROUGH_SPEND.total.value + 1);
    expect(BOROUGH_SPEND.total.value - parts).toBeLessThan(10_000); // only the council's own sites outside the borough are left
  });

    it("describes each ward's councillors the same way for every party", () => {
    expect(partyMix(["Labour", "Labour", "Labour"])).toBe("all Labour");
    expect(partyMix(["Conservative", "Conservative"])).toBe("both Conservative");
    expect(partyMix(["Labour", "Labour", "Conservative"])).toBe("two Labour and one Conservative");
    expect(partyMix(["Conservative", "Labour", "Labour"])).toBe("one Conservative and two Labour");
  });
});

describe("postcode finder across boroughs", () => {
  it("sends a Hammersmith & Fulham postcode to its ward page and a Kensington and Chelsea one to its ward on the borough page", async () => {
    const { PLACES } = await import("@/lib/places");
    const { placeFromResult } = await import("@/lib/wardFinder");
    const hf = PLACES[0]!.wards[0]!;
    const kc = PLACES.find((p) => p.short === "Kensington and Chelsea")!;
    const r1 = placeFromResult({ postcode: "W6 9JU", admin_district: "Hammersmith and Fulham", codes: { admin_ward: hf.ons_code, admin_district: PLACES[0]!.ons } }, PLACES);
    expect(r1).toMatchObject({ kind: "ward", href: hf.href, placeHref: "/" });
    expect(hf.href).toMatch(/^\/ward\//);
    const w = kc.wards.find((x) => x.name === "Queen's Gate")!;
    const r2 = placeFromResult({ postcode: "W8 5LS", admin_district: "Kensington and Chelsea", codes: { admin_ward: w.ons_code, admin_district: kc.ons } }, PLACES);
    expect(r2).toMatchObject({ kind: "ward", href: "/kensington-and-chelsea#ward-queens-gate", place: "Kensington and Chelsea", placeHref: "/kensington-and-chelsea" });
  });

  it("finds a ward in Scotland: Glasgow's City Chambers", async () => {
    const { PLACES } = await import("@/lib/places");
    const { placeFromResult } = await import("@/lib/wardFinder");
    const glasgow = PLACES.find((p) => p.short === "Glasgow")!;
    const w = glasgow.wards.find((x) => x.name === "Anderston/City/Yorkhill")!;
    expect(placeFromResult({ postcode: "G2 1DU", admin_district: "Glasgow City", codes: { admin_ward: w.ons_code, admin_district: "S12000049" } }, PLACES)).toMatchObject({
      kind: "ward",
      href: "/glasgow#ward-anderston-city-yorkhill",
      placeHref: "/glasgow",
    });
  });

  it("opens the council's page where its wards are not on the site yet", async () => {
    const { PLACES } = await import("@/lib/places");
    const { placeFromResult } = await import("@/lib/wardFinder");
    const leeds = PLACES.find((p) => p.short === "Leeds")!;
    expect(leeds.wards).toEqual([]);
    expect(placeFromResult({ postcode: "LS1 1UR", admin_district: "Leeds", codes: { admin_ward: "E05011409", admin_district: leeds.ons } }, PLACES)).toEqual({
      kind: "council",
      place: "Leeds",
      href: "/leeds",
      postcode: "LS1 1UR",
    });
  });

  it("says where a postcode outside the covered boroughs is", async () => {
    const { PLACES } = await import("@/lib/places");
    const { placeFromResult } = await import("@/lib/wardFinder");
    // Islington: held back while its two council tax returns differ (docs/BOROUGHS.md).
    expect(placeFromResult({ postcode: "N1 2UD", admin_district: "Islington", codes: { admin_ward: "E05013710", admin_district: "E09000019" } }, PLACES)).toEqual({
      kind: "elsewhere",
      district: "Islington",
      postcode: "N1 2UD",
    });
  });
});

