import { createHmac, randomUUID } from "node:crypto";
import type { Config } from "../config";
import type { Db } from "../db";
import type { Mailer } from "../mail";
import { decrypt, encrypt, hashToken, lookupHash, newToken, normaliseEmail, sameHash } from "../crypto";
import { errorText } from "../log";
import { rateLimit } from "../spam";
import { CONSENT_VERSION, PRIVACY_PATH } from "./consent";
import { isTokenShape } from "./input";
import { type DescribeTarget, type Target, type TargetKind, plainDescribe, sameTarget } from "./targets";

/**
 * Follow a pledge by email without an account (docs/PRIVACY.md), ported from
 * LedgerGov.uk's follow service.
 *
 * Double opt-in. A request creates (or extends) an unconfirmed subscription
 * and mails a confirmation link; the link opens a page whose button POSTs,
 * because mail scanners prefetch GET links. Unconfirmed sign-ups are deleted
 * after 7 days. A request for an address that is already confirmed adds
 * nothing either: the new pledges wait in pending_target until the owner
 * confirms them with a link of the same kind, and are deleted after 7 days
 * otherwise, so nobody can add follows to someone else's alerts.
 *
 * Manage links: one token per subscription, the same in every email, so the
 * unsubscribe link in any email keeps working (RFC 8058; PECR expects a simple
 * opt-out in every message). The token is `<id>.<mac>`, mac = HMAC(lookup
 * pepper, id + the subscription's random link secret, stored in the
 * manage_token_hash column). Only the server can mint one; a database leak
 * alone cannot. revokeManageLinks replaces the secret and retires them all.
 *
 * Addresses are stored only encrypted plus a lookup hash; nothing here logs or
 * returns an address, a token or what someone follows to anyone but the holder
 * of that subscription's own link.
 */

export const CONFIRM_TTL_DAYS = 7;
/** Emails a day to one address, whoever asks: stops a stranger mail-bombing someone through our form. */
export const ADDRESS_DAILY_LIMIT = 3;
const DAY_MS = 86_400_000;

export interface FollowContext {
  db: Db;
  config: Config;
  mail: Mailer;
  /** Names for emails and pages, resolved from content by the app. */
  describe?: DescribeTarget;
  /** Clock, for tests. */
  now?: Date;
}

interface SubscriptionRow {
  id: string;
  address_enc: string;
  confirmed_at: Date | string | null;
  created_at: Date | string;
}

const nowOf = (ctx: { now?: Date }) => ctx.now ?? new Date();
const describeOf = (ctx: { describe?: DescribeTarget }) => ctx.describe ?? plainDescribe;

// ------------------------------------------------------------------ links

export function confirmUrl(config: Config, token: string): string {
  return `${config.siteUrl}/follow/confirm?t=${encodeURIComponent(token)}`;
}

export function manageUrl(config: Config, token: string): string {
  return `${config.siteUrl}/follow/manage?t=${encodeURIComponent(token)}`;
}

/** The privacy notice: who runs Borough Book, what is kept, for how long, and readers' rights. */
export function privacyUrl(config: Config): string {
  return `${config.siteUrl}${PRIVACY_PATH}`;
}

/** One-click unsubscribe (RFC 8058): mail clients POST here; put it in MailMessage.unsubscribeUrl. */
export function unsubscribeUrl(config: Config, token: string): string {
  return `${config.siteUrl}/api/follow/unsubscribe?t=${encodeURIComponent(token)}`;
}

const MANAGE_TOKEN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

function manageMac(config: Config, subscriptionId: string, linkSecret: string): string {
  return createHmac("sha256", config.lookupPepper).update(`manage:${subscriptionId}:${linkSecret}`).digest("base64url");
}

/** The manage token for a subscription: the same in every email until revoked. */
export async function manageToken(db: Db, config: Config, subscriptionId: string): Promise<string> {
  const [row] = await db.query<{ manage_token_hash: string }>("SELECT manage_token_hash FROM subscription WHERE id = $1", [subscriptionId]);
  if (!row) throw new Error("manageToken: no such subscription");
  return `${subscriptionId}.${manageMac(config, subscriptionId, row.manage_token_hash)}`;
}

