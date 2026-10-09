/* Boroughs beyond Hammersmith & Fulham: the statement the government returns give (etl/boroughs.py) and their wards,
   councillors and election results (etl/borough_people.py). The same checks and rules as Hammersmith & Fulham's. */
import { z } from "zod";
import { CouncilYear } from "./seed";
import { Candidate } from "./elections";

export const BoroughConfig = z.object({
  note: z.string(),
  boroughs: z.array(z.object({ slug: z.string(), council: z.string(), short: z.string(), ons: z.string(), moderngov: z.url(), election_id: z.string() })),
});
export type BoroughConfig = z.infer<typeof BoroughConfig>;

export const BoroughStatement = CouncilYear.pick({ meta: true, bill: true, tax_base: true, history: true, funding: true, services: true });
export type BoroughStatement = z.infer<typeof BoroughStatement>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const BoroughPeople = z.object({
  note: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.url(), retrieved_on: isoDate, sha256: z.string(), licence: z.string().optional() })),
  election: z.object({ id: z.string(), date: isoDate }),
  parties: z.array(z.object({ id: z.string(), short: z.string(), seats: z.number().int().positive() })),
  /** The party with more than half the seats, or null: worked out from seats, never from a name (invariant 7). */
  control: z.string().nullable(),
  wards: z.array(
    z.object({
      id: z.string(),
      ons_code: z.string(),
      name: z.string(),
      councillor_ids: z.array(z.string()),
      election: z.object({
        seats: z.number().int().positive(),
        ballots: z.number().int().positive(),
        turnout_pct: z.number().positive().max(100),
        rejected: z.number().int().nonnegative(),
        result_url: z.url(),
        dc_url: z.url(),
        candidates: z.array(Candidate),
      }),
    }),
  ),
  councillors: z.array(
    z.object({ id: z.string(), name: z.string(), party: z.string(), party_name: z.string(), ward_id: z.string(), roles: z.array(z.string()), democracy_url: z.url() }),
  ),
});
export type BoroughPeople = z.infer<typeof BoroughPeople>;

/** Every ward has its councillors and a result whose winners are its councillors; control matches the seats. */
export function checkBoroughPeople(p: BoroughPeople): string[] {
  const problems: string[] = [];
  const byId = new Map(p.councillors.map((c) => [c.id, c]));
  for (const w of p.wards) {
    const won = w.election.candidates.filter((c) => c.elected);
    if (won.length !== w.election.seats || w.councillor_ids.length !== w.election.seats) problems.push(`${w.id}: seats, winners and councillors differ`);
    for (const c of won) if (byId.get(c.councillor_id ?? "")?.ward_id !== w.id) problems.push(`${w.id}: a winner is not one of the ward's councillors`);
    for (const c of w.election.candidates) if (!c.elected && c.councillor_id) problems.push(`${w.id}: a losing candidate is named`);
  }
  const total = p.parties.reduce((a, x) => a + x.seats, 0);
  if (total !== p.councillors.length) problems.push("party seats do not add up to the councillors");
  const majority = p.parties.find((x) => x.seats * 2 > total)?.id ?? null;
  if (majority !== p.control) problems.push("control does not follow the seats");
  return problems;
}
