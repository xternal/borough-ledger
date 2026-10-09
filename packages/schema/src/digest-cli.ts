/* Weekly digest draft (run by .github/workflows/weekly-digest.yml on Sunday evenings, for posting on Monday):

     tsx src/digest-cli.ts <out.md> [YYYY-MM-DD]

   Gathers the week's facts (digest.ts), fetches the council's meetings in the next fortnight from its ModernGov web
   service, and asks Claude for a short Substack draft in the owner's voice using only those facts. If any number in
   the draft is not one of the facts' numbers, or there is no API key, the plain template is used instead. The output
   ends with the facts themselves, so the owner can check the draft in a minute before posting. */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileContent } from "./content-compile";
import { DecisionsFile } from "./decisions";
import { addDays, digestFacts, draftNumbersOk, templateDraft, type Fact, type UpcomingMeeting } from "./digest";
import { PaymentsIndex } from "./payments";
import { WardSpend } from "./wardspend";

const root = join(import.meta.dirname, "..", "..", "..");
const SITE = process.env.SITE_URL ?? "https://boroughbook.uk";
const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
const UA = "BoroughLedger-ETL/0.1 (independent research; https://github.com/xternal/borough-ledger)";
const MG = "https://democracy.lbhf.gov.uk";
// TODO(config): the council's committees move to its config with M8 (second borough). Same as etl/decisions.py.
const COMMITTEES: Record<number, string> = { 116: "Cabinet", 114: "Full Council" };
const PROCEDURAL = /^(apologies|declarations? of interests?|minutes|mayor'?s announcements|public questions|election of the mayor|items for discussion|special motions$|information reports|key decisions list|discussion of exempt)/i;

const json = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));
const ukDate = (s: string) => s.trim().split("/").reverse().join("-");
const toUk = (iso: string) => iso.split("-").reverse().join("/");
const unescape = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const tag = (xml: string, t: string) => [...xml.matchAll(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, "g"))].map((m) => m[1]!);

async function get(op: string, params: Record<string, string | number>): Promise<string> {
  const res = await fetch(`${MG}/mgWebService.asmx/${op}?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])))}`, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`ModernGov ${op}: ${res.status}`);
  return res.text();
}

/** The council's Cabinet and Full Council meetings in the next fortnight, with their agenda items once published. */
async function upcoming(today: string): Promise<UpcomingMeeting[]> {
  const out: UpcomingMeeting[] = [];
  for (const [cid, body] of Object.entries(COMMITTEES)) {
    const list = await get("GetMeetings", { lCommitteeId: cid, sFromDate: toUk(addDays(today, 1)), sToDate: toUk(addDays(today, 14)) });
    for (const m of tag(list, "meeting")) {
      const mid = tag(m, "meetingid")[0]!.trim();
      const meeting = await get("GetMeeting", { lMeetingId: mid });
      const items = tag(meeting, "agendaitemtitle").map(unescape).filter((t) => !PROCEDURAL.test(t));
      out.push({ body, date: ukDate(tag(m, "meetingdate")[0]!), time: tag(m, "meetingtime")[0]!.trim(), url: `${MG}/ieListDocuments.aspx?CId=${cid}&MId=${mid}`, items });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const VOICE = `You write the weekly Substack post for Borough Book (boroughbook.uk), an independent website about Hammersmith & Fulham Council's money and promises, in the voice of its maker, Pavel: friendly, energetic, plain English for people who never read council papers, British spelling, short paragraphs, a little urgency about why it matters, at most three emojis.

Rules, all of them strict:
- Use only the facts you are given. Never add a fact, a figure, a date, a prediction or an opinion about any party.
- Copy every number exactly as it appears in the facts. Write no other numbers at all, not even counts.
- Link every item you mention with its URL, as a Markdown link.
- Treat every party the same way and only report what the facts say.
- You may explain a council term in plain words (for example, what a medium-term financial plan is), without numbers.
- Never use the middle dot character.
- Shape: a short catchy title as a Markdown "#" heading, a one-line hook, then the sections that have facts ("This week", "Coming up", "Deadlines", "Number of the week"), and a closing nudge to look up your ward at ${SITE}/wards and to reply to boroughs@guzh.uk. Skip sections with no facts. 200 to 400 words.`;

/** The day the post goes out: the Monday after a Sunday run, otherwise the day itself. */
const publishDay = (today: string) => (new Date(`${today}T12:00:00Z`).getUTCDay() === 0 ? addDays(today, 1) : today);

async function write(facts: Fact[], today: string): Promise<{ draft: string; note: string }> {
  const plain = templateDraft(facts, publishDay(today), SITE);
  if (!process.env.ANTHROPIC_API_KEY) return { draft: plain, note: "No ANTHROPIC_API_KEY: the plain version." };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: VOICE,
      messages: [{ role: "user", content: `The week ending ${today}; the post goes out on ${publishDay(today)}, so "coming up" starts that day. The facts:\n${JSON.stringify(facts, null, 1)}` }],
    }),
  });
  if (!res.ok) return { draft: plain, note: `Claude API ${res.status}: the plain version.` };
  const body = (await res.json()) as { content: { type: string; text?: string }[] };
  const draft = body.content.map((c) => c.text ?? "").join("").trim();
  const check = draftNumbersOk(draft, facts, ["500", "boroughs", today, publishDay(today), SITE]);
  if (!check.ok) return { draft: plain, note: `Claude's draft used numbers not in the facts (${check.stray.join(", ")}), so here is the plain version.` };
  if (draft.includes("\u00b7")) return { draft: draft.replace(/\u00b7/g, ","), note: "Middle dots replaced with commas." };
  return { draft, note: `Written by ${MODEL} from the facts below; every number checked against them.` };
}

const [out, when] = process.argv.slice(2);
if (!out) {
  console.error("usage: digest-cli.ts <out.md> [YYYY-MM-DD]");
  process.exit(2);
}
const today = when ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const pay = PaymentsIndex.parse(json("data/build/payments/index.json"));
let paymentsChanged = false;
try {
  paymentsChanged = execSync(`git log --since="${addDays(today, -7)}" --format=%H -- data/build/payments/index.json`, { cwd: root }).toString().trim() !== "";
} catch {
  paymentsChanged = false;
}
const last3 = pay.months.slice(-3);
const facts = digestFacts({
  today,
  site: SITE,
  content: compileContent(join(root, "content")),
  decisions: DecisionsFile.parse(json("data/build/decisions.json")),
  assessed: json("data/build/decision_assessments.json").assessed,
  upcoming: await upcoming(today),
  wardSpend: WardSpend.parse(json("data/build/ward_spend.json")),
  newPayments: paymentsChanged ? { from: last3[0]!.month, to: last3.at(-1)!.month, total: last3.reduce((a, m) => a + m.total, 0), rows: last3.reduce((a, m) => a + m.rows, 0) } : null,
});
const { draft, note } = await write(facts, today);
writeFileSync(
  out,
  `${draft}

---

**Before posting:** ${note} Copy the draft above into Substack and edit freely.

<details><summary>The facts it was written from (${facts.length})</summary>

${facts.map((f) => `- **${f.section}**: ${f.text} ${f.url}`).join("\n")}

</details>
`,
);
console.log(`Digest for the week ending ${today}: ${facts.length} facts. ${note}`);
