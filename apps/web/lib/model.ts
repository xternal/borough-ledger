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
  type PaymentSeed,
  type PromiseSeed,
  type Quality,
  type Rules,
  type Saving,
  type Source,
  type Toggle,
} from "@borough-ledger/schema";
import { buildWaterfall, checkBudget, displayYear, nextFinancialYear, type BalanceInput } from "@borough-ledger/engine";
import { formatPeriod } from "./format";

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

export interface PromiseModel extends PromiseSeed {
  cost: { low: Figure; central: Figure; high: Figure; perBandD: Figure; share: Figure } | null;
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
    gap: Figure;
    reservesGeneral: Figure;
    reservesMin: Figure;
    /** Next year's referendum threshold; null when government sets no limit for this council. */
    referendumLimit: Figure | null;
    /** Why there is no limit, when there is none. */
    referendumNote: { text: string; f: Figure } | null;
    /** The council tax rise the gap forecast already assumes, if any. */
    ctAssumed: Figure | null;
    /** Quality and sources shared by every number the tool computes. */
    computed: Figure;
    coef: Record<LeverId, Figure>;
  };
  /** This year's referendum limit, for the rules in Method. */
  referendumLimitNow: Figure;
  politics: { control: string; seats: Figure; totalSeats: Figure };
  promises: PromiseModel[];
  payments: { rows: PaymentSeed[]; f: Figure; period: string; services: string[] };
  sources: Source[];
  qualityLegend: { budget: QualityItem[]; gap: QualityItem[] };
}

export interface QualityItem {
  label: string;
  quality: Quality;
}

const of = (x: { quality: Quality; source_id: string }, value: number) => fig(value, x.quality, x.source_id);

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

export function buildModel(): PageModel {
  const { council: C, rules: R, promises: P, payments: PAY } = DATA;
  const tol = R.balanced_budget.tolerance_m;

  const budget = checkBudget(C.funding, C.services, tol);
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
  const promises: PromiseModel[] = P.promises.map((p) => {
    if (!p.cost_m || !p.cost_quality || !p.cost_source_id) return { ...p, cost: null };
    const c = (v: number) => fig(v, p.cost_quality!, p.cost_source_id!);
    const central = c(p.cost_m[1]);
    return {
      ...p,
      cost: {
        low: c(p.cost_m[0]),
        central,
        high: c(p.cost_m[2]),
        perBandD: derive((central.value * 1e6) / taxBase.value, central, taxBase),
        share: derive(central.value / generalBudget.value, central, generalBudget),
      },
    };
  });

  /* payments */
  const dates = PAY.payments.map((p) => p.date).sort();
  const period = dates.length ? formatPeriod(dates[0]!, dates[dates.length - 1]!) : "";

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
    bill: {
      council,
      gla,
      total,
      risePct: derive((b.band_d_total / b.band_d_total_prev - 1) * 100, total, prev),
      councilShare: derive(b.band_d_council / b.band_d_total, council, total),
      ratios: of(R.band_ratios, 1),
      spd: of(R.single_person_discount, R.single_person_discount.value),
      instalments: { options: R.instalments.options, f: of(R.instalments, R.instalments.default) },
      glaNote: b.gla_note,
    },
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
      gap,
      reservesGeneral,
      reservesMin,
      referendumLimit: limit.threshold_pct === null ? null : of(limit, limit.threshold_pct),
      referendumNote: limit.threshold_pct === null ? { text: limit.note ?? "", f: of(limit, 0) } : null,
      ctAssumed: (() => {
        const ct = ny.levers.find((l) => l.id === "ct_rise");
        return ct?.assumed !== undefined ? of(ct, ct.assumed) : null;
      })(),
      computed,
      coef,
    },
    referendumLimitNow: of(limitNow, nonNull(limitNow.threshold_pct, `referendum threshold for ${C.meta.year}`)),
    politics: {
      control: C.politics.control,
      seats: of(C.politics, C.politics.seats[C.politics.control] ?? 0),
      totalSeats: of(C.politics, C.politics.total_seats),
    },
    promises,
    payments: {
      rows: [...PAY.payments].sort((a, z) => z.date.localeCompare(a.date)),
      f: of(PAY.meta, 0),
      period,
      services: [...new Set(PAY.payments.map((p) => p.service))].sort(),
    },
    // One entry per published page: several files can come from the same release.
    sources: [...new Map([...DATA.sources.values()].filter((s) => s.url).map((s) => [s.url, s])).values()],
    qualityLegend: {
      budget: [...C.funding, ...C.services].map((x) => ({ label: x.label, quality: x.quality })),
      gap: C.gap_2026_27.filter(isGapValueLine).map((x) => ({ label: x.label, quality: x.quality })),
    },
  };
}
