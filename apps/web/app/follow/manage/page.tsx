import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { manageView } from "@borough-ledger/server/follow";
import { PageShell } from "@/components/PageShell";
import { describeTarget, EMAIL_ALERTS, targetHref } from "@/lib/follow";
import { buildModel } from "@/lib/model";
import { getServer } from "@/lib/server";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Your alerts | ${SITE.name}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DONE: Record<string, string> = {
  confirmed: "Thanks, you are following. We have emailed you this page's link.",
  added: "Done. They are added to what you follow.",
  removed: "Done. You no longer follow that.",
  error: "Something went wrong. Please try again.",
};

/**
 * Manage alerts from the link in an email (no account): see what you follow,
 * remove one pledge, or delete everything. Forms post to /api/follow/manage
 * and come back here.
 */
export default async function ManagePage({ searchParams }: Props) {
  if (!EMAIL_ALERTS) notFound();
  const q = await searchParams;
  const t = typeof q.t === "string" ? q.t : "";
  const msg = typeof q.m === "string" ? q.m : "";
  const { db, config } = await getServer();
  const view = t ? await manageView({ db, config }, t) : null;
  const m = buildModel();

  if (!view)
    return (
      <PageShell m={m}>
        <div className="hero">
          {msg === "deleted" ? (
            <>
              <h1>Your data is deleted</h1>
              <p className="lede" role="status">
                We deleted your address and everything you followed. You will get no more emails from us.
              </p>
            </>
          ) : (
            <>
              <h1>This link does not work</h1>
              <p className="lede">Check that the whole link was copied from the email. If you have stopped your alerts, there is nothing left to manage.</p>
            </>
          )}
        </div>
        <section className="ward-sec">
          <p>
            <a href="/promises">All pledges</a>
          </p>
        </section>
      </PageShell>
    );

  return (
    <PageShell m={m}>
      <div className="hero">
        <h1>Your alerts</h1>
        <p className="lede">Alerts go to {view.addressHint}.</p>
      </div>
      {DONE[msg] && (
        <p role="status" className="status-note">
          {DONE[msg]}
        </p>
      )}
      <section aria-labelledby="follows-h" className="ward-sec">
        <h2 id="follows-h">What you follow</h2>
        <ul className="follow-list">
          {view.targets.map((target) => (
            <li key={`${target.kind}:${target.id}`}>
              <a href={targetHref(target)}>{describeTarget(target)}</a>
              <form method="post" action="/api/follow/manage">
                <input type="hidden" name="t" value={t} />
                <input type="hidden" name="action" value="remove" />
                <input type="hidden" name="kind" value={target.kind} />
                <input type="hidden" name="id" value={target.id} />
                <button type="submit" className="btn secondary" aria-label={`Stop following ${describeTarget(target)}`}>
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
        {view.targets.length === 1 && <p className="small muted">Removing the last one also deletes your address.</p>}
      </section>
      <section aria-labelledby="stop-h" className="ward-sec">
        <h2 id="stop-h">Stop all alerts</h2>
        <p>
          This deletes your address, your consent record and everything you follow, at once. To follow again later, you sign up again. The{" "}
          <a href="/privacy">privacy notice</a> says what we keep and for how long.
        </p>
        <form method="post" action="/api/follow/manage">
          <input type="hidden" name="t" value={t} />
          <input type="hidden" name="action" value="delete" />
          <button type="submit" className="btn danger">
            Stop all alerts and delete my data
          </button>
        </form>
        <p className="small muted">Keep this page&rsquo;s link to yourself: anyone who has it can change your alerts. {SITE.name} never shows who follows what.</p>
      </section>
    </PageShell>
  );
}
