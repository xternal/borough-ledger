/* Server-side access to the payments build (etl/payments.py). Read at build time only: every payments page is static. */
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CompaniesFile,
  DATA,
  PaymentSuppliersFile,
  PaymentsMonthFile,
  type Figure,
  type PaymentSupplier,
  type PaymentsMonthFile as MonthFile,
  type RegisteredCompany,
} from "@borough-ledger/schema";

export const PAY = DATA.payments;

function buildDir(): string {
  let d = process.cwd();
  while (!existsSync(join(d, "pnpm-workspace.yaml"))) {
    const up = dirname(d);
    if (up === d) throw new Error("payments: repository root not found");
    d = up;
  }
  return join(d, "data", "build", "payments");
}

const months = new Map<string, MonthFile>();
export function monthFile(month: string): MonthFile {
  let f = months.get(month);
  if (!f) {
    f = PaymentsMonthFile.parse(JSON.parse(readFileSync(join(buildDir(), "months", `${month}.json`), "utf8")));
    months.set(month, f);
  }
  return f;
}

let suppliers: Map<string, PaymentSupplier> | null = null;
export function suppliersById(): Map<string, PaymentSupplier> {
  if (!suppliers) {
    const file = PaymentSuppliersFile.parse(JSON.parse(readFileSync(join(buildDir(), "suppliers.json"), "utf8")));
    suppliers = new Map(file.suppliers.map((s) => [s.id, s]));
  }
  return suppliers;
}

let companies: CompaniesFile | null = null;
/** Suppliers matched to the companies register (etl/companies_house.py). */
export function companiesFile(): CompaniesFile {
  companies ??= CompaniesFile.parse(JSON.parse(readFileSync(join(buildDir(), "..", "companies.json"), "utf8")));
  return companies;
}
export function companyOf(supplierId: string): RegisteredCompany | null {
  return companiesFile().companies[supplierId] ?? null;
}

/** Every amount is the council's own figure from the files named. */
export function payFig(value: number, files: readonly string[]): Figure {
  return { value, quality: PAY.meta.quality, sources: [...files] };
}

/** Service groups come from our mapping of the council's service areas; approx until every line is checked by hand. */
export const GROUP_QUALITY = PAY.meta.group_quality;

export const GROUPS = PAY.groups.map((g) => ({ id: g.id, label: g.label, desc: g.desc, inBudget: g.in_budget }));
export const groupLabel = (id: string) => GROUPS.find((g) => g.id === id)?.label ?? id;

export const MONTHS = PAY.months.map((m) => m.month);
export const LATEST = MONTHS[MONTHS.length - 1]!;

export const KIND_LABEL: Record<PaymentSupplier["kind"], string> = {
  company: "Company",
  public_body: "Public body",
  charity: "Charity or voluntary group",
  other: "Organisation",
};

/** Files that cover a set of months. */
export function filesFor(monthIds: readonly string[]): string[] {
  return [...new Set(PAY.months.filter((m) => monthIds.includes(m.month)).flatMap((m) => m.files))];
}

/**
 * The latest three months in the build, for the home page summary. Uses only the index (bundled with the app):
 * pages rendered on request, such as /balance, cannot read the month or supplier files on Vercel.
 */
export function latestQuarter() {
  const ids = PAY.latest_quarter.months;
  const ms = PAY.months.filter((m) => ids.includes(m.month));
  const files = filesFor(ids);
  const sum = (k: "total" | "rows" | "withheld_total" | "withheld_rows" | "published_total") => ms.reduce((a, m) => a + m[k], 0);
  const top = PAY.latest_quarter.top.map((s) => ({ id: s.id, name: s.name, page: s.page, total: payFig(s.total, files) }));
  return {
    from: ids[0]!,
    to: ids[ids.length - 1]!,
    files,
    total: payFig(sum("total"), files),
    rows: sum("rows"),
    withheld: payFig(sum("withheld_total"), files),
    withheldRows: sum("withheld_rows"),
    top,
  };
}
