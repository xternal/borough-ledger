import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config";
import { type Db, testDb } from "../src/db";
import { outboxMailer, type MailMessage, type Mailer } from "../src/mail";
import { decrypt } from "../src/crypto";
import {
  ADDRESS_DAILY_LIMIT,
  CONSENT_VERSION,
  confirmEmailFollow,
  confirmView,
  consentPoints,
  deleteByManageToken,
  manageToken,
  manageView,
  parseFollowRequest,
  prunePendingAdditions,
  pruneUnconfirmed,
  removeTarget,
  requestEmailFollow,
  revokeManageLinks,
  type FollowContext,
  type Target,
} from "../src/follow";

const config = loadConfig({ MAIL_PROVIDER: "outbox", NEXT_PUBLIC_SITE_URL: "https://borough.test" });
const T0 = new Date("2026-10-09T09:00:00Z");
const DAY = 86_400_000;
const CCTV: Target = { kind: "promise", id: "lab-2026-ai-cctv" };
const ALL: Target = { kind: "all", id: "*" };
const EMAIL = "Reader@Example.org";

function captureMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return { sent, send: async (m) => void sent.push(m) };
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const tokenIn = (text: string, path: string) => new RegExp(`${escapeRegExp(path)}\\?t=([A-Za-z0-9_.-]+)`).exec(text)?.[1];
const state = async (token: unknown, now = T0) => (await confirmView(db, token, now)).state;

let db: Db;
let mail: ReturnType<typeof captureMailer>;
const ctx = (now = T0): FollowContext => ({ db, config, mail, now, describe: (t) => `name of ${t.kind} ${t.id}` });

beforeEach(async () => {
  db = await testDb();
  mail = captureMailer();
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in tests"));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.close();
});

describe("email follow: start, confirm, manage, unsubscribe", () => {
  it("runs the whole lifecycle", async () => {
    await requestEmailFollow(ctx(), { email: EMAIL, targets: [CCTV] });
    expect(mail.sent).toHaveLength(1);
    const confirm = mail.sent[0]!;
    expect(confirm.to).toBe("reader@example.org");
    expect(confirm.text).toContain("name of promise lab-2026-ai-cctv");
    expect(confirm.text).toContain("https://borough.test/privacy");
    expect(confirm.unsubscribeUrl).toBeUndefined();
    const ct = tokenIn(confirm.text, "/follow/confirm")!;
    expect(ct).toBeTruthy();

    const [pending] = await db.query<{ confirmed_at: unknown; consent_text_version: string }>("SELECT confirmed_at, consent_text_version FROM subscription");
    expect(pending!.confirmed_at).toBeNull();
    expect(pending!.consent_text_version).toBe(CONSENT_VERSION);

    // Confirm (POST): a welcome email with a working manage link and one-click unsubscribe.
    const res = await confirmEmailFollow(ctx(new Date(T0.getTime() + 3600_000)), ct);
    expect(res).toMatchObject({ ok: true, kind: "signup" });
    if (!res.ok) return;
    const welcome = mail.sent[1]!;
    expect(welcome.text).toContain(`https://borough.test/follow/manage?t=${res.manageToken}`);
    expect(welcome.unsubscribeUrl).toBe(`https://borough.test/api/follow/unsubscribe?t=${res.manageToken}`);
    expect(await confirmEmailFollow(ctx(), ct)).toEqual({ ok: false, reason: "invalid" }); // single use

    expect(await manageView({ db, config }, res.manageToken)).toEqual({ addressHint: "r•••@example.org", targets: [CCTV] });

    // Following more is confirmed by email too.
    await requestEmailFollow(ctx(new Date(T0.getTime() + 7200_000)), { email: "reader@example.org", targets: [ALL] });
    const added = mail.sent[2]!;
    expect(added.subject).toBe("Confirm what to add to your Borough Book alerts");
    expect(tokenIn(added.text, "/follow/manage")).toBe(res.manageToken); // the same link in every email
    expect((await manageView({ db, config }, res.manageToken))!.targets).toEqual([CCTV]);
    expect(await confirmEmailFollow(ctx(new Date(T0.getTime() + 7300_000)), tokenIn(added.text, "/follow/confirm"))).toEqual({
      ok: true,
      kind: "addition",
      manageToken: res.manageToken,
    });
    expect((await manageView({ db, config }, res.manageToken))!.targets).toEqual([CCTV, ALL]);

    expect(await removeTarget(ctx(), res.manageToken, CCTV)).toBe("removed");
    expect((await manageView({ db, config }, res.manageToken))!.targets).toEqual([ALL]);

    // One-click unsubscribe deletes the subscription and, by cascade, what it followed.
    const unsub = tokenIn(added.unsubscribeUrl!, "/api/follow/unsubscribe")!;
    expect(await deleteByManageToken(ctx(), unsub)).toBe(true);
    expect(await db.query("SELECT 1 FROM subscription")).toHaveLength(0);
    expect(await db.query("SELECT 1 FROM subscription_target")).toHaveLength(0);
    expect(await deleteByManageToken(ctx(), unsub)).toBe(false);
  });

  it("removing the last pledge deletes the address too", async () => {
    await requestEmailFollow(ctx(), { email: EMAIL, targets: [CCTV] });
    const res = await confirmEmailFollow(ctx(), tokenIn(mail.sent[0]!.text, "/follow/confirm"));
    if (!res.ok) throw new Error("confirm failed");
    expect(await removeTarget(ctx(), res.manageToken, ALL)).toBe("not_following");
    expect(await removeTarget(ctx(), res.manageToken, CCTV)).toBe("deleted");
    expect(await db.query("SELECT 1 FROM subscription")).toHaveLength(0);
  });

  it("manage links are stable, unforgeable and revocable", async () => {
    await requestEmailFollow(ctx(), { email: EMAIL, targets: [CCTV] });
    const res = await confirmEmailFollow(ctx(), tokenIn(mail.sent[0]!.text, "/follow/confirm"));
    if (!res.ok) throw new Error("confirm failed");
    const [{ id }] = (await db.query<{ id: string }>("SELECT id FROM subscription")) as [{ id: string }];
    expect(await manageToken(db, config, id)).toBe(res.manageToken);

    const mac = res.manageToken.split(".")[1]!;
    expect(await manageView({ db, config }, `00000000-0000-4000-8000-000000000000.${mac}`)).toBeNull();
    expect(await manageView({ db, config }, `${id}.${mac.slice(0, -1)}${mac.endsWith("A") ? "B" : "A"}`)).toBeNull();
    const otherServer = loadConfig({ MAIL_PROVIDER: "outbox", BB_LOOKUP_PEPPER: Buffer.alloc(32, 9).toString("base64") });
    expect(await manageView({ db, config: otherServer }, res.manageToken)).toBeNull();

    await revokeManageLinks(db, id);
    expect(await manageView({ db, config }, res.manageToken)).toBeNull();
    const fresh = await manageToken(db, config, id);
    expect(fresh).not.toBe(res.manageToken);
    expect(await manageView({ db, config }, fresh)).not.toBeNull();
  });
});

