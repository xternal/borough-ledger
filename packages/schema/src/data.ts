/* The council year comes from the ETL build (etl/build.py); promises and payments are still seed data until M3 and M4. */
import hfRaw from "../../../data/build/hf_2026-27.json";
import promisesRaw from "../../../data/seed/promises.json";
import paymentsRaw from "../../../data/seed/payments.json";
import rulesRaw from "../../../data/config/rules.json";
import { CouncilYear, Payments, Promises, Rules, type Source } from "./seed";
import type { Quality } from "./quality";

export interface Dataset {
  council: CouncilYear;
  promises: Promises;
  payments: Payments;
  rules: Rules;
  /** Every source cited anywhere, by id. */
  sources: ReadonlyMap<string, Source>;
}

/** Every (quality, source_id) pair in the dataset, with a path for error messages. */
export function provenanceRefs(d: Omit<Dataset, "sources">): { path: string; quality: Quality; source_id: string }[] {
  const out: { path: string; quality: Quality; source_id: string }[] = [];
  const add = (path: string, x: { quality: Quality; source_id: string }) =>
    out.push({ path, quality: x.quality, source_id: x.source_id });
  const c = d.council;
  add("bill", c.bill);
  add("tax_base", c.tax_base);
  c.funding.forEach((f) => add(`funding.${f.id}`, f));
  c.services.forEach((s) => add(`services.${s.id}`, s));
  c.savings.forEach((s) => add(`savings.${s.id}`, s));
  c.gap_2026_27.forEach((g, i) => {
    if ("quality" in g) add(`gap_2026_27[${i}] ${g.label}`, g);
  });
  add("next_year", c.next_year);
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
  add("politics", c.politics);
  d.promises.promises.forEach((p) => {
    if (p.cost_m && p.cost_quality && p.cost_source_id)
      out.push({ path: `promises.${p.id}.cost`, quality: p.cost_quality, source_id: p.cost_source_id });
  });
  add("payments", d.payments.meta);
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
export function parseDataset(raw: { council: unknown; promises: unknown; payments: unknown; rules: unknown }): Dataset {
  const council = CouncilYear.parse(raw.council);
  const promises = Promises.parse(raw.promises);
  const payments = Payments.parse(raw.payments);
  const rules = Rules.parse(raw.rules);

  const sources = new Map<string, Source>();
  for (const s of [...council.meta.sources, ...rules.meta.sources]) {
    if (sources.has(s.id)) throw new Error(`duplicate source id ${s.id}`);
    sources.set(s.id, s);
  }

  const problems: string[] = [];
  for (const ref of provenanceRefs({ council, promises, payments, rules })) {
    const s = sources.get(ref.source_id);
    if (!s) problems.push(`${ref.path}: unknown source_id "${ref.source_id}"`);
    else if (ref.quality !== "test" && !s.url) problems.push(`${ref.path}: ${ref.quality} value cites "${s.id}", which has no URL`);
  }
  const promiseIds = new Set(promises.promises.map((p) => p.id));
  const toggleIds = new Set(council.next_year.toggles.map((t) => t.id));
  const leverIds = new Set<string>(council.next_year.levers.map((l) => l.id));
  for (const t of council.next_year.toggles)
    if (t.promise_id && !promiseIds.has(t.promise_id)) problems.push(`toggle ${t.id}: unknown promise ${t.promise_id}`);
  for (const p of promises.promises)
    if (p.lever_or_toggle_id && !toggleIds.has(p.lever_or_toggle_id) && !leverIds.has(p.lever_or_toggle_id))
      problems.push(`promise ${p.id}: unknown lever or toggle ${p.lever_or_toggle_id}`);
  for (const y of [council.meta.year, council.next_year.year])
    if (!rules.referendum_limit_pct[y]) problems.push(`rules: no referendum limit for ${y}`);
  const serviceIds = new Set(council.services.map((s) => s.id));
  for (const s of council.savings)
    if (s.service_group && !serviceIds.has(s.service_group)) problems.push(`saving ${s.id}: unknown service group ${s.service_group}`);
  for (const f of council.funding)
    if (f.ring_fenced_to && !serviceIds.has(f.ring_fenced_to)) problems.push(`funding ${f.id}: ring-fenced to unknown service ${f.ring_fenced_to}`);
  if (!rules.instalments.options.includes(rules.instalments.default)) problems.push("rules: default instalments not among options");
  if (problems.length) throw new Error(`Seed data failed cross-checks:\n  ${problems.join("\n  ")}`);

  return { council, promises, payments, rules, sources };
}

/** The parsed seed. Parsing happens once, at import; bad data fails the build. */
export const DATA: Dataset = parseDataset({ council: hfRaw, promises: promisesRaw, payments: paymentsRaw, rules: rulesRaw });
