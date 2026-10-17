import { describe, expect, it } from "vitest";
import { careComparison } from "@/lib/adultCare";
import { FOI_BODY } from "@/lib/caseLinks";
import { MIN_OWN, closingLine, draftLetter, foiHref, londonNoon, mailtoHref, nextQuestion } from "@/lib/letter";
import { adultCareCase, budgetWants, caseSetup, councilTaxCase, ordinal } from "@/lib/makeYourCase";
import { buildModel } from "@/lib/model";

const m = buildModel();
const HF = "E09000013";

describe("make your case: the letter", () => {
  const dates = {
    engagement: { start: "2026-10-19", end: "2026-11-15" },
    decision: { date: "2027-03-01", proposed: true },
    yearLabel: "2027/28",
  };

  it("is addressed to the reader's councillors, keeps their words, and lists each source once", () => {
    const { subject, body } = draftLetter({
      to: ["Molly Mantle", "Callum Nimmo"],
      ward: "Hammersmith Broadway",
      subject: "Care for adults",
      want: "I would like the council to spend more on care for adults, and to say how it would pay for it.",
      own: "  My father lives alone and the visits let him stay at home.  ",
      facts: [
        { text: "Fact one.", source: "the report, https://example.gov.uk/a" },
        { text: "Fact two.", source: "the report, https://example.gov.uk/a" },
      ],
      closing: closingLine(dates, "2026-10-11"),
      page: "https://boroughbook.uk/budget#case-care",
    });
    expect(subject).toBe("Care for adults: a resident's view");
    expect(body.startsWith("Dear Councillor Molly Mantle and Councillor Callum Nimmo,\n\nI live in Hammersmith Broadway ward. I would like")).toBe(true);
    expect(body).toContain("\n\nMy father lives alone and the visits let him stay at home.\n\n");
    expect(body.match(/https:\/\/example\.gov\.uk\/a/g)).toHaveLength(1);
    expect(body).toContain("- Fact one.\n- Fact two.");
    expect(body.endsWith("Yours sincerely,")).toBe(true);
    expect(MIN_OWN).toBeGreaterThanOrEqual(20);
  });

  it("says what is open on the day it is written", () => {
    expect(closingLine(dates, "2026-10-11")).toBe(
      "The council asks residents for their views on the 2027/28 budget from 19 October to 15 November, and Full Council sets the budget on 1 March 2027 (a proposed date).",
    );
    expect(closingLine(dates, "2026-11-01")).toBe(
      "The council is asking residents for their views on the 2027/28 budget until 15 November, and Full Council sets the budget on 1 March 2027 (a proposed date).",
    );
    expect(closingLine(dates, "2026-12-01")).toBe("Full Council sets the budget on 1 March 2027 (a proposed date).");
    expect(closingLine(dates, "2027-04-01")).toMatch(/take residents' views into account/);
  });

  it("closes Full Council questions at 12 noon London time, either side of the clocks changing", () => {
    expect(londonNoon("2026-10-09").toISOString()).toBe("2026-10-09T11:00:00.000Z"); // summer time
    expect(londonNoon("2027-01-15").toISOString()).toBe("2027-01-15T12:00:00.000Z"); // winter
    const qs = [
      { deadline: "2026-10-09T12:00", meeting: "2026-10-21" },
      { deadline: "2027-01-15T12:00", meeting: "2027-01-27" },
      { deadline: "2027-02-12T12:00", meeting: "2027-02-24" },
    ];
    expect(nextQuestion(qs, new Date("2026-10-11T09:00:00Z"))?.meeting).toBe("2027-01-27");
    expect(nextQuestion(qs, new Date("2027-01-15T11:59:00Z"))?.meeting).toBe("2027-01-27");
    expect(nextQuestion(qs, new Date("2027-01-15T12:01:00Z"))?.meeting).toBe("2027-02-24");
    expect(nextQuestion(qs, new Date("2027-03-01T00:00:00Z"))).toBeNull();
  });

  it("hands the reader on without putting anything they typed in a link we make", () => {
    const foi = foiHref(FOI_BODY, "Waiting times", "Please tell me how many adults were waiting.");
    expect(foi.startsWith("https://www.whatdotheyknow.com/new/hammersmith_and_fulham_borough_council?title=Waiting+times&default_letter=")).toBe(true);
    // The email link carries the letter to the reader's own email app, with no address of ours or anyone's.
    expect(mailtoHref("S", "B")).toBe("mailto:?subject=S&body=B");
  });
});

describe("make your case: the same for every side", () => {
  it("offers the councillor who leads on it for the administration first, then the opposition's", () => {
    const leads = (t: "adult_care" | "council_tax" | "budget") => caseSetup(t, m).responsible.map((r) => [r.name, r.side]);
    expect(leads("adult_care")).toEqual([
      ["Alex Sanderson", "administration"],
      ["Aliya Afzal-Khan", "opposition"],
    ]);
    expect(leads("budget")).toEqual([
      ["Rowan Ree", "administration"],
      ["Liam Downer-Sanderson", "opposition"],
    ]);
  });

  it("says what the law, the government and the council each decide, each with a link to check", () => {
    for (const t of ["adult_care", "council_tax", "budget"] as const) {
      const s = caseSetup(t, m);
      expect(new Set(s.who.map((w) => w.who))).toEqual(new Set(["law", "government", "council"]));
      expect(s.who.every((w) => w.sources.length > 0 && w.sources.every((x) => x.url.startsWith("https://")))).toBe(true);
      expect(s.wards.length).toBe(m.people.wards.length);
      expect(s.wards.every((w) => w.councillors.length > 0)).toBe(true);
    }
  });

  it("lets the reader ask for any of the options, or something else, on the same terms", () => {
    const tax = councilTaxCase(m)!;
    expect(tax.wants.map((w) => w.label)).toEqual([...m.ctOptions!.options.map((o) => `+${o.pct}%`), "A different rise", "Ask a question"]);
    const care = adultCareCase(m, HF)!;
    expect(care.wants.map((w) => w.id)).toEqual(["more", "less", "differently", "ask"]);
    expect(care.wants.find((w) => w.id === "more")!.sentence).toMatch(/how it would pay for it/);
    expect(care.wants.find((w) => w.id === "less")!.sentence).toMatch(/what that would mean for the people who rely on it/);
    expect(budgetWants(m).map((w) => w.id)).toEqual(["mine", "ask"]);
  });
});

describe("make your case: how care compares", () => {
  it("ranks Hammersmith & Fulham's costs among London boroughs, from the government's own averages", () => {
    const c = careComparison(HF)!;
    expect(c.group).toBe("London boroughs");
    const home = c.units.find((u) => u.id === "residential_65")!;
    expect([home.f.value, home.rank, home.of, home.low.name, home.high.name]).toEqual([1123.84, 13, 28, "Bromley", "Hounslow"]);
    expect(c.units.find((u) => u.id === "home_care_hour")!.rank).toBe(6);
    expect([c.byAge.older.value, c.byAge.workingAge.value].map((v) => Math.round(v * 10) / 10)).toEqual([41.1, 34.6]);
    expect(c.moreForWorkingAge).toEqual({ count: 23, of: 35 });
    expect(ordinal(13)).toBe("13th");
    expect([1, 2, 3, 11, 22].map(ordinal)).toEqual(["1st", "2nd", "3rd", "11th", "22nd"]);
  });

  it("puts figures in the letter only with their source", () => {
    const care = adultCareCase(m, HF)!;
    expect(care.facts.every((f) => /https:\/\//.test(f.source))).toBe(true);
    expect(care.facts.find((f) => f.id === "residential_65")!.text).toMatch(/^A week in a care home for someone aged 65 or over costs the council £1,124, the 13th lowest of the 28 London boroughs/);
  });
});

describe("make your case: everyday services", () => {
  it("offers both sides' leads for bins and streets, libraries and leisure, and housing", async () => {
    const { serviceCase } = await import("@/lib/makeYourCase");
    const leads = (t: "streets_waste" | "libraries_leisure" | "housing") => serviceCase(m, t, HF)!.setup.responsible.map((r) => r.side);
    for (const t of ["streets_waste", "libraries_leisure", "housing"] as const) expect(leads(t)).toEqual(["administration", "opposition"]);
    for (const t of ["streets_waste", "libraries_leisure", "housing"] as const) {
      const s = caseSetup(t, m);
      expect(new Set(s.who.map((w) => w.who))).toEqual(new Set(["law", "government", "council"]));
      expect(s.who.every((w) => w.sources.every((x) => x.url.startsWith("https://www.legislation.gov.uk/") || x.url.startsWith("https://")))).toBe(true);
      expect(s.foi.length).toBeGreaterThan(0);
    }
  });

  it("compares how much of its own money each London borough puts into a service, without population figures", async () => {
    const { serviceComparison, placeOf, pence } = await import("@/lib/makeYourCase");
    const streets = serviceComparison("streets_waste", HF)!;
    expect([pence(streets.f.value), streets.rank, streets.of, pence(streets.median.value)]).toEqual(["3p", 7, 28, "7p"]);
    expect(streets.low.f.value).toBeLessThan(0); // a council that collects more than it spends on its streets
    const housing = serviceComparison("housing", HF)!;
    expect([pence(housing.f.value), placeOf(housing.rank, housing.of), pence(housing.median.value)]).toEqual(["17p", "the 4th largest share of 28", "10p"]);
    expect(pence(-0.0175)).toBe("−2p");
    expect(serviceComparison("streets_waste", "E06000030")).toBeNull(); // Swindon: London boroughs only, for now
  });

  it("offers every choice on the same terms for each service", async () => {
    const { serviceCase } = await import("@/lib/makeYourCase");
    const c = serviceCase(m, "libraries_leisure", HF)!;
    expect(c.wants.map((w) => w.id)).toEqual(["more", "less", "differently", "ask"]);
    expect(c.facts.map((f) => f.id)).toEqual(["spend", "share"]);
    expect(c.facts.every((f) => /https:\/\//.test(f.source))).toBe(true);
  });
});
