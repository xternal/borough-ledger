// Tells search engines which pages changed in a production deploy (IndexNow: Bing, Yandex, Seznam, Naver; Bing also
// feeds ChatGPT search and Copilot). Run by .github/workflows/indexnow.yml after Vercel reports a successful
// production deploy, with the files the deploy changed:
//   node scripts/indexnow.mjs <changed-file> [...]
// The key is public by design: it is served at /<key>.txt to show the site is ours.
import { readdirSync, readFileSync } from "node:fs";

const KEY = "cd99e6aa5d02a98cce4df8abc80445fb";
const SITE = (process.env.SITE_URL ?? "https://boroughbook.uk").replace(/\/$/, "");

const promiseIds = () =>
  readdirSync("content/promises")
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.slice(0, -5));
// Ward ids from content/wards.yaml without a YAML parser: every `- id: "..."` line.
const wardIds = () => [...readFileSync("content/wards.yaml", "utf8").matchAll(/^\s+- id: "([^"]+)"/gm)].map((m) => m[1]);

/** The public pages a changed file feeds. */
export function pagesFor(file) {
  let m;
  if ((m = file.match(/^content\/promises\/([a-z0-9-]+)\.yaml$/))) return [`/promise/${m[1]}`, `/promise/${m[1]}.md`, "/promises", "/"];
  if ((m = file.match(/^content\/councillors\/([a-z0-9-]+)\.yaml$/))) return [`/councillor/${m[1]}`, "/wards"];
  if (file === "content/decision_links.yaml" || file === "data/build/decisions.json") return ["/decisions", "/promises"];
  if (file === "content/wards.yaml" || file.startsWith("data/build/ward_")) return ["/wards", ...wardIds().map((w) => `/ward/${w}`)];
  if (file.startsWith("data/build/payments/")) return ["/payments"];
  if (file.startsWith("data/build/hf_") || file.startsWith("data/config/")) return ["/", "/balance"];
  if (file.startsWith("apps/web/")) return ["/", "/promises", "/decisions", "/wards", "/payments", "/sources", ...promiseIds().map((id) => `/promise/${id}`)];
  return [];
}

const urls = [...new Set(process.argv.slice(2).flatMap(pagesFor))].slice(0, 10000).map((p) => `${SITE}${p}`);
if (!urls.length) {
  console.log("IndexNow: no public pages changed.");
  process.exit(0);
}
// INDEXNOW_DRY=1 lists the pages without sending them.
if (process.env.INDEXNOW_DRY) {
  console.log(urls.join("\n"));
  process.exit(0);
}
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow: ${res.status} for ${urls.length} pages`);
// 200 and 202 are accepted; 429 means too many recently, which is not worth failing a run over.
if (res.status >= 400 && res.status !== 429) process.exit(1);
