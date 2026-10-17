import { sectionHref, sectionLabel, type SectionId } from "@/lib/nav";

/**
 * Where a section is shown. "overview": on the home page, where its heading links to the section's own page. "own": on
 * that page, where its heading is the page's. Unset: anywhere else (another council's page), a plain heading.
 */
export type SectionView = "overview" | "own";

/** A section's heading: the page's h1 on its own page, an h2 elsewhere, with a link to its own page on the overview. */
export function SecTitle({ id, section, view, children }: { id: string; section: SectionId; view?: SectionView; children: React.ReactNode }) {
  if (view === "own") return <h1 id={id}>{children}</h1>;
  if (view !== "overview") return <h2 id={id}>{children}</h2>;
  return (
    <div className="sec-title">
      <h2 id={id}>{children}</h2>
      <a className="sec-own" href={sectionHref(section)}>
        Open on its own page<span className="sr-only">: {sectionLabel(section)}</span>
      </a>
    </div>
  );
}
