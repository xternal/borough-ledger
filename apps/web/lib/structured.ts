/* schema.org JSON-LD for the promise and councillor pages (search engines and AI search read it). */
import type { CouncillorModel, PromiseModel } from "@/lib/model";
import { SITE, SITE_URL } from "@/lib/site";

const CONTEXT = "https://schema.org";

function short(s: string, n = 80): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

function breadcrumbs(items: [name: string, path: string][]) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE_URL}${path}` })),
  };
}

export function promisesJsonLd(promises: readonly PromiseModel[]) {
  return [
    {
      "@context": CONTEXT,
      "@type": "CollectionPage",
      name: "Promises",
      url: `${SITE_URL}/promises`,
      inLanguage: "en-GB",
      isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE_URL },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: promises.length,
        itemListElement: promises.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/promise/${p.id}`, name: short(p.text) })),
      },
    },
    breadcrumbs([["Home", "/"], ["Promises", "/promises"]]),
  ] as const;
}

/** The pledge as a quotation from whoever made it, citing the archived source. */
export function promiseJsonLd(p: PromiseModel) {
  return [
    {
      "@context": CONTEXT,
      "@type": "Quotation",
      text: p.text,
      url: `${SITE_URL}/promise/${p.id}`,
      dateCreated: p.made_on,
      inLanguage: "en-GB",
      creator: p.party ? { "@type": "Person", name: p.actor, affiliation: { "@type": "Organization", name: p.party } } : { "@type": "Organization", name: p.actor },
      ...(p.sources[0] ? { isBasedOn: p.sources[0].url } : {}),
    },
    breadcrumbs([["Home", "/"], ["Promises", "/promises"], [short(p.text), `/promise/${p.id}`]]),
  ] as const;
}

/** A page about a councillor, not their own profile: "about", never "ProfilePage". */
export function councillorJsonLd(c: CouncillorModel) {
  return [
    {
      "@context": CONTEXT,
      "@type": "WebPage",
      name: c.name,
      url: `${SITE_URL}/councillor/${c.id}`,
      inLanguage: "en-GB",
      about: {
        "@type": "Person",
        name: c.name,
        jobTitle: `Councillor for ${c.ward} ward`,
        affiliation: { "@type": "Organization", name: c.party },
        sameAs: [c.democracy_url],
      },
    },
    breadcrumbs([["Home", "/"], ["Promises", "/promises"], [c.name, `/councillor/${c.id}`]]),
  ] as const;
}