/** Replace the link secret: every manage and unsubscribe link sent so far stops working. */
export async function revokeManageLinks(db: Db, subscriptionId: string): Promise<void> {
  await db.query("UPDATE subscription SET manage_token_hash = $2 WHERE id = $1", [subscriptionId, newToken().hash]);
}

/** The subscription id a manage token belongs to, or null. Constant-time on the mac. */
async function subscriptionForManageToken(db: Db, config: Config, token: unknown): Promise<string | null> {
  const m = typeof token === "string" ? MANAGE_TOKEN.exec(token) : null;
  if (!m) return null;
  const [, id, mac] = m;
  const [row] = await db.query<{ manage_token_hash: string }>("SELECT manage_token_hash FROM subscription WHERE id = $1", [id]);
  return row && sameHash(manageMac(config, id!, row.manage_token_hash), mac!) ? id! : null;
}

/** Both links for one outgoing email. */
export async function linksFor(db: Db, config: Config, subscriptionId: string): Promise<{ manageUrl: string; unsubscribeUrl: string }> {
  const token = await manageToken(db, config, subscriptionId);
  return { manageUrl: manageUrl(config, token), unsubscribeUrl: unsubscribeUrl(config, token) };
}

/** The footer every follow email ends with. */
export function mailFooter(manage: string): string {
  return [
    "--",
    "Change what you follow, or stop all alerts and delete your address:",
    manage,
    "",
    "Keep this link to yourself: anyone who has it can change your alerts.",
    "Borough Book is independent of every council and party. It never shows who follows what, and never shares or sells its list.",
  ].join("\n");
}

// ------------------------------------------------------------------ helpers

async function targetsOf(db: Db, subscriptionId: string): Promise<Target[]> {
  const rows = await db.query<{ kind: TargetKind; target_id: string }>(
    "SELECT kind, target_id FROM subscription_target WHERE subscription_id = $1 ORDER BY created_at, kind, target_id",
    [subscriptionId],
  );
  return rows.map((r) => ({ kind: r.kind, id: r.target_id }));
}

async function addTargets(db: Db, subscriptionId: string, targets: Target[], now: Date): Promise<Target[]> {
  const added: Target[] = [];
  for (const t of targets) {
    const r = await db.query(
      "INSERT INTO subscription_target (subscription_id, kind, target_id, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING kind",
      [subscriptionId, t.kind, t.id, now.toISOString()],
    );
    if (r.length) added.push(t);
  }
  return added;
}

function bullets(names: string[]): string {
  return names.map((n) => `- ${n}`).join("\n");
}

/** "r•••@example.org": enough for the person to recognise their address on the manage page. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}

// ------------------------------------------------------------------ request and confirm

/**
 * Handle a follow request from the web form. Always resolves the same way
 * whether or not the address is known, so the response reveals nothing.
 * Throws only if the email could not be sent (the caller says so honestly).
 */
