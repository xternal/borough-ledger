/* Make your case: what a resident needs to ask for a change and be heard. Who decides (the law, the government or the
   council), the council's own ways to take part and their deadlines, who leads on the subject for each side, and every
   ward's councillors for the letter. Built on the server from data/build/make_your_case.json and the page's model, and
   handed to the MakeYourCase component as plain data. One standard for every party (CLAUDE.md invariant 7): the
   administration's lead and each opposition party's spokesperson are offered side by side, and every choice of what to
   ask for gets the same treatment. */
import { DATA, MakeYourCaseFile, fig, worst, type CaseTopic, type Figure, type Quality } from "@borough-ledger/schema";
import { displayYear } from "@borough-ledger/engine";
import raw from "../../../data/build/make_your_case.json";
import type { CaseWant } from "@/components/MakeYourCase";
import { adultCare, careComparison, careResults, versusText } from "./adultCare";
import { optionName } from "./ctOptions";
import { format } from "./format";
import { listOf, type CaseDates, type LetterFact } from "./letter";
import type { PageModel } from "./model";
import { assertRenderable } from "./quality";

const FILE = MakeYourCaseFile.parse(raw);


export interface CaseSetup {
  topic: CaseTopic;
  subject: string;
  who: { who: "law" | "government" | "council"; text: string; where: string; sources: { title: string; url: string }[] }[];
  whoQuality: Quality;
  /** Who leads on the subject: the administration's councillor first, then each opposition party's. */
  responsible: { name: string; party: string; side: "administration" | "opposition"; role: string; url: string }[];
  wards: { id: string; name: string; ons_code: string; councillors: { name: string; party: string; url: string }[] }[];
  councilCode: string;
  dates: CaseDates;
  questions: { meeting: string; deadline: string; url: string }[];
  petitions: { threshold: number; leadsTo: string; url: string }[];
  deputation: { people: number; what: string; url: string };
  takePart: { title: string; url: string };
  takePartQuality: Quality;
  consultationUrl: string | null;
  foi: { label: string; title: string; text: string }[];
}

const SUBJECT: Record<CaseTopic, string> = {
  adult_care: "Care for adults",
  council_tax: "Council tax next year",
  budget: "Next year's budget",
  streets_waste: "Bins and streets",
  libraries_leisure: "Libraries, parks and leisure",
  housing: "Housing and homelessness",
};

/** Who leads on each subject, by the title the council gives their role. */
const ROLE: Record<CaseTopic, RegExp> = {
  adult_care: /social care/i,
  council_tax: /finance/i,
  budget: /finance/i,
  streets_waste: /^(Shadow )?Cabinet Member for the Environment, Arts and Culture$/,
  libraries_leisure: /^(Shadow )?Cabinet Member for the Environment, Arts and Culture$/,
  housing: /^(Shadow )?Cabinet Member for Housing and Homelessness$/,
};

