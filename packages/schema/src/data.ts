/* The council year comes from the ETL build (etl/build.py), promises and councillors from content/ (compiled to
   data/build/content.json), payments from the council's spend files (etl/payments.py; the month files are read by the app),
   ward boundaries from the ONS (etl/ward_map.py), building schemes by ward (etl/capital_wards.py). */
import hfRaw from "../../../data/build/hf_2026-27.json";
import contentRaw from "../../../data/build/content.json";
import paymentsRaw from "../../../data/build/payments/index.json";
import wardMapRaw from "../../../data/build/ward_map.json";
import wardSpendRaw from "../../../data/build/ward_spend.json";
import decisionsRaw from "../../../data/build/decisions.json";
import electionsRaw from "../../../data/build/elections.json";
import rulesRaw from "../../../data/config/rules.json";
import { checkContent, ContentFile, type Content } from "./content";
import { checkPayments, PaymentsIndex } from "./payments";
import { CouncilYear, Rules, type Source } from "./seed";
import { checkWardMap, WardMap } from "./wardmap";
import { checkWardSpend, WardSpend } from "./wardspend";
import { checkDecisionLinks, DecisionsFile } from "./decisions";
import { checkElections, ElectionsFile } from "./elections";
import type { Quality } from "./quality";

export interface Dataset {
  council: CouncilYear;
  content: Content;
  payments: PaymentsIndex;
  rules: Rules;
  wardMap: WardMap;
  /** Council building schemes by ward (etl/capital_wards.py). */
  wardSpend: WardSpend;
  /** Cabinet and Full Council decisions (etl/decisions.py). */
  decisions: DecisionsFile;
  /** Ward results of the borough election (etl/elections.py). */
  elections: ElectionsFile;
  /** Every source cited anywhere, by id. */
  sources: ReadonlyMap<string, Source>;
}

/** The source id every election figure cites. */
export const ELECTIONS_SOURCE_ID = "democracy_club_elections";

/** Every (quality, source_id) pair in the dataset, with a path for error messages. */
export function provenanceRefs(d: Omit<Dataset, "sources" | "wardMap" | "wardSpend" | "decisions" | "elections">): { path: string; quality: Quality; source_id: string }[] {
  const out: { path: string; quality: Quality; source_id: string }[] = [];
  const add = (path: string, x: { quality: Quality; source_id: string }) =>
    out.push({ path, quality: x.quality, source_id: x.source_id });
  const c = d.council;
  add("bill", c.bill);
  c.bill.gla_split?.forEach((g) => add(`bill.gla_split.${g.id}`, g));
  add("tax_base", c.tax_base);
  c.funding.forEach((f) => add(`funding.${f.id}`, f));
  c.services.forEach((s) => add(`services.${s.id}`, s));
  c.savings.forEach((s) => add(`savings.${s.id}`, s));
  c.gap_2026_27.forEach((g, i) => {
    if ("quality" in g) add(`gap_2026_27[${i}] ${g.label}`, g);
  });
  add("next_year", c.next_year);
  c.next_year.forecast.forEach((f) => add(`next_year.forecast.${f.year}`, f));
  add("next_year.reserves.general", c.next_year.reserves.general);
  add("next_year.reserves.minimum_safe", c.next_year.reserves.minimum_safe);
  c.history.budget.forEach((h) => out.push({ path: `history.budget.${h.year}`, quality: c.history.quality, source_id: h.source_id }));
  c.history.outturn.forEach((h) =>
    h.source_ids.forEach((id) => out.push({ path: `history.outturn.${h.year}`, quality: c.history.quality, source_id: id })),
  );
  c.history.council_tax.forEach((h) =>
    h.source_ids.forEach((id) => out.push({ path: `history.council_tax.${h.year}`, quality: c.history.quality, source_id: id })),
  );
  c.next_year.levers.forEach((l) => add(`next_year.levers.${l.id}`, l));
  c.next_year.toggles.forEach((t) => add(`next_year.toggles.${t.id}`, t));
  const pay = d.payments;
  pay.months.forEach((m) => m.files.forEach((f) => out.push({ path: `payments.${m.month}`, quality: pay.meta.quality, source_id: f })));
  const r = d.rules;
  add("rules.band_ratios", r.band_ratios);
  add("rules.single_person_discount", r.single_person_discount);
  add("rules.balanced_budget", r.balanced_budget);
  out.push({ path: "rules.balanced_budget.s114", quality: r.balanced_budget.quality, source_id: r.balanced_budget.s114_source_id });
  Object.entries(r.referendum_limit_pct).forEach(([y, l]) => add(`rules.referendum_limit_pct.${y}`, l));
  add("rules.instalments", r.instalments);
  return out;
}

