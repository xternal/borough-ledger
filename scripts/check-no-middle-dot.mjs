#!/usr/bin/env node
/**
 * CLAUDE.md invariant 10: no middle-dot (·) separators anywhere in the UI.
 * Scans source, data and content, plus built pages when they exist (binary files skipped). Docs that state the rule are exempt.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SOURCES = ["apps/web/app", "apps/web/components", "apps/web/lib", "packages", "data", "content", "prototype/template.html"];
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".yaml", ".yml", ".css", ".html", ".md"]);
/** Built pages only: the rendered HTML and RSC payloads, not bundled third-party code. */
const BUILT = "apps/web/.next/server/app";
const BUILT_EXT = new Set([".html", ".rsc", ".body"]);
const SKIP = new Set(["node_modules", ".git"]);
const DOT = "·";

function* walk(p) {
  if (!existsSync(p)) return;
  if (statSync(p).isFile()) return yield p;
  for (const name of readdirSync(p)) if (!SKIP.has(name)) yield* walk(join(p, name));
}

const hits = [];
const targets = [...SOURCES.map((d) => [d, SOURCE_EXT]), [BUILT, BUILT_EXT]];
for (const [d, exts] of targets)
  for (const f of walk(join(ROOT, d))) {
    if (!exts.has(extname(f))) continue;
    const buf = readFileSync(f);
    // Prerendered share images are PNGs saved as .body; their bytes can spell "·" by chance. Their text is checked at source.
    if (buf.includes(0)) continue;
    buf
      .toString("utf8")
      .split("\n")
      .forEach((line, i) => {
        if (line.includes(DOT)) hits.push(`${relative(ROOT, f)}:${i + 1}`);
      });
  }

if (hits.length) {
  console.error(`Middle dot (·) found; use layout or commas instead:\n  ${hits.join("\n  ")}`);
  process.exit(1);
}
console.log("check-no-middle-dot: none found.");
