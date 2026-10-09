/* Every borough on the site with its wards, for the postcode finder: Hammersmith & Fulham's wards open their own pages,
   other boroughs' open their part of the borough page. Bundled (no file reads), so pages rendered on request can use it. */
import { DATA } from "@borough-ledger/schema";
import finder from "../../../data/build/boroughs/finder.json";
import type { FinderPlace } from "./wardFinder";

export const PLACES: FinderPlace[] = [
  {
    short: DATA.council.meta.council_short,
    ons: DATA.council.meta.council_code,
    href: "/",
    wards: DATA.content.wards.wards.map((w) => ({ name: w.name, ons_code: w.ons_code, href: `/ward/${w.id}` })),
  },
  ...finder.boroughs.map((b) => ({
    short: b.short,
    ons: b.ons,
    href: `/${b.slug}`,
    // Northern Ireland: a postcode's ward opens its district electoral area, which the page calls an "area".
    ...("word" in b && typeof b.word === "string" ? { word: b.word } : {}),
    wards: b.wards.map((w) => ({ name: w.name, ons_code: w.ons_code, href: `/${b.slug}#ward-${w.id}` })),
  })),
];

/** "Hammersmith & Fulham and Kensington and Chelsea": the boroughs covered so far, for messages. */
export const COVERED = PLACES.map((p) => p.short).reduce((a, s, i, all) => (i === 0 ? s : `${a}${i === all.length - 1 ? " and " : ", "}${s}`), "");
