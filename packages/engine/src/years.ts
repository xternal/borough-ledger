const FIN_YEAR = /^(\d{4})-(\d{2})$/;

function parse(year: string): number {
  const m = FIN_YEAR.exec(year);
  if (!m) throw new Error(`not a financial year: ${year}`);
  const start = Number(m[1]);
  if ((start + 1) % 100 !== Number(m[2])) throw new Error(`not a financial year: ${year}`);
  return start;
}

/** "2027-28" → "2028-29" */
export function nextFinancialYear(year: string): string {
  const s = parse(year) + 1;
  return `${s}-${String((s + 1) % 100).padStart(2, "0")}`;
}

/** "2027-28" → "2027/28", the form residents see on bills. */
export function displayYear(year: string): string {
  parse(year);
  return year.replace("-", "/");
}
