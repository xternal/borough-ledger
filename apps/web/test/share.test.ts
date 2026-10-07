import { describe, expect, it } from "vitest";
import { decodeScenario, defaultScenario } from "@borough-ledger/engine";
import { buildModel } from "@/lib/model";
import { shareSummary } from "@/lib/shareText";

describe("balance-it strip and share text", () => {
  const m = buildModel();

  it("covers three years and marks the one the council does not forecast", () => {
    expect(m.balance.strip.map((y) => [y.label, y.gap?.value ?? null])).toEqual([
      ["2027/28", 31.4],
      ["2028/29", 57.3],
      ["2029/30", null],
    ]);
  });

  it("describes the council's own forecast when nothing is changed", () => {
    const s = shareSummary(m, defaultScenario(m.balance.input));
    expect(s.status).toBe("£31.4m still to find");
    expect(s.choices).toEqual(["The council's own forecast: £31.4m gap"]);
    expect(s.later).toBe("2028/29: £57.3m still to find if nothing else changes");
  });

  it("lists the choices and shows reserves coming back the year after", () => {
    const s = shareSummary(m, decodeScenario(m.balance.input, "ct:5.99,sv:10,rs:5,on:extra_officers"));
    expect(s.choices).toEqual(["Council tax up 5.99% (forecast 4.99%)", "£10.0m more savings", "£5.0m from reserves, once", "Add 20 law enforcement officers"]);
    expect(s.later).toMatch(/including £5\.0m of reserves coming back$/);
    expect(s.quality).toBe("modelled"); // the officers' cost is modelled from the budget report
  });
});
