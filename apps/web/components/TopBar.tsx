import { STAGE } from "@/lib/site";
const SECTIONS = [
  ["bill", "Your bill"],
  ["budget", "Budget"],
  ["gap", "The gap"],
  ["balance", "Balance it"],
  ["promises", "Promises"],
  ["payments", "Payments"],
  ["method", "Method"],
] as const;

export function TopBar({ place, year }: { place: string; year: string }) {
  return (
    <header className="topbar">
      <div className="bar-in">
        <a className="mark" href="/">
          <i aria-hidden="true" />
          Borough Ledger
          <span className="stage" title="Early version: figures are sourced, but editors are still checking promise cards and service groups">
            {STAGE}
          </span>
        </a>
        <nav className="sections" aria-label="Sections">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={id === "promises" || id === "payments" ? `/${id}` : `/#${id}`}>
              {label}
            </a>
          ))}
        </nav>
        <span className="ctx">
          {place}, {year}
        </span>
      </div>
    </header>
  );
}
