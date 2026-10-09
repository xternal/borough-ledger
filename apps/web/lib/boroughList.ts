/* The boroughs on the site, bundled (no file reads), so any page can link them, including pages rendered on request. */
import config from "../../../data/config/boroughs.json";

/** London boroughs (ONS codes E09) and, outside London, the cities, which the picker lists apart. */
export type PlaceGroup = "London boroughs" | "Cities";
const groupOf = (ons: string): PlaceGroup => (ons.startsWith("E09") ? "London boroughs" : "Cities");

export const HOME_BOROUGH = { slug: "", short: "Hammersmith & Fulham", href: "/", group: "London boroughs" as PlaceGroup };
export const OTHER_BOROUGHS = config.boroughs.map((b) => ({ slug: b.slug, short: b.short, href: `/${b.slug}`, group: groupOf(b.ons) }));

/** "the London Borough of Camden", "the Royal Borough of Kensington and Chelsea", but "Manchester City Council". */
export const councilWithThe = (council: string) => (/^(London|Royal) Borough/.test(council) ? `the ${council}` : council);

