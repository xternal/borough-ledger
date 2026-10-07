/* Compile content/*.yaml into data/build/content.json.  --check: fail if the committed file is out of date. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileContent } from "./content-compile";

const root = join(import.meta.dirname, "..", "..", "..");
const out = join(root, "data", "build", "content.json");
const json = JSON.stringify(compileContent(join(root, "content")), null, 1) + "\n";
if (process.argv.includes("--check")) {
  if (!existsSync(out) || readFileSync(out, "utf8") !== json) {
    console.error("data/build/content.json is out of date. Run: pnpm --filter @borough-ledger/schema content:build");
    process.exit(1);
  }
  console.log("content: every file parses, every cross-check passes, content.json is up to date.");
} else {
  writeFileSync(out, json);
  const c = JSON.parse(json);
  console.log(`content.json: ${c.promises.length} promises, ${c.councillors.length} councillors, ${c.wards.wards.length} wards; control: ${c.control}`);
}