/** Questions a resident might put under the Freedom of Information Act: facts the site does not have. */
const FOI: Record<CaseTopic, CaseSetup["foi"]> = {
  adult_care: [
    {
      label: "How long people wait for a care assessment",
      title: "Waiting times for adult social care assessments",
      text: "Please tell me, for each month from April 2025 to September 2026, how many adults were waiting for an assessment of their needs under section 9 of the Care Act 2014 on the last day of the month, and how long the longest of them had been waiting.",
    },
    {
      label: "What the council pays for care",
      title: "Rates paid for care homes and home care",
      text: "Please tell me the standard weekly rates the council pays for residential care and for nursing care for people aged 65 and over, and the standard hourly rate it pays home care agencies, for 2025/26 and 2026/27.",
    },
  ],
  council_tax: [
    {
      label: "How the three options were worked out",
      title: "Council tax options for 2027/28",
      text: "Please send me the calculations behind the three council tax options for 2027/28 in the report to Cabinet of 12 October 2026, including the tax base and collection rate assumed for each option.",
    },
  ],
  streets_waste: [
    {
      label: "Missed bin collections",
      title: "Missed household bin collections",
      text: "Please tell me, for each month from April 2025 to September 2026, how many missed household bin collections were reported to the council, and how many of them were collected within two working days.",
    },
    {
      label: "What parking brings in, and where it goes",
      title: "Parking income and how it is spent",
      text: "Please tell me the council's income from parking charges and from parking fines in 2024/25 and 2025/26, and what any surplus was spent on.",
    },
  ],
  libraries_leisure: [
    {
      label: "Library opening hours and visits",
      title: "Library opening hours and visits",
      text: "Please tell me, for each library the council runs, its weekly opening hours and its number of visits in 2019/20 and in 2025/26.",
    },
  ],
  housing: [
    {
      label: "Families in temporary accommodation",
      title: "Households in temporary accommodation",
      text: "Please tell me, for the last day of each quarter from April 2024 to September 2026, how many households the council had in temporary accommodation, how many of them were in bed and breakfast, and how many were placed outside the borough.",
    },
  ],
  budget: [
    {
      label: "The savings being considered",
      title: "Savings and investment proposals for 2027/28",
      text: "Please send me the list of savings and investment proposals for 2027/28 considered by Cabinet or its committees, with the amount and the service for each.",
    },
  ],
};

export function caseSetup(topic: CaseTopic, m: PageModel): CaseSetup {
  const source = (id: string) => {
    const s = FILE.sources.find((x) => x.id === id);
    if (!s?.url) throw new Error(`make your case: source ${id} has no link`);
    return { title: s.title, url: s.url };
  };
  const rows = FILE.topics[topic] ?? [];
  const lead = m.people.councillors.filter((c) => c.roles.some((r) => ROLE[topic].test(r)));
  const responsible = [...lead.filter((c) => c.side === "administration"), ...lead.filter((c) => c.side === "opposition")].map((c) => ({
    name: c.name,
    party: c.party,
    side: c.side,
    role: c.roles.find((r) => ROLE[topic].test(r))!,
    url: c.democracy_url,
  }));
  if (!responsible.some((r) => r.side === "administration")) throw new Error(`make your case ${topic}: no councillor leads on it for the administration`);
  const byId = new Map(m.people.councillors.map((c) => [c.id, c]));
  const tt = m.ctOptions?.timetable ?? [];
  const engagement = tt.find((t) => t.id === "engagement");
  const decision = tt.find((t) => t.id === "council_budget");
  const tp = FILE.take_part;
  return {
    topic,
    subject: SUBJECT[topic],
    who: rows.map((r) => ({ who: r.who, text: r.text, where: r.where, sources: r.source_ids.map(source) })),
    whoQuality: worst(...rows.map((r) => r.quality)),
    responsible,
    wards: m.people.wards.map((w) => ({
      id: w.id,
      name: w.name,
      ons_code: w.ons_code,
      councillors: w.councillor_ids.flatMap((id) => {
        const c = byId.get(id);
        return c ? [{ name: c.name, party: c.party, url: c.democracy_url }] : [];
      }),
    })),
    councilCode: DATA.council.meta.council_code,
    dates: {
      engagement: engagement ? { start: engagement.start, end: engagement.end ?? null } : null,
      decision: decision ? { date: decision.start, proposed: decision.proposed } : null,
      yearLabel: m.place.nextYearLabel,
    },
    questions: tp.questions.map((q) => ({ meeting: q.meeting, deadline: q.deadline, url: q.url })),
    petitions: tp.petitions.map((p) => ({ threshold: p.threshold, leadsTo: p.leads_to, url: p.url })),
    deputation: tp.deputation,
    takePart: source(tp.questions[0]!.source_id),
    takePartQuality: worst(...tp.questions.map((q) => q.quality), ...tp.petitions.map((p) => p.quality), tp.deputation.quality),
    consultationUrl: engagement?.url ?? null,
    foi: FOI[topic],
  };
}