describe("consent text", () => {
  it("names the controller and the service that delivers the email", () => {
    const points = consentPoints("Example Person");
    expect(points[0]).toContain("Example Person runs Borough Book");
    expect(points.join(" ")).toContain("Resend");
    expect(points.join(" ")).toMatch(/political opinions/);
    expect(points.join(" ")).not.toContain("\u00b7");
  });
});

describe("privacy of the email flow", () => {
  it("answers the same for a new and a known address", async () => {
    expect(await requestEmailFollow(ctx(), { email: EMAIL, targets: [CCTV] })).toBeUndefined();
    expect(await requestEmailFollow(ctx(), { email: EMAIL, targets: [CCTV] })).toBeUndefined();
    expect(mail.sent).toHaveLength(2); // a fresh confirmation link each time
    expect(await db.query("SELECT 1 FROM subscription")).toHaveLength(1);
    expect(await state(tokenIn(mail.sent[0]!.text, "/follow/confirm"))).toBe("invalid");
    expect(await state(tokenIn(mail.sent[1]!.text, "/follow/confirm"))).toBe("valid");
  });

  it("opening the confirmation page never confirms", async () => {
    await requestEmailFollow(ctx(), { email: EMAIL, targets: [CCTV] });
    const ct = tokenIn(mail.sent[0]!.text, "/follow/confirm");
    for (let i = 0; i < 3; i++) expect(await state(ct)).toBe("valid");
    const [row] = await db.query<{ confirmed_at: unknown }>("SELECT confirmed_at FROM subscription");
    expect(row!.confirmed_at).toBeNull();
  });

  it("rejects an expired confirmation link, and the daily clean-up deletes the sign-up", async () => {
    await requestEmailFollow(ctx(), { email: EMAIL, targets: [CCTV] });
    const ct = tokenIn(mail.sent[0]!.text, "/follow/confirm");
    const later = new Date(T0.getTime() + 7 * DAY + 60_000);
    expect(await state(ct, later)).toBe("expired");
    expect(await confirmEmailFollow(ctx(later), ct)).toEqual({ ok: false, reason: "expired" });
    expect(await confirmEmailFollow(ctx(), "not a token")).toEqual({ ok: false, reason: "invalid" });
    expect(await pruneUnconfirmed(db, new Date(T0.getTime() + 6 * DAY))).toBe(0);
    expect(await pruneUnconfirmed(db, later)).toBe(1);
  });

  it("never stores an address or a token in plain text", async () => {
    const c: FollowContext = { ...ctx(), mail: outboxMailer(db, config) };
    await requestEmailFollow(c, { email: EMAIL, targets: [CCTV] });
    const [mailRow] = await db.query<{ body_text: string }>("SELECT body_text FROM mail_outbox");
    const res = await confirmEmailFollow(c, tokenIn(mailRow!.body_text, "/follow/confirm"));
    expect(res.ok).toBe(true);

    const tables = (await db.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).map((r) => r.table_name);
    let dump = "";
    for (const t of tables) dump += JSON.stringify(await db.query(`SELECT * FROM ${t}`));
    expect(dump.toLowerCase()).not.toContain("example.org");
    let stored = "";
    for (const t of tables.filter((x) => x !== "mail_outbox")) stored += JSON.stringify(await db.query(`SELECT * FROM ${t}`));
    if (res.ok) expect(stored).not.toContain(res.manageToken);
    const [sub] = await db.query<{ address_enc: string }>("SELECT address_enc FROM subscription");
    expect(decrypt(config.encryptionKey, sub!.address_enc)).toBe("reader@example.org");
  });

  it("limits how many emails one address gets in a day, without changing anything", async () => {
    for (let i = 0; i < ADDRESS_DAILY_LIMIT + 2; i++) await requestEmailFollow(ctx(), { email: EMAIL, targets: [CCTV] });
    expect(mail.sent).toHaveLength(ADDRESS_DAILY_LIMIT);
    expect(await state(tokenIn(mail.sent.at(-1)!.text, "/follow/confirm"))).toBe("valid");
  });
});

