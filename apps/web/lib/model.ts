import "server-only";
import {
  DATA,
  derive,
  fig,
  isGapValueLine,
  listTestValues,
  type Figure,
  type GapLine,
  type Lever,
  type LeverId,
  type PromiseCard,
  sideOf,
  partyOf,
  type Quality,
  type CouncilYear,
  type Rules,
  type Saving,
  type Source,
  type Toggle,
} from "@borough-ledger/schema";
import { buildWaterfall, checkBudget, displayYear, nextFinancialYear, type BalanceInput } from "@borough-ledger/engine";
import { latestQuarter, PAY } from "./payments";

/** Everything the page renders, as serialisable data. Built once per render on the server. */
export interface FlowLine {
  id: string;
  label: string;
  f: Figure;
  gap: boolean;
  desc?: string;
  /** Funding: the service a ring-fenced grant must be spent on. */
  ringFencedTo?: string;
  /** Services: spending less ring-fenced grants, which council tax helps pay for. */
  general?: Figure;
}

export interface WaterfallRowModel {
  label: string;
  kind: GapLine["kind"];
  f: Figure;
  from: number;
  to: number;
}

export interface SavingRow {
  id: string;
  label: string;
  service: string;
  f: Figure;
  next: Figure;
  oneOff: boolean;
}

export interface CostModel {
  low: Figure;
  central: Figure;
  high: Figure;
  perBandD: Figure;
  share: Figure;
  note?: string;
}

export interface CouncillorModel {
  id: string;
  name: string;
  party: string;
  partyId: string;
  side: "administration" | "opposition";
  wardId: string;
  ward: string;
  roles: string[];
  democracy_url: string;
}

/** A promise card ready to render, the same shape for every party. */
export interface PromiseModel {
  id: string;
  /** Who made it: the party's name, or the councillor's. */
  actor: string;
  /** The councillor's party, when the actor is a councillor. */
  party: string | null;
  partyId: string;
  /** The party's short name ("Labour"), for filters and lists. */
  partyShort: string;
  side: "administration" | "opposition";
  made_on: string;
  venue: string;
  area: string;
  /** Set when the pledge is about one ward only. */
  wardId: string | null;
  /** The latest wording, with the page of its source. */
  text: string;
  page: number | null;
  versions: PromiseCard["versions"];
  status: PromiseCard["status"];
  deadline: string | null;
  funded_by: string | null;
  cost: CostModel | null;
  capital: CostModel | null;
  sources: { title: string; url: string }[];
  timeline: { date: string; type: string; event: string; evidence_url?: string }[];
  replies: PromiseCard["replies"];
  lever_or_toggle_id?: string;
  editorCheck: boolean;
  test?: boolean;
}

