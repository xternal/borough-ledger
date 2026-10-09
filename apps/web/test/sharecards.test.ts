import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SHARE_IMAGE, share } from "@/lib/share";

const APP = join(__dirname, "..", "app");
const pages = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? pages(p) : f === "page.tsx" ? [p] : [];
  });

describe("share cards", () => {
  it("every page names its address and an image (Next.js drops the site's image once a page sets its own fields)", () => {
    const missing = pages(APP)
      .filter((p) => relative(APP, p) !== "page.tsx") // the home page's come from the root layout
      .filter((p) => !/\bshare\(/.test(readFileSync(p, "utf8")))
      .map((p) => relative(APP, p));
    expect(missing).toEqual([]);
  });

  it("gives the site's image to a page without its own, and leaves a page's own image to Next.js", () => {
    const plain = share("/sources", "T", "D");
    expect(plain.openGraph).toMatchObject({ url: "/sources", images: [SHARE_IMAGE] });
    expect(plain.twitter).toMatchObject({ card: "summary_large_image", images: [SHARE_IMAGE.url] });
    const own = share("/party/labour", "T", "D", { own: true });
    expect(own.openGraph).not.toHaveProperty("images");
    expect(own.twitter).not.toHaveProperty("images");
    expect(share("/x", "T", "D", { image: { url: "/x/og", alt: "A" } }).openGraph.images).toEqual([{ url: "/x/og", width: 1200, height: 630, alt: "A" }]);
  });
});
