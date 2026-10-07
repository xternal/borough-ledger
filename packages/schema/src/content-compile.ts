/* Node only: reads content/*.yaml. The app reads the compiled data/build/content.json instead. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { checkContent, Councillor, Party, PromiseCard, WardsFile, type Content } from "./content";

function readYaml(path: string): unknown {
  return parse(readFileSync(path, "utf8"));
}

function parseFile<T>(schema: z.ZodType<T>, path: string): T {
  const r = schema.safeParse(readYaml(path));
  if (!r.success) throw new Error(`${path}:\n  ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ")}`);
  return r.data;
}

export function compileContent(root: string): Content {
  const dir = (d: string) =>
    readdirSync(join(root, d))
      .filter((f) => f.endsWith(".yaml"))
      .sort();
  const parties = parseFile(z.object({ parties: z.array(Party) }), join(root, "parties.yaml")).parties;
  const wards = parseFile(WardsFile, join(root, "wards.yaml"));
  const councillors = dir("councillors").map((f) => parseFile(Councillor, join(root, "councillors", f)));
  const promises = dir("promises").map((f) => {
    const p = parseFile(PromiseCard, join(root, "promises", f));
    if (`${p.id}.yaml` !== f) throw new Error(`content/promises/${f}: file name must be ${p.id}.yaml`);
    return p;
  });
  const seats = new Map<string, number>();
  for (const c of councillors) seats.set(c.party, (seats.get(c.party) ?? 0) + 1);
  const control = [...seats].find(([, n]) => n > councillors.length / 2)?.[0] ?? null;
  const content: Content = { parties, councillors, wards, promises, control };
  const problems = checkContent(content);
  if (problems.length) throw new Error(`content/ failed cross-checks:\n  ${problems.join("\n  ")}`);
  return content;
}
