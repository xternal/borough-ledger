/* Suppliers matched to the companies register, as built by etl/companies_house.py into data/build/companies.json from
   Companies House's free bulk file. Register facts only: no addresses and no people (docs/PRIVACY.md). */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const RegisteredCompany = z
  .object({
    number: z.string().regex(/^[A-Z0-9]{8}$/),
    name: z.string(),
    status: z.string(),
    type: z.string(),
    incorporated: z.union([isoDate, z.literal("")]),
    /** The company's own description of its business (SIC), without the code. */
    business: z.array(z.string()),
    /** Local authority area of the registered office, from its postcode; the address itself is never kept. */
    office_area: z.string().nullable(),
    /** name: exactly the council's name for it; former_name: a name it had while the council paid it; checked: by a person. */
    matched_on: z.enum(["name", "former_name", "checked"]),
    former_name: z.string().optional(),
    formed_during_payments: z.literal(true).optional(),
  })
  .strict();
export type RegisteredCompany = z.infer<typeof RegisteredCompany>;

export const CompaniesFile = z.object({
  note: z.string(),
  source: z.object({ title: z.string(), url: z.url(), file: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/), snapshot: isoDate, terms: z.string() }),
  areas_from: z.string(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  companies: z.record(z.string(), RegisteredCompany),
});
export type CompaniesFile = z.infer<typeof CompaniesFile>;

export const companyPage = (number: string) => `https://find-and-update.company-information.service.gov.uk/company/${number}`;