const ORD = new Intl.PluralRules("en-GB", { type: "ordinal" });
const SUFFIX: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };
/** 1st, 2nd, 3rd, 13th. */
export const ordinal = (n: number) => `${n}${SUFFIX[ORD.select(n)]}`;

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Care for adults: what to ask for, and the government's own figures to back it. */
export function adultCareCase(m: PageModel, ons: string): { setup: CaseSetup; wants: CaseWant[]; facts: LetterFact[] } | null {
  const care = adultCare(ons);
  const cmp = careComparison(ons);
  if (!care || !cmp) return null;
  const src = `the government's adult social care finance report for ${care.yearLabel}, ${care.source.url}`;
  for (const f of [care.total, ...cmp.units.map((u) => u.f)]) assertRenderable(f.quality, "make your case: care figures");
  const free = FILE.topics.adult_care?.find((r) => r.source_ids.includes("lbhf_free_home_care_2024-10-17"));
  const freeSrc = FILE.sources.find((s) => s.id === "lbhf_free_home_care_2024-10-17");
  const facts: LetterFact[] = [
    {
      id: "total",
      label: `What it spent: ${format("m1", care.total.value)} in ${care.yearLabel}`,
      text: `The council spent ${format("m1", care.total.value)} on care for adults in ${care.yearLabel}, before what people pay towards their own care and money from the NHS.`,
      source: src,
      on: true,
    },
    ...cmp.units.map((u, i) => {
      const money = format(u.per === "week" ? "gbp0" : "gbp2", u.f.value);
      return {
        id: u.id,
        label: `${u.label}: ${money}, the ${ordinal(u.rank)} lowest of ${u.of} ${cmp.group}`,
        text: `${u.per === "week" ? "A week in a care home for someone aged 65 or over" : "An hour of care at home"} costs the council ${money}, the ${ordinal(u.rank)} lowest of the ${u.of} ${cmp.group} we compared; the one in the middle pays ${format(u.per === "week" ? "gbp0" : "gbp2", u.median.value)}.`,
        source: src,
        on: i === 0,
      };
    }),
    {
      id: "age",
      label: `Older people ${format("m1", cmp.byAge.older.value)}, working-age adults ${format("m1", cmp.byAge.workingAge.value)}`,
      text: `Long-term care cost ${format("m1", cmp.byAge.older.value)} for people aged 65 and over and ${format("m1", cmp.byAge.workingAge.value)} for adults aged 18 to 64 in ${care.yearLabel}.`,
      source: src,
      on: false,
    },
    ...(() => {
      const r = careResults(ons);
      const sat = r?.items.find((i) => i.id === "satisfied");
      if (!r || !sat) return [];
      assertRenderable(sat.f.quality, "make your case: care survey");
      const pct = (x: number) => `${Math.round(x * 100)}%`;
      return [
        {
          id: "satisfied",
          label: `${pct(sat.f.value)} of people who get care are extremely or very satisfied with it (${versusText(sat)})`,
          text: `In the government's ${r.yearLabel} survey, ${pct(sat.f.value)} of people who get care from the council ${sat.label}, give or take ${Math.round(sat.moe)} points${sat.london ? `; ${pct(sat.london.f.value)} across London` : ""} and ${pct(sat.england.f.value)} across England.`,
          source: `the government's adult social care outcomes framework for ${r.yearLabel}, ${r.source.url}`,
          on: false,
        },
      ];
    })(),
    ...(free && freeSrc?.url
      ? [{ id: "free", label: "No charge for care at home since 2015", text: free.text, source: `the council's report to Full Council of 17 October 2024, ${freeSrc.url}`, on: false }]
      : []),
  ];
  const wants: CaseWant[] = [
    { id: "more", label: "Spend more", sentence: "I would like the council to spend more on care for adults, and to say how it would pay for it." },
    { id: "less", label: "Spend less", sentence: "I would like the council to spend less on care for adults, and to say what that would mean for the people who rely on it." },
    { id: "differently", label: "Spend it differently", sentence: "I would like the council to change how it spends the money for care for adults." },
    { id: "ask", label: "Ask a question", sentence: "I have a question about the council's care for adults." },
  ];
  return { setup: caseSetup("adult_care", m), wants, facts };
}