/** Parse and cross-check raw seed objects. Throws with every problem listed. */
export function parseDataset(raw: { council: unknown; content: unknown; payments: unknown; rules: unknown; wardMap: unknown; wardSpend: unknown; decisions: unknown; elections: unknown }): Dataset {
  const council = CouncilYear.parse(raw.council);
  const content = ContentFile.parse(raw.content);
  const payments = PaymentsIndex.parse(raw.payments);
  const rules = Rules.parse(raw.rules);
  const wardMap = WardMap.parse(raw.wardMap);
  const wardSpend = WardSpend.parse(raw.wardSpend);
  const decisions = DecisionsFile.parse(raw.decisions);
  const elections = ElectionsFile.parse(raw.elections);

  const sources = new Map<string, Source>();
  const paymentSources: Source[] = payments.sources.map((s) => ({
    id: s.id,
    title: s.title,
    publisher: payments.meta.publisher,
    url: s.url,
    asset_url: s.archive_url ?? s.url,
    sha256: s.sha256,
    licence: payments.meta.licence,
  }));
  const wardMapSource: Source = {
    id: "ons_wards_2024",
    title: wardMap.source.title,
    publisher: "Office for National Statistics",
    url: wardMap.source.page,
    asset_url: wardMap.source.url,
    sha256: wardMap.source.sha256,
    licence: wardMap.source.licence,
  };
  const electionsSource: Source = {
    id: ELECTIONS_SOURCE_ID,
    title: `${elections.source.title}: ${elections.election.name}, ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${elections.election.date}T12:00:00Z`))}`,
    publisher: "Democracy Club",
    url: `https://candidates.democracyclub.org.uk/elections/${elections.election.id}/`,
    asset_url: elections.source.url,
    licence: elections.source.licence,
    note: `Copied from the council's declarations; retrieved ${elections.source.retrieved_on}.`,
  };
  for (const s of [...council.meta.sources, ...rules.meta.sources, ...paymentSources, wardMapSource, electionsSource]) {
    if (sources.has(s.id)) throw new Error(`duplicate source id ${s.id}`);
    sources.set(s.id, s);
  }

  const problems: string[] = [];
  for (const ref of provenanceRefs({ council, content, payments, rules })) {
    const s = sources.get(ref.source_id);
    if (!s) problems.push(`${ref.path}: unknown source_id "${ref.source_id}"`);
    else if (ref.quality !== "test" && !s.url) problems.push(`${ref.path}: ${ref.quality} value cites "${s.id}", which has no URL`);
  }
  problems.push(...checkContent(content));
  problems.push(...checkPayments(payments));
  problems.push(...checkWardMap(wardMap, content, council.meta.council_code));
  problems.push(...checkWardSpend(wardSpend, content, payments));
  problems.push(...checkDecisionLinks(content, decisions));
  problems.push(...checkElections(elections, content));
  const promiseIds = new Set(content.promises.map((p) => p.id));
  const toggleIds = new Set(council.next_year.toggles.map((t) => t.id));
  const leverIds = new Set<string>(council.next_year.levers.map((l) => l.id));
  for (const t of council.next_year.toggles)
    if (t.promise_id && !promiseIds.has(t.promise_id)) problems.push(`toggle ${t.id}: unknown promise ${t.promise_id}`);
  for (const p of content.promises)
    if (p.lever_or_toggle_id && !toggleIds.has(p.lever_or_toggle_id) && !leverIds.has(p.lever_or_toggle_id))
      problems.push(`promise ${p.id}: unknown lever or toggle ${p.lever_or_toggle_id}`);
  const fc = council.next_year.forecast;
  if (fc[0]?.year !== council.next_year.year || fc[0]?.gap_m !== council.next_year.gap_m)
    problems.push("next_year.forecast must start with next year's gap");
  for (const y of [council.meta.year, council.next_year.year])
    if (!rules.referendum_limit_pct[y]) problems.push(`rules: no referendum limit for ${y}`);
  const serviceIds = new Set(council.services.map((s) => s.id));
  for (const s of council.savings)
    if (s.service_group && !serviceIds.has(s.service_group)) problems.push(`saving ${s.id}: unknown service group ${s.service_group}`);
  for (const f of council.funding)
    if (f.ring_fenced_to && !serviceIds.has(f.ring_fenced_to)) problems.push(`funding ${f.id}: ring-fenced to unknown service ${f.ring_fenced_to}`);
  if (!rules.instalments.options.includes(rules.instalments.default)) problems.push("rules: default instalments not among options");
  if (problems.length) throw new Error(`Seed data failed cross-checks:\n  ${problems.join("\n  ")}`);

  return { council, content, payments, rules, wardMap, wardSpend, decisions, elections, sources };
}

/** The parsed seed. Parsing happens once, at import; bad data fails the build. */
export const DATA: Dataset = parseDataset({ council: hfRaw, content: contentRaw, payments: paymentsRaw, rules: rulesRaw, wardMap: wardMapRaw, wardSpend: wardSpendRaw, decisions: decisionsRaw, elections: electionsRaw });