export async function requestEmailFollow(ctx: FollowContext, input: { email: string; targets: Target[] }): Promise<void> {
  const { db, config } = ctx;
  const now = nowOf(ctx);
  const describe = describeOf(ctx);
  const email = normaliseEmail(input.email);
  const hash = lookupHash(config.lookupPepper, "email", email);

  // Over the per-address limit: change nothing (a resend would also invalidate the last link) and send nothing.
  if (!(await rateLimit(db, `address:${hash}`, "follow_address", ADDRESS_DAILY_LIMIT, now))) return;

  type Plan =
    | { kind: "confirm"; token: string; targets: Target[] }
    | { kind: "add"; token: string; manageToken: string; targets: Target[] }
    | { kind: "already"; manageToken: string; targets: Target[] };
  const plan = await db.transaction<Plan>(async (tx) => {
    const [existing] = await tx.query<SubscriptionRow>("SELECT id, confirmed_at FROM subscription WHERE address_hash = $1 FOR UPDATE", [hash]);
    if (!existing) {
      const id = randomUUID();
      const confirm = newToken();
      const manage = newToken();
      const inserted = await tx.query(
        `INSERT INTO subscription (id, address_enc, address_hash, consent_text_version, consent_at, confirm_token_hash, manage_token_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $5)
         ON CONFLICT (address_hash) DO NOTHING RETURNING id`,
        [id, encrypt(config.encryptionKey, email), hash, CONSENT_VERSION, now.toISOString(), confirm.hash, manage.hash],
      );
      if (!inserted.length) throw new Error("follow request raced another for the same address");
      await addTargets(tx, id, input.targets, now);
      return { kind: "confirm", token: confirm.token, targets: await targetsOf(tx, id) };
    }
    if (!existing.confirmed_at) {
      // Still waiting for confirmation: add the pledges and send a new link.
      // created_at restarts so the 7-day window (and the clean-up) count from this email.
      const confirm = newToken();
      await tx.query("UPDATE subscription SET confirm_token_hash = $2, created_at = $3, consent_text_version = $4, consent_at = $3 WHERE id = $1", [
        existing.id,
        confirm.hash,
        now.toISOString(),
        CONSENT_VERSION,
      ]);
      await addTargets(tx, existing.id, input.targets, now);
      return { kind: "confirm", token: confirm.token, targets: await targetsOf(tx, existing.id) };
    }
    // Confirmed already: the request is not verified, so it changes nothing yet. What is new waits in
    // pending_target until the owner confirms it with the link we email to the address.
    const manage = await manageToken(tx, ctx.config, existing.id);
    const following = await targetsOf(tx, existing.id);
    const fresh = input.targets.filter((t) => !following.some((f) => sameTarget(f, t)));
    if (!fresh.length) return { kind: "already", manageToken: manage, targets: input.targets };
    const confirm = newToken();
    for (const t of fresh) {
      await tx.query(
        `INSERT INTO pending_target (subscription_id, kind, target_id, confirm_token_hash, requested_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (subscription_id, kind, target_id) DO UPDATE SET confirm_token_hash = EXCLUDED.confirm_token_hash, requested_at = EXCLUDED.requested_at`,
        [existing.id, t.kind, t.id, confirm.hash, now.toISOString()],
      );
    }
    return { kind: "add", token: confirm.token, manageToken: manage, targets: fresh };
  });

  const names = plan.targets.map(describe);
  if (plan.kind === "confirm") {
    await ctx.mail.send({
      to: email,
      subject: "Confirm your pledge alerts from Borough Book",
      text: [
        "Please confirm that you want an email from Borough Book when one of these changes:",
        "",
        bullets(names),
        "",
        'To start, open this link and press "Confirm":',
        confirmUrl(config, plan.token),
        "",
        `The link works for ${CONFIRM_TTL_DAYS} days. If you did not ask for this, ignore this email. We will delete your address after ${CONFIRM_TTL_DAYS} days and send you nothing more.`,
        "",
        "We store your email address, encrypted, and what you follow. Nothing else. We never show who follows what, and never share or sell our list.",
        `Who runs Borough Book, what we keep and your rights: ${privacyUrl(config)}`,
        "",
        "Borough Book",
        config.siteUrl,
      ].join("\n"),
    });
  } else if (plan.kind === "add") {
    const manage = manageUrl(config, plan.manageToken);
    await ctx.mail.send({
      to: email,
      subject: "Confirm what to add to your Borough Book alerts",
      text: [
        "A request came in to add these to the alerts this address gets from Borough Book:",
        "",
        bullets(names),
        "",
        'Nothing changes until you confirm. To add them, open this link and press "Confirm":',
        confirmUrl(config, plan.token),
        "",
        `The link works for ${CONFIRM_TTL_DAYS} days. If you did not ask for this, ignore this email: nothing is added, and we delete the request after ${CONFIRM_TTL_DAYS} days.`,
        "",
        mailFooter(manage),
      ].join("\n"),
      unsubscribeUrl: unsubscribeUrl(config, plan.manageToken),
    });
  } else {
    const manage = manageUrl(config, plan.manageToken);
    await ctx.mail.send({
      to: email,
      subject: "You already follow this on Borough Book",
      text: ["A request came in to follow:", "", bullets(names), "", "This address already gets alerts about it, so nothing has changed.", "", mailFooter(manage)].join("\n"),
      unsubscribeUrl: unsubscribeUrl(config, plan.manageToken),
    });
  }
}

export type ConfirmTokenState = "valid" | "expired" | "invalid";

async function pendingByConfirmToken(db: Db, token: unknown, lock = false): Promise<SubscriptionRow | null> {
  if (!isTokenShape(token)) return null;
  const [row] = await db.query<SubscriptionRow>(
    `SELECT id, address_enc, confirmed_at, created_at FROM subscription
     WHERE confirm_token_hash = $1 AND confirmed_at IS NULL${lock ? " FOR UPDATE" : ""}`,
    [hashToken(token)],
  );
  return row ?? null;
}

