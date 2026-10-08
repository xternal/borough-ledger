import { describe, expect, it } from "vitest";
import { DATA } from "@borough-ledger/schema";
import { meetingsOf } from "@/lib/decisions";
import { buildModel } from "@/lib/model";

describe("council decisions page", () => {
  const meetings = meetingsOf(buildModel());

  it("shows every decision once, grouped by meeting, newest meeting first", () => {
    expect(meetings.flatMap((m) => m.decisions).length).toBe(DATA.decisions.decisions.length);
    for (let i = 1; i < meetings.length; i++) expect(meetings[i - 1]!.date >= meetings[i]!.date).toBe(true);
  });

  it("shows a link to a pledge only when it is confirmed in content/decision_links.yaml", () => {
    const shown = meetings.flatMap((m) => m.decisions.flatMap((d) => d.links.map((l) => `${d.id}:${l.promise.id}`)));
    expect(shown.sort()).toEqual(DATA.content.decision_links.map((l) => `${l.decision_id}:${l.promise_id}`).sort());
  });
});