export interface PageModel {
  place: { council: string; short: string; yearLabel: string; nextYearLabel: string; yearAfterLabel: string };
  today: string;
  hasTestData: boolean;
  rules: Rules;
  bill: {
    council: Figure;
    gla: Figure;
    total: Figure;
    risePct: Figure;
    councilShare: Figure;
    ratios: Figure;
    spd: Figure;
    instalments: { options: number[]; f: Figure };
    glaNote: string;
    /** The Mayor of London's Band D share by body, this year and last; outside London, police, fire and the rest. */
    glaSplit: { id: string; label: string; phrase: string; officialTerm: string; f: Figure; prev: Figure }[];
    /** Who the rest of the bill goes to: "Mayor of London (GLA)" in London, police and fire elsewhere. */
    others: { name: string; to: string; short: string; with: string; quality: string; as: string };
    /** Paid only by homes in a parish (Birmingham's two). */
    parish: { count: number; names: string | null; f: Figure } | null;
  };
  funding: FlowLine[];
  services: FlowLine[];
  netBudget: Figure;
  /** What the council pays for from council tax, business rates and general grants: the budget less ring-fenced grants. */
  generalBudget: Figure;
  /** Shares of the whole budget, by kind of funding. */
  ctShare: Figure;
  grantsShare: Figure;
  ratesShare: Figure;
  /** Council tax as a share of the budget the council funds itself. */
  ctShareGeneral: Figure;
  savingsThisYear: Figure;
  savings: { service: SavingRow[]; collection: SavingRow[]; serviceTotal: Figure | null; collectionTotal: Figure | null; oneOffTotal: Figure | null };
  waterfall: { rows: WaterfallRowModel[]; gap: Figure; maxM: number };
  balance: {
    input: BalanceInput;
    levers: Lever[];
    toggles: Toggle[];
    /** Switches held back until their cost is sourced. */
    pendingToggles: string[];
    gap: Figure;
    reservesGeneral: Figure;
    reservesMin: Figure;
    /** Next year's referendum threshold; null when government sets no limit for this council. */
    referendumLimit: Figure | null;
    /** Why there is no limit, when there is none. */
    referendumNote: { text: string; f: Figure } | null;
    /** The council tax rise the gap forecast already assumes, if any. */
    ctAssumed: Figure | null;
    /** The council's later forecast, shown beside the one the tool uses until its basis is checked. */
    revised: { gap: Figure; lastLabel: string; last: Figure; source: string } | null;
    /** Three years from next year: the council's forecast gap where it has one, null where it does not forecast. */
    strip: { year: string; label: string; gap: Figure | null }[];
    /** Quality and sources shared by every number the tool computes. */
    computed: Figure;
    coef: Record<LeverId, Figure>;
  };
  /** This year's referendum limit, for the rules in Method. */
  referendumLimitNow: Figure;
  politics: { control: string; seats: Figure; totalSeats: Figure };
  promises: PromiseModel[];
  people: { councillors: CouncillorModel[]; wards: { id: string; name: string; ons_code: string; councillor_ids: string[] }[]; retrievedOn: string };
  /** The latest three months of the council's spend files; the full ledger is at /payments. */
  payments: ReturnType<typeof latestQuarter> & { months: number; suppliers: number; firstMonth: string };
  sources: Source[];
  qualityLegend: { budget: QualityItem[]; gap: QualityItem[] };
}

export interface QualityItem {
  label: string;
  quality: Quality;
}

const of = (x: { quality: Quality; source_id: string }, value: number) => fig(value, x.quality, x.source_id);

/** Party control from the council's own councillor records. */
function politicsOf(K: typeof DATA.content): PageModel["politics"] {
  const seats = (party: string | null) => K.councillors.filter((c) => c.party === party).length;
  const party = K.parties.find((p) => p.id === K.control);
  const src = "moderngov_councillors";
  return {
    control: party?.short ?? "No overall control",
    seats: fig(seats(K.control), "sourced", src),
    totalSeats: fig(K.councillors.length, "sourced", src),
  };
}

function promiseModel(K: typeof DATA.content, p: PromiseCard, costOf: (x: PromiseCard["cost_m"], id: string) => CostModel | null): PromiseModel {
  const partyId = partyOf(K, p);
  const party = K.parties.find((x) => x.id === partyId);
  const councillor = p.actor.kind === "councillor" ? K.councillors.find((c) => c.id === p.actor.id) : undefined;
  const latest = p.versions[p.versions.length - 1]!;
  const sources = new Map<string, string>();
  for (const v of p.versions) {
    const m = party?.manifesto;
    const title = m && v.source_url === m.url ? `${m.title}${v.page ? `, page ${v.page}` : ""}` : v.source_url;
    sources.set(v.archive_url ?? (m && v.source_url === m.url && m.archive_url ? m.archive_url : v.source_url), title);
  }
  for (const e of p.events) if (e.evidence_url && !sources.has(e.evidence_url)) sources.set(e.evidence_url, e.text.split(":")[0] ?? e.evidence_url);
  return {
    id: p.id,
    actor: councillor?.name ?? party?.name ?? p.actor.id,
    party: councillor ? (party?.short ?? null) : null,
    partyId,
    partyShort: party?.short ?? party?.name ?? partyId,
    side: sideOf(K, partyId),
    made_on: p.made_on,
    venue: p.venue,
    area: p.area,
    wardId: p.ward_id ?? null,
    text: latest.text,
    page: latest.page ?? null,
    versions: p.versions,
    status: p.status,
    deadline: p.deadline,
    funded_by: p.funded_by ?? null,
    cost: costOf(p.cost_m ?? null, p.id),
    capital: costOf(p.capital_cost_m ?? null, p.id),
    sources: [...sources].map(([url, title]) => ({ url, title })),
    timeline: p.events.map((e) => ({ date: e.date, type: e.type, event: e.text, ...(e.evidence_url ? { evidence_url: e.evidence_url } : {}) })),
    replies: p.replies,
    ...(p.lever_or_toggle_id ? { lever_or_toggle_id: p.lever_or_toggle_id } : {}),
    editorCheck: !!p.editor_check_required,
  };
}