/** Pledges waiting on one confirmation link, for a confirmed subscription. */
interface PendingAddition {
  subscriptionId: string;
  requestedAt: Date | string;
  targets: Target[];
}

async function additionByConfirmToken(db: Db, token: unknown, lock = false): Promise<PendingAddition | null> {
  if (!isTokenShape(token)) return null;
  const rows = await db.query<{ subscription_id: string; kind: TargetKind; target_id: string; requested_at: Date | string }>(
    `SELECT p.subscription_id, p.kind, p.target_id, p.requested_at FROM pending_target p JOIN subscription s ON s.id = p.subscription_id
     WHERE p.confirm_token_hash = $1 AND s.confirmed_at IS NOT NULL ORDER BY p.kind, p.target_id${lock ? " FOR UPDATE" : ""}`,
    [hashToken(token)],
  );
  const first = rows[0];
  if (!first) return null;
  return { subscriptionId: first.subscription_id, requestedAt: first.requested_at, targets: rows.map((r) => ({ kind: r.kind, id: r.target_id })) };
}

function expired(since: Date | string, now: Date): boolean {
  return now.getTime() - new Date(since).getTime() > CONFIRM_TTL_DAYS * DAY_MS;
}

/** What a confirmation link is for: a new sign-up, or additions to alerts the address already gets. */
export interface ConfirmView {
  state: ConfirmTokenState;
  kind: "signup" | "addition";
  /** What pressing Confirm would follow; empty unless the link is valid. */
  targets: Target[];
}

/** Read-only, for the confirmation page (a GET must never confirm). */
export async function confirmView(db: Db, token: unknown, now = new Date()): Promise<ConfirmView> {
  const row = await pendingByConfirmToken(db, token);
  if (row) return expired(row.created_at, now) ? { state: "expired", kind: "signup", targets: [] } : { state: "valid", kind: "signup", targets: await targetsOf(db, row.id) };
  const add = await additionByConfirmToken(db, token);
  if (add) return expired(add.requestedAt, now) ? { state: "expired", kind: "addition", targets: [] } : { state: "valid", kind: "addition", targets: add.targets };
  return { state: "invalid", kind: "signup", targets: [] };
}

export type ConfirmResult = { ok: true; manageToken: string; kind: "signup" | "addition" } | { ok: false; reason: "expired" | "invalid" };

/**
 * Confirm a pending subscription, or additions to a confirmed one (POST only).
 * A new subscription gets a welcome email with the manage link; an addition
 * needs none, because the email that asked already carries it. Returns the
 * manage token for the page to link to.
 */
export async function confirmEmailFollow(ctx: FollowContext, token: unknown): Promise<ConfirmResult> {
  const { db, config } = ctx;
  const now = nowOf(ctx);
  const invalid = { ok: false as const, reason: "invalid" as const };
  const result = await db.transaction(async (tx) => {
    const row = await pendingByConfirmToken(tx, token, true);
    if (row) {
      if (expired(row.created_at, now)) return { ok: false as const, reason: "expired" as const };
      await tx.query("UPDATE subscription SET confirmed_at = $2, confirm_token_hash = NULL WHERE id = $1", [row.id, now.toISOString()]);
      return { ok: true as const, kind: "signup" as const, row, manageToken: await manageToken(tx, config, row.id), targets: await targetsOf(tx, row.id) };
    }
    const add = await additionByConfirmToken(tx, token, true);
    if (!add) return invalid;
    if (expired(add.requestedAt, now)) return { ok: false as const, reason: "expired" as const };
    await addTargets(tx, add.subscriptionId, add.targets, now);
    await tx.query("DELETE FROM pending_target WHERE confirm_token_hash = $1", [hashToken(token as string)]);
    // The owner's own act, under today's consent text: record it.
    await tx.query("UPDATE subscription SET consent_text_version = $2, consent_at = $3 WHERE id = $1", [add.subscriptionId, CONSENT_VERSION, now.toISOString()]);
    return { ok: true as const, kind: "addition" as const, manageToken: await manageToken(tx, config, add.subscriptionId) };
  });
  if (!result.ok) return result;
  if (result.kind === "addition") return { ok: true, kind: "addition", manageToken: result.manageToken };

  const manage = manageUrl(config, result.manageToken);
  try {
    await ctx.mail.send({
      to: decrypt(config.encryptionKey, result.row.address_enc),
      subject: "Your pledge alerts from Borough Book are on",
      text: [
        "Thanks for confirming. You follow:",
        "",
        bullets(result.targets.map(describeOf(ctx))),
        "",
        "We email you when one of these changes: its status, a deadline, or a reply from the party. At most one email a day.",
        "",
        mailFooter(manage),
      ].join("\n"),
      unsubscribeUrl: unsubscribeUrl(config, result.manageToken),
    });
  } catch (e) {
    // The follow is confirmed either way; the page shows the manage link.
    console.error("follow: welcome email failed:", errorText(e));
  }
  return { ok: true, kind: "signup", manageToken: result.manageToken };
}

