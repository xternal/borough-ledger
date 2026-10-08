/* Council decisions to pledges, in two steps (docs/PROMISE_STANDARD.md):

     tsx src/decision-links-cli.ts suggest <out.json>   ask Claude about each decision not yet assessed; write suggestions
     tsx src/decision-links-cli.ts apply <in.json> [summary.md]   append the events to the cards and the links to content/

   The daily workflow opens a pull request with the applied suggestions: merging it is the editor's confirmation, closing
   it rejects them. Assessed decisions are recorded in data/build/decision_assessments.json so none is asked about twice.
   Needs ANTHROPIC_API_KEY; without it, suggest records nothing and says so. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isSeq, parseDocument } from "yaml";
import { compileContent } from "./content-compile";
import { SYSTEM_PROMPT, eventFor, linkFor, linkTool, openPledges, statusAfter, userPrompt, validSuggestions, type Suggestion } from "./decision-links";
import type { PromiseCard } from "./content";
import { DecisionsFile } from "./decisions";

const root = join(import.meta.dirname, "..", "..", "..");
const ASSESSED = join(root, "data", "build", "decision_assessments.json");
const LINKS = join(root, "content", "decision_links.yaml");
const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

type Assessed = Record<string, { on: string; by: string; links: number }>;
const readAssessed = (): Assessed => (existsSync(ASSESSED) ? JSON.parse(readFileSync(ASSESSED, "utf8")).assessed : {});
const writeAssessed = (a: Assessed) =>
  writeFileSync(
    ASSESSED,
    `${JSON.stringify({ note: "Decisions already put to the suggester (decision-links-cli.ts), so none is asked about twice.", assessed: Object.fromEntries(Object.entries(a).sort()) }, null, 1)}\n`,
  );
const decisions = () => DecisionsFile.parse(JSON.parse(readFileSync(join(root, "data", "build", "decisions.json"), "utf8"))).decisions;

async function ask(system: string, user: string, tool: ReturnType<typeof linkTool>): Promise<unknown> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, system, tools: [tool], tool_choice: { type: "tool", name: tool.name }, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { content: { type: string; input?: unknown }[] };
  return body.content.find((c) => c.type === "tool_use")?.input ?? { links: [] };
}

async function suggest(out: string) {
  const assessed = readAssessed();
  const todo = decisions().filter((d) => !assessed[d.id]);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`No ANTHROPIC_API_KEY: ${todo.length} decisions wait to be assessed.`);
    writeFileSync(out, "[]\n");
    return;
  }
  const pledges = openPledges(compileContent(join(root, "content")));
  const all: Suggestion[] = [];
  for (const d of todo) {
    const { kept, dropped } = validSuggestions(d, pledges, await ask(SYSTEM_PROMPT, userPrompt(d, pledges), linkTool(pledges)));
    for (const x of dropped) console.log(`dropped ${x}`);
    all.push(...kept);
    assessed[d.id] = { on: today, by: MODEL, links: kept.length };
  }
  writeAssessed(assessed);
  writeFileSync(out, `${JSON.stringify(all, null, 1)}\n`);
  console.log(`${todo.length} decisions assessed, ${all.length} links suggested.`);
}

function apply(input: string, summaryPath?: string) {
  const suggestions = JSON.parse(readFileSync(input, "utf8")) as (Suggestion & { suggested_by?: string })[];
  const byId = new Map(decisions().map((d) => [d.id, d]));
  const content = compileContent(join(root, "content"));
  const open = new Set(openPledges(content).map((p) => p.id));
  const linksDoc = parseDocument(
    existsSync(LINKS) ? readFileSync(LINKS, "utf8") : "# Council decisions linked to pledges. Added by pull request; merging it is the editor's confirmation.\nlinks: []\n",
  );
  // One field a line, like every other content file, so a link reads (and is reviewed) easily.
  const seq = linksDoc.get("links", true);
  if (isSeq(seq)) seq.flow = false;
  const existing = new Set(content.decision_links.map((l) => `${l.decision_id}:${l.promise_id}`));
  const lines: string[] = [];
  for (const s of suggestions) {
    const d = byId.get(s.decision_id);
    if (!d || !open.has(s.promise_id) || existing.has(`${s.decision_id}:${s.promise_id}`)) continue;
    const path = join(root, "content", "promises", `${s.promise_id}.yaml`);
    const card = parseDocument(readFileSync(path, "utf8"));
    // Append-only: a new event at the end; the status moves up the ladder, never down.
    card.addIn(["events"], card.createNode(eventFor(d, s)));
    const before = card.get("status") as PromiseCard["status"];
    const after = statusAfter(before, s.event);
    card.set("status", after);
    writeFileSync(path, card.toString());
    linksDoc.addIn(["links"], linksDoc.createNode(linkFor(s, s.suggested_by ?? MODEL, today)));
    existing.add(`${s.decision_id}:${s.promise_id}`);
    lines.push(
      `### ${s.promise_id}: ${before}${after !== before ? ` → **${after}**` : " (status unchanged)"}\n\n` +
        `${d.body}, ${d.date}, item ${d.item}: [${d.title}](${d.url})\n\n> ${s.quote}\n\nWhy: ${s.reason}\n`,
    );
  }
  writeFileSync(LINKS, linksDoc.toString());
  if (summaryPath) writeFileSync(summaryPath, lines.join("\n"));
  console.log(`${lines.length} links applied.`);
}

/** One tiny request: is the key accepted and does the model exist? Costs a fraction of a penny. */
async function probe() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("No ANTHROPIC_API_KEY.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 5, messages: [{ role: "user", content: "Reply with OK." }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status} for ${MODEL}: ${(await res.text()).slice(0, 300)}`);
  console.log(`Claude API key accepted; ${MODEL} answered.`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "probe") await probe();
else if (cmd === "suggest" && a) await suggest(a);
else if (cmd === "apply" && a) apply(a, b);
else {
  console.error("usage: decision-links-cli.ts probe | suggest <out.json> | apply <in.json> [summary.md]");
  process.exit(2);
}
