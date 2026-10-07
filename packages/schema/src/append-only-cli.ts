/* Compare content/promises with a git ref (default origin/main) and fail on any edit to published history. */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { appendOnlyProblems } from "./append-only";
import { PromiseCard } from "./content";

const root = join(import.meta.dirname, "..", "..", "..");
const ref = process.argv[2] ?? "origin/main";
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

let names: string[] = [];
try {
  names = git("ls-tree", "--name-only", `${ref}:content/promises`).split("\n").filter((f) => f.endsWith(".yaml"));
} catch {
  console.log(`append-only: ${ref} has no content/promises yet; nothing to compare.`);
  process.exit(0);
}
const before = names.map((f) => PromiseCard.parse(parse(git("show", `${ref}:content/promises/${f}`))));
const dir = join(root, "content", "promises");
const after = readdirSync(dir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => PromiseCard.parse(parse(readFileSync(join(dir, f), "utf8"))));
const problems = appendOnlyProblems(before, after);
if (problems.length) {
  console.error(`Promise history must be append-only (compared with ${ref}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`append-only: ${before.length} published cards checked against ${ref}; history only grew.`);
