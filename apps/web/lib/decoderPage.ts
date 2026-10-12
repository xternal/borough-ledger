/* What the decoder's pages share: the menu, and plain-words questions and answers (also the landing page's FAQ data). */
import { DECODER } from "./decoder";

/** The decoder's own menu. A council's page sits under "Every council". */
export const DECODER_NAV = [
  ["find", "Find your council"],
  ["england", "Across England"],
  ["councils", "Every council"],
  ["questions", "Questions"],
] as const;

export function decoderQA(): { q: string; a: string }[] {
  return [
    {
      q: "What is Band D?",
      a: "Every home in England is in one of eight council tax bands, A to H, by what it was worth in 1991. Band D is the one the government uses to compare councils; the other bands pay a fixed share of it, from six ninths (Band A) to eighteen ninths (Band H). The figures assume two adults: someone living alone gets 25% off.",
    },
    {
      q: "Why does it say 'on average'?",
      a: "Parish and town councils set their own share, so the bill differs from one parish to the next; like the government's tables, the figures include them on average across the council's area. The other parts are the same across the area, apart from a few districts that charge some places extra for local services (special expenses).",
    },
    {
      q: "What is a precept?",
      a: "The share of the bill set by a body that does not send bills itself: a county council, the Mayor of London, a police and crime commissioner, a fire authority, a combined authority or a parish council. Your council collects it with its own share and passes it on.",
    },
    {
      q: "Does it cover Scotland, Wales and Northern Ireland?",
      a: "Not yet. Scotland and Wales set council tax with their own bands and rules, and Northern Ireland has rates instead. BoroughBook.UK has full pages for Glasgow, Edinburgh, the Highlands, Cardiff and Belfast.",
    },
    {
      q: "Where do the figures come from?",
      a: `The government's council tax requirement tables for ${DECODER.yearLabel} and ${DECODER.prevLabel} (Table 10), which every council fills in. They split each council's average Band D between its own share, parish and town councils, and each body that adds its share; the parts are checked to add up to the government's total for every council.`,
    },
    {
      q: "Is BoroughBook.UK the council?",
      a: "No. BoroughBook.UK is an independent project, not run by or affiliated with any council or party.",
    },
  ];
}
