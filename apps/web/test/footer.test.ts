import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/Footer";
import { ALSO_BY } from "@/lib/site";

const footer = (props: { council: string; hasTestData: boolean; full?: string }) => renderToStaticMarkup(createElement(Footer, props));

/** Every link in the footer whose text is the other project's name, with its attributes. */
function alsoByLinks(html: string) {
  return [...html.matchAll(/<a ([^>]*)>([^<]*)<\/a>/g)]
    .filter((a) => a[2] === ALSO_BY.name)
    .map((a) => Object.fromEntries([...a[1]!.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!])));
}

describe("the footer's link to the author's other project (Pavel, 19 Oct 2026)", () => {
  const html = footer({ council: "Hammersmith & Fulham", hasTestData: false });

  it("says \"Also by the author: Ruminator.xyz\", with the link on the name", () => {
    expect(html).toContain(`Also by the author: <a href="https://ruminator.xyz/" rel="noopener noreferrer">Ruminator.xyz</a>`);
    expect(alsoByLinks(html)).toEqual([{ href: "https://ruminator.xyz/", rel: "noopener noreferrer" }]);
  });

  it("is a plain address: no query string, no fragment, nothing counted", () => {
    const url = new URL(ALSO_BY.url);
    expect(url.origin).toBe("https://ruminator.xyz");
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    expect(html).not.toMatch(/ruminator\.xyz\/?[?#]/);
  });

  it("is the same link on every page, whatever the council or data", () => {
    for (const props of [
      { council: "Camden", hasTestData: true },
      { council: "England", full: "any council", hasTestData: false },
      { council: "Kensington and Chelsea", full: "the Royal Borough of Kensington and Chelsea", hasTestData: false },
    ])
      expect(alsoByLinks(footer(props))).toEqual(alsoByLinks(html));
  });

  it("sits with the credit, separated by layout, never a middle dot", () => {
    expect(html).toMatch(/<span class="credit">.*Also by the author: .*<\/span><\/span>/);
    expect(html).not.toContain("\u00b7");
  });
});