/** Delete sign-ups nobody confirmed within 7 days. Run daily (the alerts job). Returns how many were deleted. */
export async function pruneUnconfirmed(db: Db, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CONFIRM_TTL_DAYS * DAY_MS);
  const rows = await db.query("DELETE FROM subscription WHERE confirmed_at IS NULL AND created_at < $1 RETURNING id", [cutoff.toISOString()]);
  return rows.length;
}

/** Delete additions nobody confirmed within 7 days. Run daily (the alerts job). Returns how many were deleted. */
export async function prunePendingAdditions(db: Db, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CONFIRM_TTL_DAYS * DAY_MS);
  const rows = await db.query("DELETE FROM pending_target WHERE requested_at < $1 RETURNING kind", [cutoff.toISOString()]);
  return rows.length;
}

// ------------------------------------------------------------------ manage

async function byManageToken(db: Db, config: Config, token: unknown): Promise<SubscriptionRow | null> {
  const id = await subscriptionForManageToken(db, config, token);
  if (!id) return null;
  const [row] = await db.query<SubscriptionRow>("SELECT id, address_enc, confirmed_at, created_at FROM subscription WHERE id = $1 AND confirmed_at IS NOT NULL", [id]);
  return row ?? null;
}

export interface ManageView {
  /** Masked address, e.g. "r•••@example.org". */
  addressHint: string;
  targets: Target[];
}

/** What the holder of a manage link sees. Null if the link is not (or no longer) valid. */
export async function manageView(ctx: Pick<FollowContext, "db" | "config">, token: unknown): Promise<ManageView | null> {
  const row = await byManageToken(ctx.db, ctx.config, token);
  if (!row) return null;
  let addressHint = "your address";
  try {
    addressHint = maskEmail(decrypt(ctx.config.encryptionKey, row.address_enc));
  } catch {
    // Wrong key (e.g. rotated without migration): still let the person manage or delete.
  }
  return { addressHint, targets: await targetsOf(ctx.db, row.id) };
}

export type RemoveResult = "removed" | "deleted" | "not_following" | "invalid";

/** Stop following one pledge. Removing the last one deletes the subscription and the address. */
export async function removeTarget(ctx: Pick<FollowContext, "db" | "config">, token: unknown, target: Target): Promise<RemoveResult> {
  const row = await byManageToken(ctx.db, ctx.config, token);
  if (!row) return "invalid";
  return ctx.db.transaction(async (tx) => {
    const r = await tx.query("DELETE FROM subscription_target WHERE subscription_id = $1 AND kind = $2 AND target_id = $3 RETURNING kind", [row.id, target.kind, target.id]);
    if (!r.length) return "not_following";
    const [left] = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM subscription_target WHERE subscription_id = $1", [row.id]);
    if (Number(left?.n ?? 0) > 0) return "removed";
    await tx.query("DELETE FROM subscription WHERE id = $1", [row.id]);
    return "deleted";
  });
}

/**
 * Delete the subscription behind a manage token: the address, the consent
 * record and everything followed (ON DELETE CASCADE).
 */
export async function deleteByManageToken(ctx: Pick<FollowContext, "db" | "config">, token: unknown): Promise<boolean> {
  const id = await subscriptionForManageToken(ctx.db, ctx.config, token);
  if (!id) return false;
  const rows = await ctx.db.query("DELETE FROM subscription WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}
