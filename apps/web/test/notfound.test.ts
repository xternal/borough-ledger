import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import NotFound, { metadata } from "@/app/not-found";
import { FAMILY, THIS_SITE } from "@/lib/family";
import { MAKER } from "@/lib/site";

vi.mock("next/navigation", () => ({ usePathname: () => "/no-such-page", useRouter: () => ({ push: () => {} }) }));

describe("the family 404 page (Pavel, 23 Oct 2026)", () => {
  const html = renderToStaticMarkup(createElement(NotFound));
  const section = html.slice(html.indexOf('<section class="nf-family"'), html.indexOf("</section>"));

  it("says the page isn't here, and leads back to the home page and the promises", () => {
    expect(html).toContain("This page isn&#x27;t here");
    expect(html).toContain("The link may be old or mistyped.");
    expect(html).toContain('<a href="/">The home page</a>');
    expect(html).toContain('<a href="/promises">The promises</a>');
    for (const href of ["/bill", "/budget", "/payments"]) expect(html).toContain(`<a href="${href}">`);
  });

  it("lists every site of the family, in the switcher's order, and marks this one as here", () => {
    expect(section).toContain("<h2 id=\"nf-family-h\">The family</h2>");
    const names = [...section.matchAll(/<b>([^<]+)<\/b>/g)].map((m) => m[1]);
    expect(names).toEqual(FAMILY.map((s) => s.name));
    for (const s of FAMILY) {
      expect(section).toContain(s.about.replaceAll("'", "&#x27;"));
      if (s.name !== THIS_SITE) expect(section).toContain(`<a href="${s.href}"><b>${s.name}</b><span class="nf-domain">${new URL(s.href).host}</span>`);
    }
    expect(section).toContain(`<a href="/" aria-current="page"><b>${THIS_SITE}</b><span class="nf-domain">You are here</span>`);
    expect(section.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("keeps the footer credit and uses no middle dots", () => {
    expect(html).toContain(`href="${MAKER.url}"`);
    expect(html).toContain(`<a href="${MAKER.coffee}">Buy me a matcha</a>`);
    expect(html).not.toContain("·");
  });

  it("is kept out of search engines, with its own title and description", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(String(metadata.title)).toBe("Page not found | BoroughBook.UK");
    expect(metadata.description).toBeTruthy();
    expect(String(metadata.description)).not.toContain("·");
  });
});
