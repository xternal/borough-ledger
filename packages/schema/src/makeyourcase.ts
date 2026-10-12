/* Make your case (etl/make_your_case.py): who decides each thing a resident might want changed, and the council's own
   ways to take part, each with its source. */
import { z } from "zod";
import { Quality } from "./quality";
import { Source } from "./seed";

export const CaseTopic = z.enum(["adult_care", "council_tax", "budget", "streets_waste", "libraries_leisure", "housing"]);
export type CaseTopic = z.infer<typeof CaseTopic>;

const WhoDecides = z.object({
  who: z.enum(["law", "government", "council"]),
  text: z.string().min(1),
  source_ids: z.array(z.string()).min(1),
  where: z.string(),
  quality: Quality,
});

export const MakeYourCaseFile = z.object({
  note: z.string(),
  sources: z.array(Source),
  topics: z.record(CaseTopic, z.array(WhoDecides).min(3)),
  /** For each everyday service, every London borough's share of the money it pays for itself that goes on it (2026/27). */
  compare: z.record(
    z.string(),
    z.object({
      service: z.string(),
      label: z.string(),
      year: z.string(),
      source_id: z.string(),
      quality: Quality,
      councils: z.array(z.object({ name: z.string(), council_code: z.string(), m: z.number(), share: z.number() })).min(2),
    }),
  ),
  take_part: z.object({
    council: z.string(),
    questions: z.array(
      z.object({
        meeting: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}T12:00$/),
        label: z.string(),
        url: z.url(),
        quality: Quality,
        source_id: z.string(),
      }),
    ),
    petitions: z.array(z.object({ threshold: z.number().int().positive(), leads_to: z.string(), url: z.url(), quality: Quality, source_id: z.string() })).min(1),
    deputation: z.object({ people: z.number().int().positive(), what: z.string(), url: z.url(), quality: Quality, source_id: z.string() }),
  }),
});
export type MakeYourCaseFile = z.infer<typeof MakeYourCaseFile>;
