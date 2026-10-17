import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SECTIONS, nextSection, sectionForPath, sectionHref } from "@/lib/nav";

const WEB = fileURLToPath(new URL("..", import.meta.url));

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if ([".ts", ".tsx"].includes(extname(p))) yield p;
  }
}

describe("where you are", () => {
  it("highlights the section a page belongs to", () => {
    expect(sectionForPath("/bill")).toBe("bill");
    expect(sectionForPath("/council-tax-rise")).toBe("bill");
    expect(sectionForPath("/council-tax-rise/band-d")).toBe("bill");
    expect(sectionForPath("/budget")).toBe("budget");
    expect(sectionForPath("/building")).toBe("budget");
    expect(sectionForPath("/council-homes")).toBe("budget");
    expect(sectionForPath("/gap")).toBe("gap");
    expect(sectionForPath("/balance")).toBe("balance");
    expect(sectionForPath("/method")).toBe("method");
    expect(sectionForPath("/promises")).toBe("promises");
    expect(sectionForPath("/promise/lab-2026-parks")).toBe("promises");
    expect(sectionForPath("/decisions")).toBe("promises");
    expect(sectionForPath("/party/labour")).toBe("promises");
    expect(sectionForPath("/topic/health")).toBe("promises");
    expect(sectionForPath("/wards")).toBe("ward");
    expect(sectionForPath("/ward/addison")).toBe("ward");
    expect(sectionForPath("/councillor/stephen-cowan")).toBe("ward");
    expect(sectionForPath("/councillors")).toBe("ward");
    expect(sectionForPath("/wardsxyz")).toBeNull();
    expect(sectionForPath("/payments")).toBe("payments");
    expect(sectionForPath("/payments/2026-06")).toBe("payments");
    expect(sectionForPath("/supplier/veolia-es-uk-ltd")).toBe("payments");
    expect(sectionForPath("/sources")).toBe("method");
    expect(sectionForPath("/follow/manage")).toBe("method");
    expect(sectionForPath("/privacy")).toBe("method");
    expect(sectionForPath("/most-read")).toBe("method");
    expect(sectionForPath("/promisesxyz")).toBeNull();
    expect(sectionForPath("/billing")).toBeNull();
    expect(sectionForPath("/gaps")).toBeNull();
  });

  it("highlights nothing on the home page, which is every section at once", () => {
    expect(sectionForPath("/")).toBeNull();
    // Nor on pages outside Hammersmith & Fulham's sections.
    expect(sectionForPath("/council-tax")).toBeNull();
    expect(sectionForPath("/camden")).toBeNull();
  });

  it("highlights each section on its own page", () => {
    for (const [id] of SECTIONS) expect(sectionForPath(sectionHref(id)), id).toBe(id);
  });
});

describe("a page for every section", () => {
  it("links each section to a real page, never an anchor on the home page", () => {
    for (const [id] of SECTIONS) {
      const href = sectionHref(id);
      expect(href, id).toMatch(/^\/[a-z-]+$/);
    }
    expect(sectionHref("bill")).toBe("/bill");
    expect(sectionHref("budget")).toBe("/budget");
    expect(sectionHref("gap")).toBe("/gap");
    expect(sectionHref("balance")).toBe("/balance");
    expect(sectionHref("method")).toBe("/method");
    expect(sectionHref("promises")).toBe("/promises");
    expect(sectionHref("payments")).toBe("/payments");
    expect(sectionHref("ward")).toBe("/wards");
  });

  it("has a page file for every section", () => {
    for (const [id] of SECTIONS) expect(existsSync(join(WEB, "app", sectionHref(id), "page.tsx")), `app${sectionHref(id)}/page.tsx`).toBe(true);
  });

  it("goes on to the next section in the order of the home page", () => {
    expect(nextSection("bill")).toBe("budget");
    expect(nextSection("balance")).toBe("promises");
    expect(nextSection("method")).toBeNull();
  });

  it("leaves no link to an anchor on the home page in the site's source", () => {
    // The home page keeps its anchors so old /#bill links still open there, but the site links to the pages.
    const hits: string[] = [];
    for (const dir of ["app", "components", "lib"])
      for (const f of sources(join(WEB, dir)))
        readFileSync(f, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (/["'`]\/#|SITE_URL\}\/#|location\.hash\s*=/.test(line)) hits.push(`${f.slice(WEB.length)}:${i + 1}`);
          });
    expect(hits).toEqual([]);
  });
});

describe("promise filters", () => {
  it("name each side from the data and count it, the same way for every party", async () => {
    const { buildModel } = await import("@/lib/model");
    const { sides } = await import("@/lib/promises");
    const m = buildModel();
    const s = sides(m.promises);
    expect(s.map((x) => x.label)).toEqual(["Labour, runs the council", "Conservative, opposition"]);
    expect(s.reduce((a, x) => a + x.count, 0)).toBe(m.promises.length);
    // A different council with no overall control would read: everyone is opposition, still from the data.
    const hung = m.promises.map((p) => ({ ...p, side: "opposition" as const }));
    expect(sides(hung).map((x) => x.label)).toEqual(["Labour, Conservative, opposition"]);
  });
});
