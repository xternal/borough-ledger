/*
 * Every version added to content/promises since a git ref (default origin/main) must quote its source word for word,
 * with an archived copy. Reads the Wayback Machine copy first, then the live page; a PDF is read page by page.
 *
 *   pnpm --filter @borough-ledger/schema promises:quotes [ref]
 *
 * Prints a table for the pull request and exits 1 if any quote is missing from its source.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { Party, PromiseCard } from "./content";
import { addedVersions, checkQuote, waybackRaw } from "./promise-quotes";
import { readSource } from "./source-text";

const root = join(import.meta.dirname, "..", "..", "..");
const ref = process.argv[2] ?? "origin/main";
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

let names: string[] = [];
try {
  names = git("ls-tree", "--name-only", `${ref}:content/promises`).split("\n").filter((f) => f.endsWith(".yaml"));
} catch {
  names = [];
}
const before = names.map((f) => PromiseCard.parse(parse(git("show", `${ref}:content/promises/${f}`))));
const dir = join(root, "content", "promises");
const after = readdirSync(dir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => PromiseCard.parse(parse(readFileSync(join(dir, f), "utf8"))));

// A manifesto pledge is archived once, with its manifesto (content/parties.yaml), not on every card.
const parties = Party.array().parse((parse(readFileSync(join(root, "content", "parties.yaml"), "utf8")) as { parties: unknown }).parties);
const manifestoArchive = new Map(parties.flatMap((p) => (p.manifesto.archive_url ? [[p.manifesto.url, p.manifesto.archive_url] as const] : [])));

const added = addedVersions(before, after);
if (!added.length) {
  console.log(`promises:quotes: no new versions since ${ref}; nothing to check.`);
  process.exit(0);
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ");
const rows: string[] = [];
let failed = 0;
let byEye = 0;
for (const v of added) {
  const { text, source_url, page } = v.version;
  const archive_url = v.version.archive_url ?? manifestoArchive.get(source_url);
  let verdict = archive_url ? "" : "**No**: no archived copy (archive_url)";
  if (archive_url) {
    for (const url of [waybackRaw(archive_url), source_url]) {
      const got = await readSource(url);
      const used = url === source_url ? "live page" : "archived copy";
      if ("picture" in got) {
        // A photo of a leaflet cannot be read by code; the editor reads it, and the table says so.
        verdict = `**By eye**: the ${used} is a picture, for the editor to read`;
        byEye++;
        break;
      }
      const r = "pages" in got ? checkQuote(text, got.pages, page) : ({ ok: false, why: got.error } as const);
      verdict = r.ok ? `Yes, ${r.where} of the ${used}` : `**No**: ${used}, ${cell(r.why)}`;
      if (r.ok) break;
    }
  }
  if (verdict.startsWith("**No**")) failed++;
  rows.push(`| ${v.id} v${v.n} | ${cell(text.length > 90 ? `${text.slice(0, 87)}...` : text)} | ${verdict} |`);
}

console.log(`Quotes added since ${ref}, checked word for word against their sources:\n`);
console.log("| Card | Quote | In the source? |\n|---|---|---|");
console.log(rows.join("\n"));
if (failed) {
  console.error(`\n${failed} of ${added.length} quotes are not in their sources word for word. Fix the quote or the page, or drop the card.`);
  process.exit(1);
}
console.log(
  byEye
    ? `\n${added.length - byEye} of ${added.length} quotes are in their sources word for word; ${byEye} ${byEye === 1 ? "is a picture" : "are pictures"} for the editor to read.`
    : `\nAll ${added.length} quotes are in their sources word for word.`,
);
