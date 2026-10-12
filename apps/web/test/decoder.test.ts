import { describe, expect, it } from "vitest";
import { decodedCouncil, decodedCouncils, decoderFindings } from "@/lib/decoder";
import { DECODER_NAV } from "@/lib/decoderPage";

describe("the council tax decoder", () => {
  it("covers all 296 English councils that send bills, each adding up, each with a page of its own", () => {
    const all = decodedCouncils();
    expect(all).toHaveLength(296);
    expect(new Set(all.map((c) => c.slug)).size).toBe(296);
    for (const c of all) {
      const sum = c.parts.reduce((a, p) => a + p.f.value, 0);
      expect(Math.abs(sum - c.total.value)).toBeLessThan(0.011);
      expect(c.parts[0]!.id).toBe("council");
      expect(c.total.quality).toBe("sourced");
    }
  });

  it("finds where councils' own shares rose most, and where the rest of the bill drove the rise", () => {
    const F = decoderFindings();
    expect(new Set(F.topOwn.slice(0, 2).map((x) => x.c.name))).toEqual(new Set(["North Somerset", "Shropshire"]));
    expect(F.topOwn.slice(0, 2).map((x) => Math.round(x.pct.value * 100) / 100)).toEqual([8.99, 8.99]);
    expect(F.frozen).toHaveLength(21);
    expect(F.frozen.every((c) => c.kind === "district council" && c.ownChange.value <= 0 && c.change.value > 0)).toBe(true);
    expect(F.preceptLed[0]!.c.kind).not.toBe("district council");
    expect(Math.round(F.preceptLed[0]!.share.value * 100)).toBe(66);
    expect(Math.round(F.medianOwnPct.value * 100) / 100).toBe(2.99);
  });

  it("names each body plainly, and links to the fuller page where BoroughBook.UK has one", () => {
    const so = decodedCouncil("south-oxfordshire")!;
    expect(so.parts.map((p) => p.body)).toEqual(["South Oxfordshire Council", "Oxfordshire County Council", "Thames Valley Police and Crime Commissioner", "Parish and town councils"]);
    expect(so.sitePage).toBe("/south-oxfordshire");
    expect(decodedCouncil("hammersmith-and-fulham")!.sitePage).toBe("/");
    expect(decodedCouncil("barnet")!.sitePage).toBeNull();
    const city = decodedCouncil("city-of-london")!;
    expect([city.place, city.councilName, city.parts[0]!.body]).toEqual(["the City of London", "the City of London Corporation", "City of London Corporation"]);
    expect(decodedCouncil("nowhere")).toBeNull();
  });

  it("has its own menu, with every council's page under 'Every council'", () => {
    expect(DECODER_NAV.map(([id]) => id)).toEqual(["find", "england", "councils", "questions"]);
  });
});
