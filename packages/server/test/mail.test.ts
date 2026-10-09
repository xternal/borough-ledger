import { createHmac, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { emailEnabled, loadConfig } from "../src/config";
import { type Db, testDb } from "../src/db";
import { lookupHash, normaliseEmail } from "../src/crypto";
import { mailerFor, resendMailer } from "../src/mail";
import { handleResendEvent, verifyResendSignature } from "../src/mail-events";

const prod = {
  MAIL_PROVIDER: "resend",
  NEXT_PUBLIC_SITE_URL: "https://boroughbook.example",
  DATABASE_URL: "postgres://x",
  BB_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  BB_LOOKUP_PEPPER: Buffer.alloc(32, 2).toString("base64"),
  ALTCHA_HMAC_KEY: "k",
  FOLLOW_CONTROLLER: "Example Person",
  MAIL_FROM: "Borough Book <alerts@boroughbook.example>",
  RESEND_API_KEY: "re_test",
  CRON_SECRET: "c".repeat(32),
};

describe("configuration", () => {
  it("is off unless MAIL_PROVIDER says otherwise, and then needs nothing", () => {
    expect(emailEnabled({})).toBe(false);
    expect(emailEnabled({ MAIL_PROVIDER: "ses" })).toBe(false);
    expect(loadConfig({}).mail.provider).toBe("off");
    expect(loadConfig({ VERCEL_ENV: "production" }).production).toBe(false);
  });

  it("needs every secret, by name, to send real email", () => {
    expect(loadConfig(prod)).toMatchObject({ production: true, controller: "Example Person", cronSecret: "c".repeat(32) });
    for (const name of ["DATABASE_URL", "FOLLOW_CONTROLLER", "BB_ENCRYPTION_KEY", "BB_LOOKUP_PEPPER", "ALTCHA_HMAC_KEY", "MAIL_FROM", "RESEND_API_KEY", "CRON_SECRET", "NEXT_PUBLIC_SITE_URL"]) {
      const env: Record<string, string | undefined> = { ...prod, [name]: undefined };
      expect(() => loadConfig(env), name).toThrow(name);
    }
    expect(() => loadConfig({ ...prod, BB_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64") })).toThrow(/32 bytes/);
  });

  it("refuses the development outbox on a production deployment", () => {
    expect(() => loadConfig({ MAIL_PROVIDER: "outbox", VERCEL_ENV: "production" })).toThrow(/outbox/);
    expect(loadConfig({ MAIL_PROVIDER: "outbox" }).mail.provider).toBe("outbox");
  });
});

describe("Resend mail", () => {
  it("sends one plain-text message with the unsubscribe headers, and nothing else", async () => {
    const c = loadConfig({ ...prod, MAIL_REPLY_TO: "boroughs@example.org" });
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "x" }), { status: 200 });
    }) as unknown as typeof fetch;
    await resendMailer(c, fake).send({ to: "reader@example.org", subject: "Pledge update", text: "Hello", unsubscribeUrl: "https://boroughbook.example/api/follow/unsubscribe?t=abc" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toEqual({
      from: "Borough Book <alerts@boroughbook.example>",
      to: ["reader@example.org"],
      subject: "Pledge update",
      text: "Hello",
      reply_to: "boroughs@example.org",
      headers: { "List-Unsubscribe": "<https://boroughbook.example/api/follow/unsubscribe?t=abc>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
  });

  it("fails without echoing the address", async () => {
    const fake = (async () => new Response(JSON.stringify({ name: "validation_error", message: "Invalid `to` field: reader@example.org" }), { status: 422 })) as unknown as typeof fetch;
    const err = await resendMailer(loadConfig(prod), fake)
      .send({ to: "reader@example.org", subject: "s", text: "t" })
      .catch((e: Error) => e);
    expect(String(err)).toMatch(/HTTP 422 validation_error/);
    expect(String(err)).not.toMatch(/reader@example\.org/);
  });

  it("refuses to send when email is off", async () => {
    await expect(mailerFor(loadConfig({}), {} as never).send({ to: "a@b.co", subject: "s", text: "t" })).rejects.toThrow(/switched off/);
  });
});

const config = loadConfig({ MAIL_PROVIDER: "outbox" });
const NOW = new Date("2026-10-09T09:00:00Z");
const SECRET = `whsec_${Buffer.alloc(24, 7).toString("base64")}`;
const sign = (id: string, ts: string, body: string, secret = SECRET) =>
  `v1,${createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest("base64")}`;

describe("Resend webhook signatures", () => {
  const body = JSON.stringify({ type: "email.bounced" });
  const ts = String(Math.floor(NOW.getTime() / 1000));

  it("accepts a valid signature and refuses a wrong secret, a changed body or a stale timestamp", () => {
    expect(verifyResendSignature(SECRET, { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, body, NOW)).toBe(true);
    const other = `whsec_${Buffer.alloc(24, 9).toString("base64")}`;
    expect(verifyResendSignature(SECRET, { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body, other) }, body, NOW)).toBe(false);
    expect(verifyResendSignature(SECRET, { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, `${body} `, NOW)).toBe(false);
    const old = String(Math.floor(NOW.getTime() / 1000) - 600);
    expect(verifyResendSignature(SECRET, { id: "msg_1", timestamp: old, signature: sign("msg_1", old, body) }, body, NOW)).toBe(false);
  });
});

describe("bounces and complaints", () => {
  let db: Db;
  const subscribe = async (email: string) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO subscription (id, address_enc, address_hash, consent_text_version, consent_at, confirmed_at, manage_token_hash)
       VALUES ($1, 'x', $2, 'v1', now(), now(), $3)`,
      [id, lookupHash(config.lookupPepper, "email", normaliseEmail(email)), randomUUID()],
    );
    await db.query("INSERT INTO subscription_target (subscription_id, kind, target_id) VALUES ($1, 'all', '*')", [id]);
  };
  const count = async () => Number((await db.query<{ n: string }>("SELECT count(*) AS n FROM subscription"))[0]!.n);
  const event = (type: string, to: string[], bounceType?: string) => ({ type, data: { to, ...(bounceType ? { bounce: { type: bounceType } } : {}) } });

  beforeEach(async () => {
    db = await testDb();
    await subscribe("Reader@Example.org");
    await subscribe("other@example.org");
  });

  it("deletes the subscription for a permanent bounce or a complaint, and nothing for a temporary bounce", async () => {
    expect(await handleResendEvent({ db, config, now: NOW }, event("email.bounced", ["reader@example.org"], "Temporary"))).toEqual({ action: "none", kind: "other" });
    expect(await count()).toBe(2);
    expect(await handleResendEvent({ db, config, now: NOW }, event("email.bounced", ["reader@example.org"], "Permanent"))).toEqual({ action: "removed", kind: "bounce" });
    expect(await count()).toBe(1);
    expect(await handleResendEvent({ db, config, now: NOW }, event("email.complained", ["Other <other@example.org>"]))).toEqual({ action: "removed", kind: "complaint" });
    expect(await count()).toBe(0);
  });
});