/** Council tax next year: each of the council's options, or another rise, with the council's own figures. */
export function councilTaxCase(m: PageModel): { setup: CaseSetup; wants: CaseWant[]; facts: LetterFact[] } | null {
  const ct = m.ctOptions;
  if (!ct) return null;
  for (const o of ct.options) assertRenderable(o.total.quality, "make your case: council tax options");
  const report = ct.timetable.find((t) => t.id === "cabinet_mtfs");
  const src = `the council's report to Cabinet of 12 October 2026${report?.url ? `, ${report.url}` : ""}`;
  const names = (f: (o: NonNullable<PageModel["ctOptions"]>["options"][number]) => string) => listOf(ct.options.map(f)).replace(/ and ([^ ]+)$/, " or $1");
  const facts: LetterFact[] = [
    {
      id: "options",
      label: `At Band D: ${format("gbp2", m.bill.total.value)} now, ${names((o) => format("gbp2", o.total.value))} next year`,
      text: `At Band D, this year's whole bill of ${format("gbp2", m.bill.total.value)} would become ${listOf(ct.options.map((o) => `${format("gbp2", o.total.value)} (${optionName(o.pct)})`)).replace(/ and (?=[^,]*$)/, " or ")} in ${m.place.nextYearLabel}.`,
      source: src,
      on: true,
    },
    ...(ct.funding
      ? [
          {
            id: "funding",
            label: `Government funding: ${format("m1", ct.funding.from.value)} to ${format("m1", ct.funding.to.value)}`,
            text: `The government's funding for the council falls from ${format("m1", ct.funding.from.value)} in ${ct.funding.fromLabel} to ${format("m1", ct.funding.to.value)} in ${ct.funding.toLabel}.`,
            source: src,
            on: true,
          },
        ]
      : []),
    {
      id: "shortfall",
      label: `Still to find by ${ct.gap2030?.label ?? "2030/31"} under each option`,
      text: `Each option leaves a different amount still to find by ${ct.gap2030?.label ?? "2030/31"}: ${listOf(ct.options.map((o) => `${o.shortfall.value > 0 ? format("m1", o.shortfall.value) : "nothing"} with ${optionName(o.pct)}`))}.`,
      source: src,
      on: false,
    },
  ];
  const wants: CaseWant[] = [
    ...ct.options.map((o) => ({
      id: `opt-${o.pct}`,
      label: optionName(o.pct),
      sentence: `Of the council's three council tax options for ${m.place.nextYearLabel}, I would prefer ${optionName(o.pct)}: its own share of the bill up ${o.pct}%.`,
    })),
    {
      id: "other",
      label: "A different rise",
      sentence: `I would prefer a council tax rise for ${m.place.nextYearLabel} different from any of the council's three options.`,
    },
    { id: "ask", label: "Ask a question", sentence: `I have a question about council tax for ${m.place.nextYearLabel}.` },
  ];
  return { setup: caseSetup("council_tax", m), wants, facts };
}

/** Next year's budget, from Balance it: the reader's own choices are the figures (BalanceIt adds them). */
export function budgetWants(m: PageModel): CaseWant[] {
  return [
    { id: "mine", label: "Here is my budget", sentence: `Here is how I would balance the council's ${m.place.nextYearLabel} budget, using the Balance it tool on Borough Book.` },
    { id: "ask", label: "Ask a question", sentence: `I have a question about the council's ${m.place.nextYearLabel} budget.` },
  ];
}


/** What residents call each service in a sentence: "spend more on bin collections and streets". */
const PHRASE: Partial<Record<CaseTopic, string>> = {
  streets_waste: "bin collections and streets",
  libraries_leisure: "libraries, parks and leisure",
  housing: "housing and helping homeless people",
};

