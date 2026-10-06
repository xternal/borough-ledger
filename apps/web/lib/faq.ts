/** Short FAQ shown on the page and published as FAQPage structured data. No figures: those carry provenance marks on the page. */
export function faq(council: string): { q: string; a: string }[] {
  return [
    {
      q: "Is this the council's website?",
      a: `No. Borough Ledger is an independent project. It is not run by, endorsed by or affiliated with ${council} Council.`,
    },
    {
      q: "Where do the numbers come from?",
      a: "From the council's budget reports, the returns every council files with central government and the council's monthly payments files. Every figure is marked sourced, approx or test, and each source is linked on this page.",
    },
    {
      q: "Why does council tax pay for only part of the budget?",
      a: "The council's day-to-day spending is also paid for by business rates it keeps, government grants and, in some years, a one-off draw on reserves. Council tax is the part residents pay directly.",
    },
    {
      q: "Does the site store my band or my choices?",
      a: "No. The bill calculator and the balance tool run in your browser. Your band, discount and choices are never sent anywhere, and reading the site never needs an account.",
    },
  ];
}
