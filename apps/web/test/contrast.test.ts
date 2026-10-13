import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* The colours, read from the stylesheet. In light and dark mode alike, every text colour passes WCAG AA (4.5:1) on
   the page and both surfaces, and every rule that sets a text colour on a background passes on what it actually paints
   (tinted pills included). In dark mode chart marks also pass 3:1, and the palette stays dark brown: lifted off black,
   warm, never navy, and body text that does not glare (about 13:1, never above 14:1). Light-mode chart marks are not
   held to 3:1: the Mayor's share is a pale grey on white by design. */
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

type Rgba = [number, number, number, number];

const block = (re: RegExp) => {
  const body = css.match(re)?.[1];
  if (body === undefined) throw new Error(`no block ${re}`);
  return body;
};
const tokens = (body: string): Record<string, string> =>
  Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)].map(([, k = "", v = ""]) => [k, v.trim().toLowerCase()]));
const light = tokens(block(/^:root \{([^}]*)\}/m));
const darkMedia = tokens(block(/:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/));
const darkForced = tokens(block(/:root\[data-theme="dark"\] \{([^}]*)\}/));
const dark = darkMedia;

const parse = (value: string): Rgba => {
  const hex = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) return [parseInt(hex[1] ?? "", 16), parseInt(hex[2] ?? "", 16), parseInt(hex[3] ?? "", 16), 1];
  const rgba = value.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])];
  throw new Error(`not a colour: ${value}`);
};
const over = ([r, g, b, a]: Rgba, [R, G, B]: Rgba): Rgba => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
const luminance = ([r, g, b]: Rgba) => {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: Rgba, b: Rgba) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const SURFACES = ["bg", "sunk", "raised"];

/** A theme's colours by token name, and a rule's background in that theme. */
const palette = (theme: Record<string, string>, name: string) => {
  const color = (token: string): Rgba => {
    const value = theme[token];
    if (value === undefined) throw new Error(`no ${name} token --${token}`);
    return parse(value);
  };
  /** A rule's background as a colour, or null when it is not a flat colour (gradients, none, inherit). */
  const background = (value: string): Rgba | null => {
    const token = value.match(/^var\(--([a-z0-9-]+)\)$/)?.[1];
    if (token !== undefined) return theme[token] ? color(token) : null;
    const mix = value.match(/^color-mix\(in srgb, var\(--([a-z0-9-]+)\) (\d+)%, (?:transparent|var\(--([a-z0-9-]+)\))\)$/);
    if (!mix) return null;
    const [r, g, b] = color(mix[1] ?? "");
    const tint: Rgba = [r, g, b, Number(mix[2]) / 100];
    return mix[3] ? over(tint, color(mix[3])) : tint;
  };
  return { color, background };
};
const { color } = palette(dark, "dark");

/** Every innermost rule body in the stylesheet, with its selector. */
const rules = [...css.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map(([, selector = "", body = ""]) => ({ selector: selector.trim(), body }));
const declared = (body: string, prop: string) =>
  body.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+?)\\s*(?:!important)?;`))?.[1];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s mode contrast", (name, theme) => {
  const { color, background } = palette(theme, name);

  it("every text colour the stylesheet uses passes AA on the page and both surfaces", () => {
    const used = new Set([...css.matchAll(/(?:^|[;{\s])color:\s*var\(--([a-z0-9-]+)\)/g)].map(([, t = ""]) => t));
    used.delete("bg"); // only ever on an ink background, checked rule by rule below
    expect(used.size).toBeGreaterThan(8);
    for (const fg of used) {
      for (const bg of SURFACES) {
        const r = ratio(color(fg), color(bg));
        expect(r, `${fg} on ${bg}: ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("every rule that sets text on a background passes AA on what it paints, tinted pills included", () => {
    let checked = 0;
    for (const { selector, body } of rules) {
      const fg = declared(body, "color")?.match(/^var\(--([a-z0-9-]+)\)$/)?.[1];
      const bgValue = declared(body, "background");
      if (fg === undefined || bgValue === undefined || !theme[fg]) continue;
      const bg = background(bgValue);
      if (!bg) continue;
      // A see-through tint lands on whichever surface is under it.
      const painted: [string, Rgba][] = bg[3] < 1 ? SURFACES.map((s) => [` over ${s}`, over(bg, color(s))]) : [["", bg]];
      for (const [under, paint] of painted) {
        const r = ratio(color(fg), paint);
        expect(r, `${selector}${under}: ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe("dark mode chart marks", () => {
  it("chart marks stand out from the page and its panels (3:1)", () => {
    for (const mark of ["fund", "spend", "gap", "gla", "good", "warn", "bad", "idle", "accent"]) {
      for (const bg of ["bg", "sunk"]) {
        const r = ratio(color(mark), color(bg));
        expect(r, `${mark} on ${bg}: ${r.toFixed(2)}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("dark mode is dark brown", () => {
  it("is lifted off black, warm rather than navy, and its body text does not glare", () => {
    expect(dark.bg).toBe("#241f1a");
    expect(luminance(color("bg"))).toBeGreaterThanOrEqual(0.012);
    const body = ratio(color("ink"), color("bg"));
    expect(body).toBeGreaterThanOrEqual(12);
    expect(body).toBeLessThanOrEqual(14);
  });

  it("has no blue cast in the chrome: blue appears only where it means funding", () => {
    for (const t of ["bg", "sunk", "raised", "line", "line-strong", "ink", "muted", "faint", "accent", "spend", "gla", "idle"]) {
      const [r, , b] = color(t);
      expect(r, `${t} leans blue`).toBeGreaterThan(b);
    }
  });

  it("the forced dark theme matches the system dark theme", () => {
    expect(darkForced).toEqual(darkMedia);
  });

  it("the browser bar uses the same dark brown", () => {
    const themeColor = layout.match(/prefers-color-scheme: dark\)", color: "(#[0-9a-f]{6})"/i)?.[1];
    expect(themeColor?.toLowerCase()).toBe(dark.bg);
  });
});
