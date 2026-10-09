import { describe, expect, it } from "vitest";
import { emailEnabled } from "@borough-ledger/server";
import { alertItems, describeTarget, EMAIL_ALERTS, isKnownTarget, targetHref } from "@/lib/follow";
import { buildModel } from "@/lib/model";
import { promiseItems } from "@/lib/feeds";

describe("email alerts", () => {
  it("are off unless MAIL_PROVIDER switches them on", () => {
    expect(EMAIL_ALERTS).toBe(emailEnabled(process.env));
    expect(emailEnabled({})).toBe(false);
  });

  it("send exactly what the pledge feeds publish, under the same ids", () => {
    const m = buildModel();
    const items = alertItems();
    expect(items.length).toBe(m.promises.flatMap(promiseItems).length);
    expect(new Set(items.map((i) => i.guid)).size).toBe(items.length);
    for (const i of items) {
      expect(i.path).toBe(`/promise/${i.promiseId}`);
      expect(i.guid).toContain(`promise/${i.promiseId}/`);
    }
  });

  it("can follow only pledges on the site, by name", () => {
    const p = buildModel().promises[0]!;
    expect(isKnownTarget({ kind: "promise", id: p.id })).toBe(true);
    expect(isKnownTarget({ kind: "promise", id: "no-such-pledge" })).toBe(false);
    expect(isKnownTarget({ kind: "all", id: "*" })).toBe(true);
    expect(describeTarget({ kind: "promise", id: p.id })).toContain(p.partyShort);
    expect(targetHref({ kind: "promise", id: p.id })).toBe(`/promise/${p.id}`);
    expect(describeTarget({ kind: "all", id: "*" })).toBe("Every pledge on Borough Book");
  });
});
