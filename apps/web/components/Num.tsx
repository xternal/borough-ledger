import type { Figure } from "@borough-ledger/schema";
import { format, type Fmt } from "@/lib/format";
import { QUALITY_TITLE, assertRenderable } from "@/lib/quality";

/**
 * The only way the site renders a number from data. Carries its quality in `data-q`;
 * test values get a visible mark and fail a production build.
 */
export function Num({ f, fmt, className, what }: { f: Figure; fmt: Fmt; className?: string; what?: string }) {
  assertRenderable(f.quality, what ?? `${format(fmt, f.value)} from ${f.sources.join(", ")}`);
  return (
    <span className={className ? `num ${className}` : "num"} data-q={f.quality} title={QUALITY_TITLE[f.quality]}>
      {format(fmt, f.value)}
    </span>
  );
}

/** Marks a whole item (such as a promise card) as test data. Fails a production build like a test number. */
export function TestMark({ children, what }: { children: React.ReactNode; what: string }) {
  assertRenderable("test", what);
  return (
    <span className="testmark" data-q="test">
      {children}
    </span>
  );
}

/** Num for SVG text. The quality dot next to the label is the visible mark (see BudgetFlow). */
export function NumT({ f, fmt, className }: { f: Figure; fmt: Fmt; className?: string }) {
  assertRenderable(f.quality, `${format(fmt, f.value)} from ${f.sources.join(", ")}`);
  return (
    <tspan className={className} data-q={f.quality}>
      {format(fmt, f.value)}
    </tspan>
  );
}
