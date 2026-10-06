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
        <a className="mark" href="#top">
          <i aria-hidden="true" />
          Borough Ledger
        </a>
        <nav className="sections" aria-label="Sections">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
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
