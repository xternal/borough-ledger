/* The boroughs on the site, bundled (no file reads), so any page can link them, including pages rendered on request. */
import config from "../../../data/config/boroughs.json";

export const HOME_BOROUGH = { slug: "", short: "Hammersmith & Fulham", href: "/" };
export const OTHER_BOROUGHS = config.boroughs.map((b) => ({ slug: b.slug, short: b.short, href: `/${b.slug}` }));

/** "the London Borough of Camden", "the Royal Borough of Kensington and Chelsea", but "Manchester City Council". */
export const councilWithThe = (council: string) => (/^(London|Royal) Borough/.test(council) ? `the ${council}` : council);

