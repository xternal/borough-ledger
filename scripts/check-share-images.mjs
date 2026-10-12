#!/usr/bin/env node
/**
 * docs/BUILD_PLAN.md M3: every promise card has its own share image, and so does every council's page in the council tax
 * decoder. Run after `pnpm build:preview`. Checks each prerendered image is a 1200x630 PNG.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const BUILT = join(ROOT, "apps/web/.next/server/app/promise");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const { promises } = JSON.parse(readFileSync(join(ROOT, "data/build/content.json"), "utf8"));
const { councils } = JSON.parse(readFileSync(join(ROOT, "data/build/council_tax_decoder.json"), "utf8"));
const DECODER = join(ROOT, "apps/web/.next/server/app/council-tax");
const pages = [
  ...promises.map(({ id }) => ({ id, f: join(BUILT, id, "opengraph-image.body") })),
  ...councils.map(({ slug }) => ({ id: `council-tax/${slug}`, f: join(DECODER, slug, "opengraph-image.body") })),
  { id: "council-tax", f: join(DECODER, "opengraph-image.body") },
];
const problems = [];
for (const { id, f } of pages) {
  if (!existsSync(f)) {
    problems.push(`${id}: no share image built`);
    continue;
  }
  const b = readFileSync(f);
  if (!b.subarray(0, 8).equals(PNG)) problems.push(`${id}: share image is not a PNG`);
  else if (b.readUInt32BE(16) !== 1200 || b.readUInt32BE(20) !== 630) problems.push(`${id}: share image is ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}, not 1200x630`);
}

if (problems.length) {
  console.error(`Share images missing or wrong:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-share-images: ${promises.length} cards and ${councils.length + 1} decoder pages, each with a 1200x630 share image.`);
