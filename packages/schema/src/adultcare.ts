/* What care for adults costs, by council (etl/adult_care.py, from the government's adult social care finance report). */
import { z } from "zod";
import { Quality } from "./quality";
import { Source } from "./seed";

const k = z.number();
const unit = z.number().positive().nullable();
const Units = z.object({ residential_65: unit, nursing_65: unit, residential_18_64: unit, nursing_18_64: unit, home_care_hour: unit });

export const AdultCareFile = z.object({
  note: z.string(),
  year: z.string().regex(/^\d{4}-\d{2}$/),
  prev_year: z.string().regex(/^\d{4}-\d{2}$/),
  source: Source,
  quality: Quality,
  source_id: z.string(),
  /** By the council's ONS code. Spending in £ thousand; unit costs in £ a week (homes) or £ an hour (home care). */
  councils: z.record(
    // Unitaries (E06), metropolitan districts (E08), London boroughs (E09) and county councils (E10).
    z.string().regex(/^E(0[689]|10)\d{6}$/),
    z.object({
      name: z.string(),
      spend_k: z.object({ total: k, long_term: k, short_term: k, other: k }),
      settings_k: z.object({ care_homes: k, home_care: k, supported_living: k, direct_payments: k, supported_accommodation: k, other_long_term: k }),
      /** Long-term care for working-age adults (18 to 64) and for older people (65 and over). */
      long_term_by_age_k: z.object({ working_age: k, older: k }),
      home_care_from: z.enum(["agencies", "the council"]),
      unit: Units,
      unit_prev: Units,
    }),
  ),
});
export type AdultCareFile = z.infer<typeof AdultCareFile>;
