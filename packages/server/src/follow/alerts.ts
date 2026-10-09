import type { Db } from "../db";
import { decrypt } from "../crypto";
import { errorText } from "../log";
import { pruneSpamState } from "../spam";
import { type FollowContext, linksFor, mailFooter, prunePendingAdditions, pruneUnconfirmed } from "./service";

/**
 * The daily alerts job. Its input is every pledge change the site publishes:
 * the items of the pledge RSS feeds, each with a stable id (the feed's guid),
 * so the email and the feed always say the same thing.
 *
 * Each run remembers every item id it has seen (public data only). The first
 * run ever only remembers, so nobody is sent the history. After that, an id
 * not seen before is news: every confirmed subscriber who follows that pledge,
 * or every pledge, gets one email listing all of their news. A delivery row
 * per (item, subscriber) means a retry after a failure never sends twice.
 * Items are marked announced once everyone has had them; an item still
 * failing after 3 days is given up on.
 *
 * It also does the daily clean-up: unconfirmed sign-ups and additions older
 * than 7 days, yesterday's rate-limit salts, and old delivery rows.
 */

export interface AlertItem {
  /** The RSS item id, e.g. tag:boroughbook.uk,2026:promise/lab-2026-ai-cctv/event/3 */
  guid: string;
  promiseId: string;
  title: string;
  /** Path on the site, e.g. /promise/lab-2026-ai-cctv */
  path: string;
  description: string;
}

export interface AlertRun {
  /** Items remembered without sending (the first run). */
  seeded: number;
  /** Items seen for the first time on this run. */
  fresh: number;
  /** Emails sent, and emails that failed (tried again next run). */
  sent: number;
  failed: number;
}

/** Delivery rows are kept this long, then deleted: long enough to stop a resend, no longer. */
export const DELIVERY_KEEP_DAYS = 35;
const GIVE_UP_DAYS = 3;
const DAY_MS = 86_400_000;

async function prune(db: Db, now: Date): Promise<void> {
  await pruneUnconfirmed(db, now);
  await prunePendingAdditions(db, now);
  await pruneSpamState(db, now);
  await db.query("DELETE FROM delivery WHERE at < $1", [new Date(now.getTime() - DELIVERY_KEEP_DAYS * DAY_MS).toISOString()]);
}

async function remember(db: Db, items: AlertItem[], announced: boolean, now: Date): Promise<number> {
  let n = 0;
  for (const it of items) {
    const r = await db.query(
      "INSERT INTO alert_item (guid, promise_id, title, url, seen_at, announced) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (guid) DO NOTHING RETURNING guid",
      [it.guid, it.promiseId, it.title, it.path, now.toISOString(), announced],
    );
    n += r.length;
  }
  return n;
}

function body(items: AlertItem[], siteUrl: string): string {
  return items.map((it) => [it.title, it.description, `${siteUrl}${it.path}`].join("\n")).join("\n\n");
}

export async function runAlerts(ctx: FollowContext, items: AlertItem[], opts: { pauseMs?: number } = {}): Promise<AlertRun> {
  const { db, config } = ctx;
  const now = ctx.now ?? new Date();
  const pause = opts.pauseMs ?? 600; // Resend accepts about two requests a second
  await prune(db, now);

  const [{ n } = { n: 0 }] = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM alert_item");
  if (Number(n) === 0) return { seeded: await remember(db, items, true, now), fresh: 0, sent: 0, failed: 0 };

  const fresh = await remember(db, items, false, now);
  const byGuid = new Map(items.map((it) => [it.guid, it]));
  const pending = (await db.query<{ guid: string; promise_id: string; seen_at: Date | string }>("SELECT guid, promise_id, seen_at FROM alert_item WHERE announced = false ORDER BY seen_at, guid"))
    // An item that has gone from the feeds since (a correction) is not sent.
    .filter((r) => byGuid.has(r.guid));
  await db.query("UPDATE alert_item SET announced = true WHERE announced = false AND guid <> ALL($1::text[])", [pending.map((p) => p.guid)]);
  if (!pending.length) return { seeded: 0, fresh, sent: 0, failed: 0 };

  const rows = await db.query<{ id: string; address_enc: string; kind: string; target_id: string }>(
    `SELECT s.id, s.address_enc, t.kind, t.target_id FROM subscription s JOIN subscription_target t ON t.subscription_id = s.id
     WHERE s.confirmed_at IS NOT NULL ORDER BY s.id`,
  );
  const subs = new Map<string, { address_enc: string; all: boolean; promises: Set<string> }>();
  for (const r of rows) {
    const s = subs.get(r.id) ?? { address_enc: r.address_enc, all: false, promises: new Set<string>() };
    if (r.kind === "all") s.all = true;
    else s.promises.add(r.target_id);
    subs.set(r.id, s);
  }

  let sent = 0;
  let failed = 0;
  const failedGuids = new Set<string>();
  for (const [id, s] of subs) {
    const wanted = pending.filter((p) => s.all || s.promises.has(p.promise_id));
    if (!wanted.length) continue;
    const had = new Set((await db.query<{ guid: string }>("SELECT guid FROM delivery WHERE subscription_id = $1", [id])).map((r) => r.guid));
    const news = wanted.filter((p) => !had.has(p.guid)).map((p) => byGuid.get(p.guid)!);
    if (!news.length) continue;
    try {
      const links = await linksFor(db, config, id);
      await ctx.mail.send({
        to: decrypt(config.encryptionKey, s.address_enc),
        subject: news.length === 1 ? `Pledge update: ${news[0]!.title}` : `${news.length} pledge updates on Borough Book`,
        text: [news.length === 1 ? "A pledge you follow on Borough Book has changed:" : "Pledges you follow on Borough Book have changed:", "", body(news, config.siteUrl), "", mailFooter(links.manageUrl)].join("\n"),
        unsubscribeUrl: links.unsubscribeUrl,
      });
      for (const it of news) await db.query("INSERT INTO delivery (guid, subscription_id, at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [it.guid, id, now.toISOString()]);
      sent++;
    } catch (e) {
      failed++;
      news.forEach((it) => failedGuids.add(it.guid));
      console.error("alerts: an email failed:", errorText(e));
    }
    if (pause) await new Promise((r) => setTimeout(r, pause));
  }

  const giveUp = now.getTime() - GIVE_UP_DAYS * DAY_MS;
  const done = pending.filter((p) => !failedGuids.has(p.guid) || new Date(p.seen_at).getTime() < giveUp).map((p) => p.guid);
  if (done.length) await db.query("UPDATE alert_item SET announced = true WHERE guid = ANY($1::text[])", [done]);
  return { seeded: 0, fresh, sent, failed };
}
