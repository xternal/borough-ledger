/* Boroughs beyond Hammersmith & Fulham: the statement the government returns give (etl/boroughs.py) and their wards,
   councillors and election results (etl/borough_people.py). The same checks and rules as Hammersmith & Fulham's. */
import { z } from "zod";
import { CouncilYear } from "./seed";
import { Candidate } from "./elections";

export const BoroughConfig = z.object({
  note: z.string(),
  boroughs: z.array(
    z.object({
      slug: z.string(),
      council: z.string(),
      short: z.string(),
      ons: z.string(),
      /** The council's ModernGov web service; absent where there is none and the councillors are May's winners. */
      moderngov: z.url().optional(),
      election_id: z.string(),
      /** "thirds" where a third of the seats are elected each year (Manchester). */
      elections: z.enum(["all", "thirds"]).optional(),
      seats_per_ward: z.number().int().positive().optional(),
      /** "later" where no source a script may read lists the councillors yet (Leeds turns automated requests away):
       *  the page says why and links the council's own list, and the postcode finder opens the council's page. */
      /** "coins": the council's own Northgate CoInS pages (Glasgow), which list each councillor's ward and party. */
      councillors_from: z.enum(["moderngov", "ballots", "later", "coins", "site"]).optional(),
      coins: z.url().optional(),
      /** "site": the council's own councillors page (Highland), read by etl/borough_people.py's members_site. */
      site: z.url().optional(),
      /** False where the last election's counts are not published in full (North Yorkshire, 2022): the council's own list only. */
      results: z.boolean().optional(),
      /** "county" for a council covering a county or region rather than a city (Highland, North Yorkshire): listed apart. */
      kind: z.literal("county").optional(),
      /** Scotland's councils have their own rules (data/config/rules_scotland.json) and returns (etl/scotland.py). */
      nation: z.enum(["england", "scotland", "wales"]).optional(),
      /** The council's name in the Scottish Government's returns: the POBE workbook's sheet, the council tax tables' row. */
      scot_name: z.string().optional(),
      /** Elected by single transferable vote (Scotland), with the next election's date. */
      voting: z.literal("stv").optional(),
      next_election: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      councillors_later: z.object({ why: z.string(), url: z.url() }).optional(),
      /** Outside London: who the rest of the bill goes to, and the bodies it splits into (government Tables 8d to 8f). */
      others: z.object({ name: z.string(), to: z.string(), short: z.string(), with: z.string(), source: z.string().optional() }).optional(),
      precepts: z.array(z.object({ id: z.string(), label: z.string(), phrase: z.string(), official_term: z.string(), table: z.string(), authority: z.string(), minus: z.array(z.string()).optional() })).optional(),
      parish_names: z.string().optional(),
      /** Wales: the community councils that set a precept, as the council lists them (Cardiff: six of its 36 communities). */
      community_councils: z.array(z.string()).optional(),
      /** ModernGov ward titles that differ from the ballots' (Cardiff: "Radyr and Morganstown" is the ballots' "Radyr"). */
      ward_aliases: z.record(z.string(), z.string()).optional(),
      /** The owner's decision to publish although the budget return and council tax return differ on council tax. */
      returns_differ: z.boolean().optional(),
      /** A postcode in the borough (its town hall) for the finder's example. */
      example_postcode: z.string().optional(),
      /** Where the borough elects its mayor, who runs the council. */
      mayor_election_id: z.string().optional(),
    }),
  ),
});
export type BoroughConfig = z.infer<typeof BoroughConfig>;

// Scotland's returns give no tax base in the same form, and a borough's page does not use it.
export const BoroughStatement = CouncilYear.pick({ meta: true, bill: true, tax_base: true, history: true, funding: true, services: true }).extend({
  tax_base: CouncilYear.shape.tax_base.optional(),
  /** Where the owner published a borough whose two returns differ on council tax (Islington, Bexley, Waltham Forest). */
  returns_differ: z
    .object({ budget_return_m: z.number(), council_tax_return_m: z.number(), quality: z.enum(["sourced", "approx", "modelled", "test"]), source_id: z.string(), method_note: z.string() })
    .optional(),
});
export type BoroughStatement = z.infer<typeof BoroughStatement>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const BoroughPeople = z.object({
  note: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.url(), retrieved_on: isoDate, sha256: z.string(), licence: z.string().optional() })),
  election: z.object({ id: z.string(), date: isoDate }),
  parties: z.array(z.object({ id: z.string(), short: z.string(), seats: z.number().int().positive() })),
  /** "ballots" where the council publishes no list a script can read: the councillors are May's winners (Birmingham). */
  councillors_from: z.literal("ballots").optional(),
  /** The party with more than half the seats, or null: worked out from seats, never from a name (invariant 7). */
  control: z.string().nullable(),
  /** An elected mayor, who runs the council in the boroughs that have one. A public office holder, named. */
  mayor: z
    .object({
      name: z.string(),
      party: z.string(),
      party_id: z.string(),
      votes: z.number().int().positive().nullable(),
      turnout_pct: z.number().positive().max(100).nullable(),
      result_url: z.url(),
      dc_url: z.url(),
    })
    .optional(),
  wards: z.array(
    z.object({
      id: z.string(),
      ons_code: z.string(),
      name: z.string(),
      councillor_ids: z.array(z.string()),
      /** Absent where the last election's counts are not published in a form we can read (Glasgow, 2022). */
      election: z
        .object({
        seats: z.number().int().positive(),
        /** Null where the declaration gave no turnout. */
        ballots: z.number().int().positive().nullable(),
        turnout_pct: z.number().positive().max(100).nullable(),
        rejected: z.number().int().nonnegative().nullable(),
        result_url: z.url(),
        dc_url: z.url(),
        candidates: z.array(Candidate),
        /** Where only some seats were up in May (elections by thirds): how many councillors the ward has. */
        seats_total: z.number().int().positive().optional(),
      })
        .optional(),
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
    if (!w.election) {
      if (!w.councillor_ids.length) problems.push(`${w.id}: no councillors and no result`);
      for (const id of w.councillor_ids) if (byId.get(id)?.ward_id !== w.id) problems.push(`${w.id}: a councillor is listed in another ward`);
      continue;
    }
    const won = w.election.candidates.filter((c) => c.elected);
    if (won.length !== w.election.seats || w.councillor_ids.length > (w.election.seats_total ?? w.election.seats)) problems.push(`${w.id}: seats, winners and councillors differ`);
    for (const c of won) if (!c.left && byId.get(c.councillor_id ?? "")?.ward_id !== w.id) problems.push(`${w.id}: a winner is not one of the ward's councillors`);
    for (const c of w.election.candidates) if (!c.elected && (c.councillor_id || c.left)) problems.push(`${w.id}: a losing candidate is named`);
    // A winner no longer listed must be accounted for by a vacant seat or a councillor who joined since.
    const left = won.filter((c) => c.left).length;
    const joined = w.election.seats_total ? 0 : w.councillor_ids.filter((id) => !won.some((c) => c.councillor_id === id)).length;
    if (left > (w.election.seats_total ?? w.election.seats) - w.councillor_ids.length + joined) problems.push(`${w.id}: more winners no longer listed than seats that changed hands`);
  }
  const total = p.parties.reduce((a, x) => a + x.seats, 0);
  if (total !== p.councillors.length) problems.push("party seats do not add up to the councillors");
  const majority = p.parties.find((x) => x.seats * 2 > total)?.id ?? null;
  if (majority !== p.control) problems.push("control does not follow the seats");
  return problems;
}
