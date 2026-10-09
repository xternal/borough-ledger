# Email alerts about pledges

Readers can ask for an email when a pledge changes, or when any pledge changes. Ported from LedgerGov.uk's follow system (`packages/server`), cut down to what Borough Book needs: email only, pledges only, at most one email a day.

**It is off until the owner switches it on.** With `MAIL_PROVIDER` unset, the site builds and runs with no database and no secrets, every follow endpoint answers 404, and pages offer RSS only, as before.

## How it works

* **Sign-up.** The form on a pledge page (or on /follow, for every pledge) posts the address, the pledge and a spam-check answer to `/api/follow`. The answer is the same whether or not the address is known. We email a confirmation link; the link opens `/follow/confirm`, whose button POSTs, because mail scanners open links and must never confirm on someone's behalf. Nothing is followed until then, and an unconfirmed sign-up is deleted after 7 days.
* **Adding to a confirmed address** works the same way: the new pledge waits until the address's owner confirms it, so nobody can add follows to someone else's alerts.
* **Manage and stop.** Every email ends with a link to `/follow/manage`, where the reader sees what they follow, removes a pledge or deletes everything. Every alert also carries one-click unsubscribe headers (RFC 8058), which delete the subscription.
* **Alerts.** Vercel Cron calls `/api/follow/alerts` once a day at 07:00 UTC (08:00 BST, 07:00 GMT). The job reads every item of the pledge RSS feeds (`lib/feeds.ts`, `promiseItems`) and remembers each item's id. The first run only remembers, so nobody gets the history. After that, each new id is emailed to everyone who follows that pledge or every pledge, one email per person listing all their news. A delivery record per person and item means a retry never sends twice. The same job deletes unconfirmed sign-ups, unconfirmed additions, yesterday's rate-limit salts and delivery records older than 35 days.
* **Bounces and complaints.** Resend's webhook (`/api/mail/resend`) deletes the subscription for a permanent bounce or a spam complaint.

## What is stored

Only in the database, never in logs:

* the email address, encrypted with AES-256-GCM, and an HMAC of it for lookups;
* the pledges followed, when consent was given and to which wording (`CONSENT_VERSION`);
* hashes of the confirmation and manage-link secrets;
* the ids of pledge changes seen, and which subscriber was sent which (35 days);
* per-day rate-limit counts keyed by a salted hash of the IP address; the salt is deleted after the day.

No names, no IP addresses, no open or click tracking, no follower counts on the site.

## Switching it on (owner)

Do these in order. `MAIL_PROVIDER=resend` goes last: once it is set, a build fails with the name of any setting still missing, and the live site stays on the previous deployment until it is fixed.

1. **Decide who holds the data.** This is the controller named in the consent text and the privacy notice: your name, or your company's. Check whether you need to pay the ICO data protection fee (https://ico.org.uk/fee). Read and finish [DPIA_EMAIL.md](DPIA_EMAIL.md).
2. **Database.** Create a Neon project in the London region (AWS Europe West 2). Copy the pooled connection string. Tables are created on first use.
3. **Resend.** Add and verify the sending domain (for example `boroughbook.uk`, with the DNS records Resend gives). In the domain's settings turn **off** open tracking and click tracking. Create an API key with sending access only. Add a webhook to `https://boroughbook.uk/api/mail/resend` for `email.bounced` and `email.complained`, and copy its signing secret.
4. **Secrets.** Make four random values, one at a time:

   ```bash
   openssl rand -base64 32
   ```

   Keep a copy of `BB_ENCRYPTION_KEY` somewhere safe: without it the stored addresses cannot be read.
5. **Vercel**, Production environment only (`vercel env add NAME production`, or the dashboard):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon's pooled connection string |
   | `FOLLOW_CONTROLLER` | who holds the data, as it should read: "Pavel Guzhikov" or a company name |
   | `BB_ENCRYPTION_KEY` | random value 1 |
   | `BB_LOOKUP_PEPPER` | random value 2 |
   | `ALTCHA_HMAC_KEY` | random value 3 |
   | `CRON_SECRET` | random value 4 (Vercel Cron sends it to the alerts job) |
   | `MAIL_FROM` | `Borough Book <alerts@boroughbook.uk>` |
   | `RESEND_API_KEY` | the Resend API key |
   | `RESEND_WEBHOOK_SECRET` | the webhook's signing secret |
   | `MAIL_REPLY_TO` | optional, for example `boroughs@guzh.uk` |
   | `FOLLOW_CONTACT` | optional; the privacy contact, default `boroughs@guzh.uk` |
   | `MAIL_PROVIDER` | `resend`, **last** |

6. **Redeploy** production, then follow a pledge with your own address, confirm it, open the manage page, and remove it.
7. **First alerts run.** Either wait for 07:00 UTC, or run it once by hand; the first run only remembers what is already published:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://boroughbook.uk/api/follow/alerts
   ```

To switch it off again, set `MAIL_PROVIDER=off` (or delete it) and redeploy. The data stays in Neon until you delete the project.

## Development

`MAIL_PROVIDER=outbox pnpm dev` runs every flow locally with an in-process Postgres (PGlite, in `apps/web/.data/`) and writes emails to its `mail_outbox` table instead of sending them. It is refused on a production deployment. Tests: `pnpm --filter @borough-ledger/server test`.
