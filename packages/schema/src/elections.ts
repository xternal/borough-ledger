/* Ward results of the borough election, as built by etl/elections.py into data/build/elections.json from Democracy Club.
   Only elected candidates, who are councillors, are named, through their councillor record (CLAUDE.md invariant 6);
   every other candidate is their party's candidate and their votes. */
import { z } from "zod";
import type { Content } from "./content";
import { Quality } from "./quality";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const Candidate = z
  .object({
    /** The party as registered with the Electoral Commission, or "Independent". */
    party: z.string(),
    /** Set for the parties with pages on the site. */
    party_id: z.string().optional(),
    votes: z.number().int().nonnegative(),
    elected: z.boolean(),
    /** Set for every elected candidate still on the council, and only for them. */
    councillor_id: z.string().optional(),
    /** Elected, but not on the council's current list (the seat is vacant or changed hands): not named. */
    left: z.literal(true).optional(),
  })
  .strict();
export type Candidate = z.infer<typeof Candidate>;

export const WardResult = z.object({
  name: z.string(),
  seats: z.number().int().positive(),
  /** Ballot papers counted towards turnout, as declared. */
  ballots: z.number().int().positive(),
  turnout_pct: z.number().positive().max(100),
  rejected: z.number().int().nonnegative(),
  /** The council's own declaration. */
  result_url: z.url(),
  dc_url: z.url(),
  candidates: z.array(Candidate).min(1),
});
export type WardResult = z.infer<typeof WardResult>;

export const ElectionsFile = z.object({
  note: z.string(),
  election: z.object({ id: z.string(), date: isoDate, name: z.string() }),
  source: z.object({ title: z.string(), url: z.url(), licence: z.string(), licence_url: z.url(), retrieved_on: isoDate }),
  quality: Quality,
  spot_checks: z.array(z.object({ ward_id: z.string(), on: isoDate, result: z.string() })),
  wards: z.record(z.string(), WardResult),
});
export type ElectionsFile = z.infer<typeof ElectionsFile>;

/** Every ward has a result, winners are the top vote-getters, and each one is a councillor of that ward. */
export function checkElections(e: ElectionsFile, content: Content): string[] {
  const problems: string[] = [];
  const wardIds = new Set(content.wards.wards.map((w) => w.id));
  const councillors = new Map(content.councillors.map((c) => [c.id, c]));
  const parties = new Set(content.parties.map((p) => p.id));
  for (const id of wardIds) if (!e.wards[id]) problems.push(`elections: no result for ward ${id}`);
  for (const [id, w] of Object.entries(e.wards)) {
    if (!wardIds.has(id)) problems.push(`elections: unknown ward ${id}`);
    const elected = w.candidates.filter((c) => c.elected);
    if (elected.length !== w.seats) problems.push(`elections ${id}: ${elected.length} elected for ${w.seats} seats`);
    const lowest = Math.min(...elected.map((c) => c.votes));
    if (w.candidates.some((c) => !c.elected && c.votes > lowest)) problems.push(`elections ${id}: a candidate with fewer votes was elected`);
    for (const c of w.candidates) {
      if (c.elected !== !!c.councillor_id) problems.push(`elections ${id}: only elected candidates link to a councillor, and every one does`);
      if (c.councillor_id && councillors.get(c.councillor_id)?.ward_id !== id) problems.push(`elections ${id}: ${c.councillor_id} is not a councillor of this ward`);
      if (c.party_id && !parties.has(c.party_id)) problems.push(`elections ${id}: unknown party ${c.party_id}`);
    }
  }
  return problems;
}
