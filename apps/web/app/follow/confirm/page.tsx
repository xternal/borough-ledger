import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONFIRM_TTL_DAYS, confirmView, type ConfirmView } from "@borough-ledger/server/follow";
import { PageShell } from "@/components/PageShell";
import { consentForForm, describeTarget, EMAIL_ALERTS } from "@/lib/follow";
import { buildModel } from "@/lib/model";
import { getServer } from "@/lib/server";
import { share } from "@/lib/share";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Confirm your alerts | ${SITE.name}`,
  description: "Confirm your email alerts about pledges on Borough Book.",
  ...share("/follow/confirm", `Confirm your alerts | ${SITE.name}`, "Confirm your email alerts about pledges on Borough Book."),
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The link in a confirmation email lands here: for a new sign-up, or for
 * pledges added to alerts the address already gets. Opening the page (GET)
 * only reads; the button POSTs to /api/follow/confirm, because mail scanners
 * open links and must never confirm on someone's behalf.
 */
export default async function ConfirmPage({ searchParams }: Props) {
  if (!EMAIL_ALERTS) notFound();
  const q = await searchParams;
  const t = typeof q.t === "string" ? q.t : "";
  const e = typeof q.e === "string" ? q.e : "";
  let view: ConfirmView = { state: e === "expired" ? "expired" : "invalid", kind: "signup", targets: [] };
  if (t) view = await confirmView((await getServer()).db, t);
  const adding = view.kind === "addition";
  const m = buildModel();

  return (
    <PageShell m={m}>
      <div className="hero">
        {view.state === "valid" ? (
          <>
            <h1>{adding ? "Add to your alerts" : "Confirm your alerts"}</h1>
            <p className="lede">{adding ? "Press the button to add these to the alerts you already get:" : "Press the button to get an email when one of these changes:"}</p>
          </>
        ) : view.state === "expired" ? (
          <>
            <h1>This link has expired</h1>
            <p className="lede">Confirmation links work for {CONFIRM_TTL_DAYS} days. Open the pledge again and ask for alerts, and we will send a new one.</p>
          </>
        ) : (
          <>
            <h1>This link does not work</h1>
            <p className="lede">
              It may have been used already or replaced by a newer email. If you have already confirmed, use the link at the bottom of any email from us.
            </p>
          </>
        )}
      </div>
      <section className="ward-sec">
        {view.state === "valid" ? (
          <>
            <ul>
              {view.targets.map((target) => (
                <li key={`${target.kind}:${target.id}`}>{describeTarget(target)}</li>
              ))}
            </ul>
            <form method="post" action="/api/follow/confirm">
              <input type="hidden" name="t" value={t} />
              <button type="submit" className="btn">
                Confirm
              </button>
            </form>
            <p className="small muted">
              {adding
                ? `Did not ask for this? Close this page. Nothing is added, and we delete the request after ${CONFIRM_TTL_DAYS} days.`
                : `Did not ask for this? Close this page. Nothing is followed, and we delete the address after ${CONFIRM_TTL_DAYS} days.`}
            </p>
            <details className="small">
              <summary>What you agree to</summary>
              <ul>
                {consentForForm().map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p>
                Full details are in the <a href="/privacy">privacy notice</a>.
              </p>
            </details>
          </>
        ) : (
          <p>
            <a href="/promises">All pledges</a>
          </p>
        )}
      </section>
    </PageShell>
  );
}
