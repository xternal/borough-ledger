import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATA } from "@borough-ledger/schema";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { PromiseCardView } from "@/components/Promises";
import { formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { feedAlternate } from "@/lib/rss";
import { CONTACT, SITE } from "@/lib/site";
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
  const title = `“${p.text}” | ${SITE.name}`;
  const description = `${p.actor}, ${p.venue} ${p.made_on.slice(0, 4)}. Status, cost to the council and timeline, independently tracked.`;
  return { title, description, alternates: { canonical: `/promise/${id}`, types: feedAlternate(`/promise/${id}/feed.xml`, `Changes to this pledge`) }, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
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
      <JsonLd data={promiseJsonLd(p)} />
    </PageShell>
  );
}