function nonNull<T>(v: T | null, what: string): T {
  if (v === null) throw new Error(`${what} is missing`);
  return v;
}

function savingsModel(all: Saving[]): PageModel["savings"] {
  const row = (s: Saving): SavingRow => ({
    id: s.id,
    label: s.label,
    service: s.service || s.directorate,
    f: of(s, s.m),
    next: of(s, s.m_next_year),
    oneOff: s.one_off,
  });
  const total = (rows: SavingRow[]) => {
    const [first, ...rest] = rows.map((r) => r.f);
    return first ? derive(rows.reduce((a, r) => a + r.f.value, 0), first, ...rest) : null;
  };
  const byAmount = (a: SavingRow, z: SavingRow) => z.f.value - a.f.value;
  const service = all.filter((s) => s.kind === "service").map(row).sort(byAmount);
  const collection = all.filter((s) => s.kind === "collection_fund").map(row).sort(byAmount);
  return { service, collection, serviceTotal: total(service), collectionTotal: total(collection), oneOffTotal: total([...service, ...collection].filter((r) => r.oneOff)) };
}

function londonToday(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** What any borough's statement shows from the government returns: the bill and the budget, checked to balance. */
export type StatementModel = Pick<PageModel, "bill" | "funding" | "services" | "netBudget" | "generalBudget" | "ctShare" | "grantsShare" | "ratesShare" | "ctShareGeneral"> & {
  budgetLegend: QualityItem[];
};

export function statementModel(C: Pick<CouncilYear, "bill" | "funding" | "services">, R: Rules): StatementModel {
  const budget = checkBudget(C.funding, C.services, R.balanced_budget.tolerance_m);
  if (!budget.balances)
    throw new Error(`Budget does not balance: funding £${budget.fundingM}m vs spending £${budget.spendingM}m`);

  /* bill */
  const b = C.bill;
  const council = of(b, b.band_d_council);
  const gla = of(b, b.band_d_gla);
  const total = of(b, b.band_d_total);
  const prev = of(b, b.band_d_total_prev);

  /* budget */
  const funding: FlowLine[] = C.funding.map((x) => ({
    id: x.id,
    label: x.label,
    f: of(x, x.m),
    gap: !!x.gap,
    desc: x.desc,
    ...(x.ring_fenced_to ? { ringFencedTo: x.ring_fenced_to } : {}),
  }));
  const services: FlowLine[] = C.services.map((x) => ({
    id: x.id,
    label: x.label,
    f: of(x, x.m),
    gap: false,
    desc: x.desc,
    general: of(x, x.general_fund_m),
  }));
  const sumOf = (lines: FlowLine[], pick: (l: FlowLine) => Figure = (l) => l.f): Figure => {
    const [first, ...rest] = lines.map(pick);
    if (!first) throw new Error("no lines to add up");
    return derive(lines.reduce((a, l) => a + pick(l).value, 0), first, ...rest);
  };
  const netBudget = sumOf(funding);
  const generalBudget = sumOf(services, (l) => l.general!);
  const byKind = (kind: string) => {
    const lines = C.funding.filter((x) => x.kind === kind).map((x) => funding.find((f) => f.id === x.id)!);
    if (!lines.length) throw new Error(`funding has no ${kind} line`);
    const t = sumOf(lines);
    return derive(t.value / netBudget.value, t, netBudget);
  };
  const ct = funding.find((x) => x.id === "council_tax");
  if (!ct) throw new Error("funding has no council_tax line");
  const ctShare = byKind("council_tax");
  const grantsShare = byKind("grant");
  const ratesShare = byKind("business_rates");
  const ctShareGeneral = derive(ct.f.value / generalBudget.value, ct.f, generalBudget);

  const bill: PageModel["bill"] = {
    council,
    gla,
    total,
    risePct: derive((b.band_d_total / b.band_d_total_prev - 1) * 100, total, prev),
    councilShare: derive(b.band_d_council / b.band_d_total, council, total),
    ratios: of(R.band_ratios, 1),
    spd: of(R.single_person_discount, R.single_person_discount.value),
    instalments: { options: R.instalments.options, f: of(R.instalments, R.instalments.default) },
    glaNote: b.gla_note,
    glaSplit: (b.gla_split ?? []).map((g) => ({ id: g.id, label: g.label, phrase: g.phrase, officialTerm: g.official_term, f: of(g, g.band_d), prev: of(g, g.band_d_prev) })),
    others: b.others
      ? { name: b.others.name, to: b.others.to, short: b.others.short, with: b.others.with, quality: `${b.others.name} by body (${b.others.source ?? "government council tax tables"})`, as: "" }
      : { name: "Mayor of London (GLA)", to: "the Mayor of London", short: "the Mayor’s share", with: "the Mayor of London", quality: "Mayor's share by body (MD3472)", as: "Mayor of London: " },
    parish: b.parish ? { count: b.parish.count, names: b.parish.names ?? null, f: of(b.parish, b.parish.band_d) } : null,
  };
  return {
    bill,
    funding,
    services,
    netBudget,
    generalBudget,
    ctShare,
    grantsShare,
    ratesShare,
    ctShareGeneral,
    budgetLegend: [...C.funding, ...C.services].map((x) => ({ label: x.label, quality: x.quality })),
  };
}

export function buildModel(): PageModel {
  const { council: C, rules: R, content: K } = DATA;
  const tol = R.balanced_budget.tolerance_m;

  const S = statementModel(C, R);
  const { funding, services, netBudget, generalBudget, ctShare, grantsShare, ratesShare, ctShareGeneral } = S;

  /* gap */
  const wf = buildWaterfall(C.gap_2026_27, tol);
  if (!wf.closes) throw new Error(`The ${C.meta.year} waterfall does not close: £${wf.residualM}m left`);
  const seen: Figure[] = [];
  const rows: WaterfallRowModel[] = wf.rows.map((r) => {
    if (isGapValueLine(r.line)) {
      const f = of(r.line, r.value);
      seen.push(f);
      return { label: r.label, kind: r.kind, f, from: r.from, to: r.to };
    }
    const [s0, ...sRest] = seen;
    return { label: r.label, kind: r.kind, f: derive(r.value, s0!, ...sRest), from: r.from, to: r.to };
  });
  const gapRow = rows.find((r) => r.kind === "subtotal");
  const savingsLines = rows.filter((r) => r.kind === "close_saving");
  const savingsThisYear =
    savingsLines.length > 0
      ? derive(-savingsLines.reduce((a, r) => a + r.f.value, 0), savingsLines[0]!.f, ...savingsLines.slice(1).map((r) => r.f))
      : fig(0, "test", "prototype_test");

  /* balance it */
  const ny = C.next_year;
  const limit = R.referendum_limit_pct[ny.year];
  const limitNow = R.referendum_limit_pct[C.meta.year];
  if (!limit || !limitNow) throw new Error(`no referendum limit for ${ny.year} or ${C.meta.year}`);
  const gap = of(ny, ny.gap_m);
  const reservesGeneral = of(ny.reserves.general, ny.reserves.general.m);
  const reservesMin = of(ny.reserves.minimum_safe, ny.reserves.minimum_safe.m);
  const coef = Object.fromEntries(ny.levers.map((l) => [l.id, of(l, l.m_per_unit)])) as Record<LeverId, Figure>;
  const computed = derive(0, gap, reservesGeneral, ...Object.values(coef), ...ny.toggles.map((t) => of(t, t.cost_m)));

  /* promises: costed the same way for every side */
  const taxBase = of(C.tax_base, C.tax_base.band_d_equivalents);
  const costOf = (x: PromiseCard["cost_m"], id: string): CostModel | null => {
    if (!x) return null;
    const c = (v: number) => fig(v, x.quality, `promise:${id}`);
    const central = c(x.range[1]);
    return {
      low: c(x.range[0]),
      central,
      high: c(x.range[2]),
      perBandD: derive((central.value * 1e6) / taxBase.value, central, taxBase),
      share: derive(central.value / generalBudget.value, central, generalBudget),
      ...(x.note ? { note: x.note } : {}),
    };
  };
  // Newest first, then by id: a neutral order that favours no party.
  const promises: PromiseModel[] = [...K.promises]
    .sort((a, z) => z.made_on.localeCompare(a.made_on) || a.id.localeCompare(z.id))
    .map((p) => promiseModel(K, p, costOf));


  return {
    place: {
      council: C.meta.council,
      short: C.meta.council_short,
      yearLabel: displayYear(C.meta.year),
      nextYearLabel: displayYear(ny.year),
      yearAfterLabel: displayYear(nextFinancialYear(ny.year)),
    },
    today: londonToday(),
    hasTestData: listTestValues(DATA).length > 0,
    rules: R,
    bill: S.bill,
    funding,
    services,
    netBudget,
    generalBudget,
    ctShare,
    grantsShare,
    ratesShare,
    ctShareGeneral,
    savingsThisYear,
    waterfall: { rows, gap: gapRow ? gapRow.f : fig(wf.gapM, "test", "prototype_test"), maxM: wf.maxM },
    savings: savingsModel(C.savings),
    balance: {
      input: {
        gapM: ny.gap_m,
        levers: ny.levers,
        toggles: ny.toggles,
        reserves: { general_m: ny.reserves.general.m, minimum_safe_m: ny.reserves.minimum_safe.m },
        referendumThresholdPct: limit.threshold_pct,
        toleranceM: tol,
      },
      levers: ny.levers,
      toggles: ny.toggles,
      pendingToggles: ny.pending_toggles.map((t) => t.label),
      gap,
      reservesGeneral,
      reservesMin,
      referendumLimit: limit.threshold_pct === null ? null : of(limit, limit.threshold_pct),
      referendumNote: limit.threshold_pct === null ? { text: limit.note ?? "", f: of(limit, 0) } : null,
      strip: (() => {
        const years = [ny.year, nextFinancialYear(ny.year), nextFinancialYear(nextFinancialYear(ny.year))];
        return years.map((y) => {
          const f = ny.forecast.find((x) => x.year === y);
          return { year: y, label: displayYear(y), gap: f ? of(f, f.gap_m) : null };
        });
      })(),
      ctAssumed: (() => {
        const ct = ny.levers.find((l) => l.id === "ct_rise");
        return ct?.assumed !== undefined ? of(ct, ct.assumed) : null;
      })(),
      revised: ny.revised
        ? { gap: of(ny.revised, ny.revised.gap_m), lastLabel: displayYear(ny.revised.last_year), last: of(ny.revised, ny.revised.last_gap_m), source: ny.revised.source_id }
        : null,
      computed,
      coef,
    },
    referendumLimitNow: of(limitNow, nonNull(limitNow.threshold_pct, `referendum threshold for ${C.meta.year}`)),
    politics: politicsOf(K),
    people: {
      councillors: K.councillors.map((c) => ({
        id: c.id,
        name: c.name,
        party: K.parties.find((x) => x.id === c.party)?.short ?? c.party_name,
        partyId: c.party,
        side: sideOf(K, c.party),
        wardId: c.ward_id,
        ward: K.wards.wards.find((w) => w.id === c.ward_id)?.name ?? c.ward_id,
        roles: c.roles.map((r) => r.title),
        democracy_url: c.democracy_url,
      })),
      wards: K.wards.wards.map((w) => ({ id: w.id, name: w.name, ons_code: w.ons_code, councillor_ids: w.councillor_ids })),
      retrievedOn: K.wards.sources[0]?.retrieved_on ?? "",
    },
    promises,
    payments: { ...latestQuarter(), months: PAY.months.length, suppliers: PAY.suppliers.count, firstMonth: PAY.months[0]!.month },
    // One entry per published page: several files can come from the same release.
    sources: [
      ...new Map(
        [
          ...DATA.sources.values(),
          ...K.parties.map((pt) => ({ id: `manifesto:${pt.id}`, title: pt.manifesto.title, publisher: pt.name, url: pt.manifesto.archive_url ?? pt.manifesto.url })),
          ...K.wards.sources.map((src, i) => ({ id: `content:${i}`, title: src.title, publisher: src.title.split(",")[0]!, url: src.url })),
        ]
          .filter((s): s is Source & { url: string } => !!s.url)
          .map((s) => [s.url, s]),
      ).values(),
    ],
    qualityLegend: {
      budget: S.budgetLegend,
      gap: C.gap_2026_27.filter(isGapValueLine).map((x) => ({ label: x.label, quality: x.quality })),
    },
  };
}
