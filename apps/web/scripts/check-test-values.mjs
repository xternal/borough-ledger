#!/usr/bin/env node
/**
 * Second line of defence after the render guard in <Num>: scans the prerendered output of
 * `next build` for any value marked as test data, in the HTML and in the RSC payload
 * (which carries the data client components receive). Fails unless --allow-test.
 *
 *   node scripts/check-test-values.mjs              production: exit 1 on any test value
 *   node scripts/check-test-values.mjs --allow-test preview: report only
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Matches plain and JSON-escaped forms: data-q="test", \"data-q\":\"test\", "quality":"test". */
export const PATTERNS = [/data-q=\\?"test\\?"/g, /\\?"data-q\\?":\\?"test\\?"/g, /\\?"quality\\?":\\?"test\\?"/g, /\\?"cost_quality\\?":\\?"test\\?"/g];
const SCANNED = /\.(html|rsc|body)$/;

export function countTestMarkers(text) {
  return PATTERNS.reduce((n, re) => n + (text.match(re)?.length ?? 0), 0);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

export function scanDir(dir) {
  const files = [];
  let scanned = 0;
  for (const file of walk(dir)) {
    if (!SCANNED.test(file)) continue;
    scanned++;
    const count = countTestMarkers(readFileSync(file, "utf8"));
    if (count) files.push({ file: relative(dir, file), count });
  }
  return { scanned, files, total: files.reduce((a, f) => a + f.count, 0) };
}

/** Where prerendered pages can land: .next locally; Vercel's build adapter may write to .vercel/output instead. */
function outputDirs(root) {
  return [join(root, ".next/server/app"), join(root, ".vercel/output"), join(root, "../../.vercel/output")].filter((d) => existsSync(d));
}

function diagnose(root) {
  const seen = [];
  for (const d of [join(root, ".next/server"), join(root, ".vercel/output"), join(root, "../../.vercel/output")]) {
    if (!existsSync(d)) continue;
    for (const f of walk(d)) {
      seen.push(relative(root, f));
      if (seen.length >= 40) return seen;
    }
  }
  return seen;
}

function main() {
  const allow = process.argv.includes("--allow-test");
  const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
  const dirs = outputDirs(root);
  const results = dirs.map((d) => ({ dir: relative(root, d) || ".", ...scanDir(d) }));
  const scanned = results.reduce((a, r) => a + r.scanned, 0);
  const files = results.flatMap((r) => r.files.map((f) => ({ ...f, file: join(r.dir, f.file) })));
  const total = files.reduce((a, f) => a + f.count, 0);
  if (scanned === 0) {
    const msg = `check-test-values: no prerendered pages found in ${dirs.map((d) => relative(root, d)).join(", ") || "any output directory"}.`;
    console.error(`${msg}\nFiles seen:\n  ${diagnose(root).join("\n  ")}`);
    // The render guard in <Num> is the first line of defence and has already run during prerendering.
    // A preview may proceed; a production build may not ship unchecked.
    if (allow) return;
    process.exit(2);
  }
  writeFileSync(join(root, ".test-data-report.json"), JSON.stringify({ allow, scanned, total, files }, null, 2));
  if (total === 0) {
    console.log(`check-test-values: ${scanned} files scanned, no test values rendered.`);
    return;
  }
  const list = files.map((f) => `  ${f.file}: ${f.count}`).join("\n");
  if (allow) {
    console.log(`check-test-values: preview build renders ${total} test markers (allowed, each visibly marked):\n${list}`);
    return;
  }
  console.error(`check-test-values: production build renders ${total} test markers:\n${list}\nProduction builds may not render test data.`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
