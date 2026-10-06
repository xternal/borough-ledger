import type { Quality } from "@borough-ledger/schema";
import { QUALITY_LABEL, QUALITY_TITLE } from "@/lib/quality";
import type { QualityItem } from "@/lib/model";

const ORDER: Quality[] = ["sourced", "approx", "modelled", "test"];

/** "● sourced Streets, waste, parks and transport; Transitional relief  ● test All other lines" */
export function QualityLegend({ items, note }: { items: QualityItem[]; note?: Partial<Record<Quality, string>> }) {
  const groups = ORDER.map((q) => ({ q, labels: items.filter((i) => i.quality === q).map((i) => i.label) })).filter((g) => g.labels.length);
  const largest = groups.reduce((a, g) => (g.labels.length > a.labels.length ? g : a), groups[0]!);
  const text = (g: (typeof groups)[number]) =>
    note?.[g.q] ?? (groups.length === 1 ? "All lines" : g === largest ? "All other lines" : g.labels.join("; "));
  return (
    <div className="qrow">
      {groups.map((g) => (
        <QualityGroup key={g.q} q={g.q} text={text(g)} />
      ))}
    </div>
  );
}

export function QualityGroup({ q, text }: { q: Quality; text: string }) {
  return (
    <>
      <span className={`q ${q}`} title={QUALITY_TITLE[q]}>
        {QUALITY_LABEL[q]}
      </span>
      <span>{text}</span>
    </>
  );
}
