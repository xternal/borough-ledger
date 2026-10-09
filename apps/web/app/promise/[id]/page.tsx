import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATA } from "@borough-ledger/schema";
import { EmailFollow } from "@/components/EmailFollow";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { PromiseCardView } from "@/components/Promises";
import { consentForForm, EMAIL_ALERTS } from "@/lib/follow";
import { formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { feedAlternate } from "@/lib/rss";
import { CONTACT, SITE } from "@/lib/site";
import { STATUS_LABEL } from "@/lib/promises";
import { dateModified, promiseQA, promiseSummary } from "@/lib/promiseText";
import { shorten } from "@/lib/rss";
import { promiseJsonLd } from "@/lib/structured";

type Props = { params: Promise<{ id: string }> };

export const revalidate = 86400;

export function generateStaticParams() {
  return DATA.content.promises.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = buildModel().promises.find((x) => x.id === id);
  if (!p) return {};
  const m = buildModel();
  // The status is in the title, so a search result or an AI answer can say where the pledge stands at a glance.
  const title = `${p.partyShort} pledge: \u201c${shorten(p.text, 80)}\u201d (${STATUS_LABEL[p.status]}) | ${SITE.name}`;
  const description = shorten(promiseSummary(p, m), 300);
  return {
    title,
    description,
    alternates: {
      canonical: `/promise/${id}`,
      types: { ...feedAlternate(`/promise/${id}/feed.xml`, `Changes to this pledge`), "text/markdown": [{ url: `/promise/${id}.md`, title: "This pledge as Markdown" }] },
    },
    openGraph: { type: "article", title, description, modifiedTime: dateModified(p), publishedTime: p.versions[0]!.recorded_on },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PromisePage({ params }: Props) {
  const { id } = await params;
  const m = buildModel();
  const p = m.promises.find((x) => x.id === id);
  if (!p) notFound();
  return (
    <PageShell m={m}>
      <div className="card-page">
        <p className="small">
          <a href="/promises">All promises</a>
        </p>
        <PromiseCardView p={p} today={m.today} generalBudget={m.generalBudget} balance={m.balance} />
        <section aria-labelledby="short-h" className="card-extra">
          <h2 id="short-h">In short</h2>
          <p>{promiseSummary(p, m)}</p>
          <p className="small muted">
            Last changed <time dateTime={dateModified(p)}>{formatDay(dateModified(p))}</time>.{" "}
            <a href={`/promise/${p.id}.md`} type="text/markdown">
              This pledge as plain text
            </a>
          </p>
        </section>
        {EMAIL_ALERTS ? (
          <section aria-labelledby="alerts-h" className="card-extra">
            <h2 id="alerts-h">Get an email when it changes</h2>
            <EmailFollow target={{ kind: "promise", id: p.id }} consent={consentForForm()} heading="An email when its status, a deadline or a reply changes. No account needed." />
          </section>
        ) : null}
        {p.versions.length > 1 ? (
          <section aria-labelledby="versions-h" className="card-extra">
            <h2 id="versions-h">Earlier wording</h2>
            <ol className="versions">
              {p.versions.slice(0, -1).map((v, i) => (
                <li key={i}>
                  &ldquo;{v.text}&rdquo; <span className="muted small">recorded {formatDay(v.recorded_on)}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        <section aria-labelledby="qa-h" className="card-extra">
          <h2 id="qa-h">Questions</h2>
          <div className="faq faq-flush">
            {promiseQA(p, m).map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section aria-labelledby="reply-h" className="card-extra">
          <h2 id="reply-h">Right of reply</h2>
          {p.replies.length ? (
            p.replies.map((r, i) => (
              <blockquote key={i}>
                <p>{r.text}</p>
                <footer className="small muted">
                  {r.from}, {formatDay(r.date)}
                </footer>
              </blockquote>
            ))
          ) : (
            <p className="muted">
              No reply yet. Any councillor or party named on a card can reply by emailing <a href={`mailto:${CONTACT}`}>{CONTACT}</a>, and replies
              are published here within five working days. Every party is held to the same standard.
            </p>
          )}
        </section>
      </div>
      <JsonLd data={promiseJsonLd(p, promiseSummary(p, m), dateModified(p), promiseQA(p, m), m.place.council)} />
    </PageShell>
  );
}
