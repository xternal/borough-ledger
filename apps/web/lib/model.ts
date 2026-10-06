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
}

export interface WaterfallRowModel {
  label: string;
  kind: GapLine["kind"];
  f: Figure;
  from: number;
  to: number;
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
  ctShare: Figure;
  /** The two largest funding lines after council tax, when together they cover most of the rest. */
  mainOtherFunding: [string, string] | null;
  savingsThisYear: Figure;
  waterfall: { rows: WaterfallRowModel[]; gap: Figure; maxM: number };
  balance: {
    input: BalanceInput;
    levers: Lever[];
    toggles: Toggle[];
    gap: Figure;
    reservesGeneral: Figure;
    reservesMin: Figure;
    /** Next year's limit, used by the tool. */
    referendumLimit: Figure;
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
  const funding: FlowLine[] = C.funding.map((x) => ({ id: x.id, label: x.label, f: of(x, x.m), gap: !!x.gap }));
  const services: FlowLine[] = C.services.map((x) => ({ id: x.id, label: x.label, f: of(x, x.m), gap: false, desc: x.desc }));
  const [f0, ...fRest] = funding.map((x) => x.f);
  const netBudget = derive(budget.fundingM, f0!, ...fRest);
  const ct = funding.find((x) => x.id === "council_tax");
  if (!ct) throw new Error("funding has no council_tax line");
  const ctShare = derive(ct.f.value / netBudget.value, ct.f, netBudget);

  const others = funding.filter((x) => x.id !== "council_tax" && !x.gap).sort((a, z) => z.f.value - a.f.value);
  const rest = netBudget.value - ct.f.value;
  const top2 = others.slice(0, 2);
  const mainOtherFunding =
    top2.length === 2 && top2[0]!.f.value + top2[1]!.f.value > rest / 2 ? ([top2[0]!.label, top2[1]!.label] as [string, string]) : null;

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
  const reservesGeneral = of(ny.reserves, ny.reserves.general_m);
  const reservesMin = of(ny.reserves, ny.reserves.minimum_safe_m);
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
        share: derive(central.value / netBudget.value, central, netBudget),
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
    ctShare,
    mainOtherFunding,
    savingsThisYear,
    waterfall: { rows, gap: gapRow ? gapRow.f : fig(wf.gapM, "test", "prototype_test"), maxM: wf.maxM },
    balance: {
      input: {
        gapM: ny.gap_m,
        levers: ny.levers,
        toggles: ny.toggles,
        reserves: { general_m: ny.reserves.general_m, minimum_safe_m: ny.reserves.minimum_safe_m },
        referendumLimitPct: limit.value,
        toleranceM: tol,
      },
      levers: ny.levers,
      toggles: ny.toggles,
      gap,
      reservesGeneral,
      reservesMin,
      referendumLimit: of(limit, limit.value),
      computed,
      coef,
    },
    referendumLimitNow: of(limitNow, limitNow.value),
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
    sources: [...DATA.sources.values()].filter((s) => s.url),
    qualityLegend: {
      budget: [...C.funding, ...C.services].map((x) => ({ label: x.label, quality: x.quality })),
      gap: C.gap_2026_27.filter(isGapValueLine).map((x) => ({ label: x.label, quality: x.quality })),
    },
  };
}
