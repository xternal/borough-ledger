/*
 * Print a party's 2026 manifesto page by page, from its archived copy, after checking the SHA-256 in content/parties.yaml.
 * For whoever drafts the next manifesto pledges in page order (docs/PLEDGE_FINDER.md).
 *
 *   pnpm --filter @borough-ledger/schema promises:manifesto <party id> [first page] [last page]
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { Party } from "./content";
import { waybackRaw } from "./promise-quotes";
import { readSource } from "./source-text";

const root = join(import.meta.dirname, "..", "..", "..");
const [id, from, to] = process.argv.slice(2);
const parties = Party.array().parse((parse(readFileSync(join(root, "content", "parties.yaml"), "utf8")) as { parties: unknown }).parties);
const party = parties.find((p) => p.id === id);
if (!party) {
  console.error(`Usage: promises:manifesto <${parties.map((p) => p.id).join(" | ")}> [first page] [last page]`);
  process.exit(2);
}
const { manifesto } = party;
const got = await readSource(manifesto.archive_url ? waybackRaw(manifesto.archive_url) : manifesto.url);
if (!("pages" in got)) {
  console.error(`Could not read ${party.name}'s manifesto: ${"error" in got ? got.error : got.picture}`);
  process.exit(1);
}
const sha = createHash("sha256").update(got.bytes).digest("hex");
if (sha !== manifesto.sha256) {
  console.error(`${party.name}'s manifesto is not the file the cards quote: SHA-256 ${sha}, expected ${manifesto.sha256}.`);
  process.exit(1);
}
const first = Math.max(1, Number(from ?? 1));
const last = Math.min(got.pages.length, Number(to ?? got.pages.length));
console.log(`${manifesto.title}\n${manifesto.url}\n${got.pages.length} pages, SHA-256 matches. Pages ${first} to ${last}:`);
for (let n = first; n <= last; n++) console.log(`\n--- page ${n} ---\n${got.pages[n - 1]!.trim()}`);