describe("follow requests for an address that is already confirmed", () => {
  async function confirmed(targets: Target[] = [CCTV]) {
    await requestEmailFollow(ctx(), { email: EMAIL, targets });
    const res = await confirmEmailFollow(ctx(), tokenIn(mail.sent.at(-1)!.text, "/follow/confirm"));
    if (!res.ok) throw new Error("confirm failed");
    return res.manageToken;
  }
  const followed = async (manage: string) => (await manageView({ db, config }, manage))!.targets;
  const later = (ms: number) => new Date(T0.getTime() + ms);

  it("adds nothing until the owner confirms", async () => {
    const manage = await confirmed();
    await requestEmailFollow(ctx(later(DAY)), { email: "reader@example.org", targets: [ALL] });
    const ask = mail.sent.at(-1)!;
    expect(ask.text).toContain("Nothing changes until you confirm.");
    expect(await followed(manage)).toEqual([CCTV]);
    const ct = tokenIn(ask.text, "/follow/confirm")!;
    expect(await confirmView(db, ct, later(DAY))).toEqual({ state: "valid", kind: "addition", targets: [ALL] });
    expect(await followed(manage)).toEqual([CCTV]);
    await confirmEmailFollow(ctx(later(2 * DAY)), ct);
    expect(await followed(manage)).toEqual([CCTV, ALL]);
  });

  it("says so, and changes nothing, when the address already follows everything asked", async () => {
    await confirmed([CCTV, ALL]);
    await requestEmailFollow(ctx(later(1000)), { email: EMAIL, targets: [ALL] });
    const note = mail.sent.at(-1)!;
    expect(note.subject).toBe("You already follow this on Borough Book");
    expect(note.text).not.toContain("/follow/confirm");
    expect(await db.query("SELECT 1 FROM pending_target")).toHaveLength(0);
  });

  it("deletes additions nobody confirmed after 7 days", async () => {
    const manage = await confirmed();
    await requestEmailFollow(ctx(later(DAY)), { email: EMAIL, targets: [ALL] });
    const ct = tokenIn(mail.sent.at(-1)!.text, "/follow/confirm")!;
    expect(await confirmEmailFollow(ctx(later(8 * DAY + 60_000)), ct)).toEqual({ ok: false, reason: "expired" });
    expect(await prunePendingAdditions(db, later(8 * DAY + 60_000))).toBe(1);
    expect(await followed(manage)).toEqual([CCTV]);
  });
});

describe("parseFollowRequest", () => {
  it("accepts a good body and rejects bad ones", () => {
    expect(parseFollowRequest({ email: " a@b.co ", targets: [CCTV, CCTV], altcha: "x" })).toEqual({ ok: true, value: { email: "a@b.co", targets: [CCTV], altcha: "x" } });
    expect(parseFollowRequest({ email: "nope", targets: [CCTV], altcha: "x" })).toEqual({ ok: false, field: "email" });
    expect(parseFollowRequest({ email: "a@b.co", targets: [], altcha: "x" })).toEqual({ ok: false, field: "targets" });
    expect(parseFollowRequest({ email: "a@b.co", targets: [{ kind: "all", id: "x" }], altcha: "x" })).toEqual({ ok: false, field: "targets" });
    expect(parseFollowRequest({ email: "a@b.co", targets: [{ kind: "actor", id: "x" }], altcha: "x" })).toEqual({ ok: false, field: "targets" });
    expect(parseFollowRequest({ email: "a@b.co", targets: [{ kind: "promise", id: "../x" }], altcha: "x" })).toEqual({ ok: false, field: "targets" });
    expect(parseFollowRequest({ email: "a@b.co", targets: [CCTV] })).toEqual({ ok: false, field: "altcha" });
    expect(parseFollowRequest([])).toEqual({ ok: false, field: "body" });
  });
});
