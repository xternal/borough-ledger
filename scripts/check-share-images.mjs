#!/usr/bin/env node
/**
 * docs/BUILD_PLAN.md M3: every promise card has its own share image. Run after `pnpm build:preview`.
 * Checks the prerendered image for each card in data/build/content.json is a 1200x630 PNG.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const BUILT = join(ROOT, "apps/web/.next/server/app/promise");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const { promises } = JSON.parse(readFileSync(join(ROOT, "data/build/content.json"), "utf8"));
const problems = [];
for (const { id } of promises) {
  const f = join(BUILT, id, "opengraph-image.body");
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
console.log(`check-share-images: ${promises.length} cards, each with a 1200x630 share image.`);
