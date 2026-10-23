/**
 * The family of sites, for the switcher beside the logo: public money and promises, one ledger per country or place,
 * on the same open engine, and the maker's own site. The same six sites, in the same order, as on LedgerGov.UK
 * (Pavel, 23 Oct 2026; docs/PRE_SHIP_REVIEW.md, "A short menu and a first screen of cards").
 */
export const FAMILY: readonly { name: string; href: string; about: string }[] = [
  { name: "LedgerGov.UK", href: "https://ledgergov.uk", about: "UK public money and promises" },
  { name: "BoroughBook.UK", href: "https://boroughbook.uk", about: "London council money and pledges" },
  { name: "USLedger.org", href: "https://usledger.org", about: "US federal money and promises" },
  { name: "RussiaLedger.com", href: "https://russialedger.com", about: "Russia's budget, regions and promises" },
  { name: "UkraineLedger.com", href: "https://ukraineledger.com", about: "Ukraine's political promises" },
  { name: "Ruminator.xyz", href: "https://ruminator.xyz", about: "Russia's regional press, read every day" },
];

/** This site, marked "you are here" in the switcher. */
export const THIS_SITE = "BoroughBook.UK";
