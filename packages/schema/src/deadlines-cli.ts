/* Nightly: append an automatic deadline_missed event to each card whose deadline has passed. Append-only. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, parseDocument } from "yaml";
import { PromiseCard } from "./content";
import { deadlinesMissed } from "./deadlines";

const root = join(import.meta.dirname, "..", "..", "..");
const dir = join(root, "content", "promises");
const today = process.argv[2] ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const files = readdirSync(dir).filter((f) => f.endsWith(".yaml"));
const cards = files.map((f) => PromiseCard.parse(parse(readFileSync(join(dir, f), "utf8"))));
const due = deadlinesMissed(cards, today);
for (const p of due) {
  const path = join(dir, `${p.id}.yaml`);
  const doc = parseDocument(readFileSync(path, "utf8"));
  doc.addIn(["events"], doc.createNode({ date: today, type: "deadline_missed", text: `Deadline of ${p.deadline} passed with no delivery recorded`, auto: true }));
  writeFileSync(path, doc.toString());
}
console.log(due.length ? `deadline_missed added to: ${due.map((p) => p.id).join(", ")}` : `No deadlines passed as of ${today}.`);
