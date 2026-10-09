import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { type Db, testDb } from "../src/db";
import type { MailMessage, Mailer } from "../src/mail";
import { confirmEmailFollow, requestEmailFollow, runAlerts, type AlertItem, type FollowContext, type Target } from "../src/follow";

const config = loadConfig({ MAIL_PROVIDER: "outbox", NEXT_PUBLIC_SITE_URL: "https://borough.test" });
const T0 = new Date("2026-10-09T09:00:00Z");
const DAY = 86_400_000;
const at = (days: number) => new Date(T0.getTime() + days * DAY);

const item = (promiseId: string, n: number): AlertItem => ({
  guid: `tag:borough.test,2026:promise/${promiseId}/event/${n}`,
  promiseId,
  title: `Change ${n} to ${promiseId}`,
  path: `/promise/${promiseId}`,
  description: `What happened, number ${n}.`,
});

let db: Db;
let sent: MailMessage[];
let failNext = 0;
const mail: Mailer = {
  async send(m) {
    if (failNext > 0) {
      failNext--;
      throw new Error("Resend refused the message: HTTP 500");
    }
    sent.push(m);
  },
};
const ctx = (now: Date): FollowContext => ({ db, config, mail, now });

async function follower(email: string, targets: Target[]) {
  const box: MailMessage[] = [];
  const c: FollowContext = { db, config, now: T0, mail: { send: async (m) => void box.push(m) } };
  await requestEmailFollow(c, { email, targets });
  const token = /\/follow\/confirm\?t=([A-Za-z0-9_-]+)/.exec(box[0]!.text)![1];
  const res = await confirmEmailFollow(c, token);
  if (!res.ok) throw new Error("confirm failed");
}

beforeEach(async () => {
  db = await testDb();
  sent = [];
  failNext = 0;
});
afterEach(async () => {
  await db.close();
});

describe("daily pledge alerts", () => {
  it("remembers everything on the first run and sends nothing, then sends only what is new", async () => {
    await follower("a@example.org", [{ kind: "promise", id: "p1" }]);
    const history = [item("p1", 0), item("p1", 1), item("p2", 0)];
    expect(await runAlerts(ctx(at(1)), history, { pauseMs: 0 })).toEqual({ seeded: 3, fresh: 0, sent: 0, failed: 0 });
    expect(sent).toHaveLength(0);
    expect(await runAlerts(ctx(at(2)), history, { pauseMs: 0 })).toEqual({ seeded: 0, fresh: 0, sent: 0, failed: 0 });

    const next = [...history, item("p1", 2), item("p2", 1)];
    expect(await runAlerts(ctx(at(3)), next, { pauseMs: 0 })).toEqual({ seeded: 0, fresh: 2, sent: 1, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("a@example.org");
    expect(sent[0]!.subject).toBe("Pledge update: Change 2 to p1");
    expect(sent[0]!.text).toContain("What happened, number 2.\nhttps://borough.test/promise/p1");
    expect(sent[0]!.text).not.toContain("p2");
    expect(sent[0]!.unsubscribeUrl).toMatch(/^https:\/\/borough\.test\/api\/follow\/unsubscribe\?t=/);

    // Nothing is sent twice.
    expect(await runAlerts(ctx(at(4)), next, { pauseMs: 0 })).toEqual({ seeded: 0, fresh: 0, sent: 0, failed: 0 });
    expect(sent).toHaveLength(1);
  });

  it("sends every pledge to those who follow them all, in one email", async () => {
    await follower("all@example.org", [{ kind: "all", id: "*" }]);
    await runAlerts(ctx(at(1)), [item("p1", 0)], { pauseMs: 0 });
    await runAlerts(ctx(at(2)), [item("p1", 0), item("p1", 1), item("p2", 0)], { pauseMs: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe("2 pledge updates on Borough Book");
    expect(sent[0]!.text).toContain("Change 1 to p1");
    expect(sent[0]!.text).toContain("Change 0 to p2");
  });

  it("tries a failed email again on the next run, without resending to anyone who had it", async () => {
    await follower("a@example.org", [{ kind: "all", id: "*" }]);
    await follower("b@example.org", [{ kind: "all", id: "*" }]);
    await runAlerts(ctx(at(1)), [item("p1", 0)], { pauseMs: 0 });
    failNext = 1;
    const items = [item("p1", 0), item("p1", 1)];
    expect(await runAlerts(ctx(at(2)), items, { pauseMs: 0 })).toMatchObject({ sent: 1, failed: 1 });
    expect(await runAlerts(ctx(at(3)), items, { pauseMs: 0 })).toMatchObject({ sent: 1, failed: 0 });
    expect(sent.map((m) => m.to).sort()).toEqual(["a@example.org", "b@example.org"]);
    expect(await runAlerts(ctx(at(4)), items, { pauseMs: 0 })).toMatchObject({ sent: 0, failed: 0 });
  });

  it("skips unconfirmed sign-ups and items that have gone from the feeds", async () => {
    const box: MailMessage[] = [];
    await requestEmailFollow({ db, config, now: T0, mail: { send: async (m) => void box.push(m) } }, { email: "u@example.org", targets: [{ kind: "all", id: "*" }] });
    await follower("a@example.org", [{ kind: "all", id: "*" }]);
    await runAlerts(ctx(at(0.5)), [item("p1", 0)], { pauseMs: 0 });
    await db.query("INSERT INTO alert_item (guid, promise_id, title, url) VALUES ('gone', 'p1', 't', '/x')");
    expect(await runAlerts(ctx(at(1)), [item("p1", 0), item("p1", 1)], { pauseMs: 0 })).toMatchObject({ sent: 1 });
    expect(sent.map((m) => m.to)).toEqual(["a@example.org"]);
    expect(sent[0]!.text).not.toContain("gone");
  });
});
