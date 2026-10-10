/* The boroughs on the site, bundled (no file reads), so any page can link them, including pages rendered on request. */
import config from "../../../data/config/boroughs.json";

/** London boroughs (ONS codes E09), cities and towns, and councils covering a county, region or rural district, which the picker lists apart. */
export type PlaceGroup = "London boroughs" | "Cities and towns" | "Counties and regions";
const groupOf = (b: { ons: string; kind?: string }): PlaceGroup =>
  b.ons.startsWith("E09") ? "London boroughs" : b.kind === "county" || b.kind === "district" ? "Counties and regions" : "Cities and towns";
/** What the picker calls the place you are on: a borough, a city, a town (Swindon), an area or a district (South Oxfordshire). */
const labelOf = (b: { ons: string; kind?: string }): string =>
  b.ons.startsWith("E09") ? "Borough" : b.kind === "county" ? "Area" : b.kind === "district" ? "District" : b.kind === "town" ? "Town" : "City";

export const HOME_BOROUGH = { slug: "", short: "Hammersmith & Fulham", href: "/", group: "London boroughs" as PlaceGroup, label: "Borough" };
export const OTHER_BOROUGHS = config.boroughs.map((b) => ({ slug: b.slug, short: b.short, href: `/${b.slug}`, group: groupOf(b), label: labelOf(b) }));

/** "the London Borough of Camden", "the Royal Borough of Kensington and Chelsea", but "Manchester City Council". */
export const councilWithThe = (council: string) => (/^(London|Royal) Borough/.test(council) ? `the ${council}` : council);