export interface ServiceComparison {
  label: string;
  yearLabel: string;
  m: Figure;
  /** Share of the money the council pays for itself, as a fraction. */
  f: Figure;
  /** 1 is the smallest share among `of` London boroughs. */
  rank: number;
  of: number;
  median: Figure;
  low: { name: string; f: Figure };
  high: { name: string; f: Figure };
}

/** How much of the money a London borough pays for itself goes on one everyday service, beside every other London borough
    on the site (etl/make_your_case.py). A share, so councils of different sizes compare without population figures. */
export function serviceComparison(topic: CaseTopic, ons: string): ServiceComparison | null {
  const c = FILE.compare[topic];
  if (!c) return null;
  const f = (v: number) => fig(v, c.quality, c.source_id);
  const rows = [...c.councils].sort((a, z) => a.share - z.share);
  const rank = rows.findIndex((r) => r.council_code === ons) + 1;
  if (!rank) return null;
  const mid = rows.length % 2 ? rows[(rows.length - 1) / 2]!.share : (rows[rows.length / 2 - 1]!.share + rows[rows.length / 2]!.share) / 2;
  const me = rows[rank - 1]!;
  return {
    label: c.label,
    yearLabel: displayYear(c.year),
    m: f(me.m),
    f: f(me.share),
    rank,
    of: rows.length,
    median: f(mid),
    low: { name: rows[0]!.name, f: f(rows[0]!.share) },
    high: { name: rows[rows.length - 1]!.name, f: f(rows[rows.length - 1]!.share) },
  };
}

/** "the 7th smallest share of 28", or "the 4th largest". */
export const placeOf = (rank: number, of: number) => (rank > of / 2 ? `the ${ordinal(of - rank + 1)} largest share of ${of}` : `the ${ordinal(rank)} smallest share of ${of}`);
const pence = (share: number) => `${share < 0 ? "−" : ""}${Math.abs(Math.round(share * 100))}p`;
export { pence };

/** An everyday service: who decides, how the council's priorities compare, and a letter. */
export function serviceCase(m: PageModel, topic: "streets_waste" | "libraries_leisure" | "housing", ons: string): { setup: CaseSetup; wants: CaseWant[]; facts: LetterFact[]; cmp: ServiceComparison } | null {
  const cmp = serviceComparison(topic, ons);
  if (!cmp) return null;
  assertRenderable(cmp.f.quality, "make your case: service comparison");
  const ra = FILE.sources.find((x) => x.id === "ra_2026-27");
  const src = `the council's budget return to government for ${cmp.yearLabel}${ra?.url ? `, ${ra.url}` : ""}`;
  const phrase = PHRASE[topic]!;
  const facts: LetterFact[] = [
    {
      id: "spend",
      label: `What it costs the council: ${format("m1", cmp.m.value)} in ${cmp.yearLabel}`,
      text: `${cmp.label} costs the council ${format("m1", cmp.m.value)} in ${cmp.yearLabel}, after fees and charges${topic === "streets_waste" ? " such as parking" : ""} and after grants tied to it.`,
      source: src,
      on: true,
    },
    {
      id: "share",
      label: `${pence(cmp.f.value)} of every £1 the council pays for itself; the middle London borough ${pence(cmp.median.value)}`,
      text: `That is ${pence(cmp.f.value)} of every £1 the council pays for itself, ${placeOf(cmp.rank, cmp.of)} London boroughs we compared; the borough in the middle puts ${pence(cmp.median.value)}.`,
      source: src,
      on: true,
    },
  ];
  const wants: CaseWant[] = [
    { id: "more", label: "Spend more", sentence: `I would like the council to spend more on ${phrase}, and to say how it would pay for it.` },
    { id: "less", label: "Spend less", sentence: `I would like the council to spend less on ${phrase}, and to say what that would mean for the people who rely on it.` },
    { id: "differently", label: "Spend it differently", sentence: `I would like the council to change how it spends the money for ${phrase}.` },
    { id: "ask", label: "Ask a question", sentence: `I have a question about the council's spending on ${phrase}.` },
  ];
  return { setup: caseSetup(topic, m), wants, facts, cmp };
}
