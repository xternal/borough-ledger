/* What care for children costs, by council (etl/children_care.py, from the Department for Education's statistics). */
import { z } from "zod";
import { Quality } from "./quality";
import { Source } from "./seed";

const m = z.number();
const n = z.number().int().nonnegative().nullable();

export const ChildrenCareFile = z.object({
  note: z.string(),
  year: z.string().regex(/^\d{4}-\d{2}$/),
  count_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sources: z.array(Source),
  quality: Quality,
  source_ids: z.array(z.string()).min(1),
  england: z.object({ spend_m: m, children: z.number().int().positive(), home_year: z.number().positive(), home_year_quality: Quality, home_year_method: z.string() }),
  /** By the council's ONS code. Spending in £m (null where the Department withheld it); counts null where withheld ("c"). */
  councils: z.record(
    // Unitaries (E06), metropolitan districts (E08), London boroughs (E09) and county councils (E10).
    z.string().regex(/^E(0[689]|10)\d{6}$/),
    z.object({
      name: z.string(),
      la_code: z.string(),
      withheld: z.boolean(),
      spend_m: z
        .object({
          residential: m,
          fostering: m,
          adoption: m,
          special_guardianship: m,
          other: m,
          short_breaks: m,
          family_friends: m,
          education: m,
          leaving_care: m,
          asylum: m,
          total: m,
          childrens_services: m,
        })
        .nullable(),
      children: z.number().int().nonnegative(),
      placements: z.object({ foster: n, childrens_homes: n, supported_accommodation: n, with_parents: n, adoption: n, residential_schools: n, other_residential: n, other: n }),
    }),
  ),
});
export type ChildrenCareFile = z.infer<typeof ChildrenCareFile>;
