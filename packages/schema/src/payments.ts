/* Payments over £500, as built by etl/payments.py into data/build/payments/. */
import { z } from "zod";
import { Quality } from "./quality";

const month = z.string().regex(/^\d{4}-\d{2}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sha = z.string().regex(/^[0-9a-f]{64}$/);

export const PaymentGroup = z.object({
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  /** In the council's day-to-day budget (the budget chart); false for council homes and building projects. */
  in_budget: z.boolean(),
  order: z.number(),
});
export type PaymentGroup = z.infer<typeof PaymentGroup>;

export const PaymentSource = z.object({
  id: z.string(),
  title: z.string(),
  period: z.string(),
  url: z.url(),
  archive_url: z.url().nullable(),
  sha256: sha,
  rows: z.number().int(),
  total: z.number(),
  /** The council's own total row, in files that have one. */
  own_total: z.number().nullable(),
});
export type PaymentSource = z.infer<typeof PaymentSource>;

export const PaymentMonth = z.object({
  month,
  files: z.array(z.string()).min(1),
  rows: z.number().int(),
  total: z.number(),
  published_rows: z.number().int(),
  published_total: z.number(),
  withheld_rows: z.number().int(),
  withheld_total: z.number(),
  by_group: z.record(z.string(), z.number()),
});
export type PaymentMonth = z.infer<typeof PaymentMonth>;

export const PaymentsIndex = z.object({
  meta: z.object({
    generated_by: z.string(),
    publisher: z.string(),
    page: z.url(),
    licence: z.string(),
    quality: Quality,
    /** Service groups come from a mapping table that is approx until a person has checked every line. */
    group_quality: Quality,
    notes: z.array(z.string()),
    mapping: z.object({ lines: z.number().int(), unreviewed: z.number().int(), checked: z.number().int(), unsure: z.number().int() }),
    withheld_rows_by_reason: z.record(z.string(), z.number().int()),
  }),
  sources: z.array(PaymentSource).min(1),
  /** Files the council lists that are not in this build yet. */
  missing: z.array(z.object({ id: z.string(), title: z.string(), url: z.url() })),
  groups: z.array(PaymentGroup),
  months: z.array(PaymentMonth).min(1),
  suppliers: z.object({ count: z.number().int(), with_page: z.number().int() }),
  /** The latest three months and who was paid most in them, for the home page. */
  latest_quarter: z.object({
    months: z.array(month).min(1),
    top: z.array(z.object({ id: z.string(), name: z.string(), page: z.boolean(), total: z.number() })),
  }),
});
export type PaymentsIndex = z.infer<typeof PaymentsIndex>;

/** One month of published rows. Suppliers, areas and types are looked up by index to keep the file small. */
export const PaymentsMonthFile = z.object({
  month,
  files: z.array(z.string()),
  suppliers: z.array(z.string()),
  areas: z.array(z.string()),
  types: z.array(z.string()),
  columns: z.tuple([
    z.literal("date"),
    z.literal("supplier"),
    z.literal("amount"),
    z.literal("group"),
    z.literal("area"),
    z.literal("type"),
    z.literal("reference"),
    z.literal("file"),
    z.literal("row"),
  ]),
  rows: z.array(z.tuple([isoDate, z.number().int(), z.number(), z.string(), z.number().int(), z.number().int(), z.string(), z.number().int(), z.number().int()])),
  /** Payments shown only as totals: redacted by the council, or to someone who looks like a private individual. */
  withheld: z.array(z.object({ group: z.string(), reason: z.enum(["redacted", "person"]), rows: z.number().int(), total: z.number() })),
});
export type PaymentsMonthFile = z.infer<typeof PaymentsMonthFile>;

export const SUPPLIER_KINDS = ["company", "public_body", "charity", "other"] as const;

export const PaymentSupplier = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(SUPPLIER_KINDS),
  /** Supplier pages only for companies, charities and public bodies (docs/PRIVACY.md). */
  page: z.boolean(),
  total: z.number(),
  rows: z.number().int(),
  first: month,
  last: month,
  months: z.record(z.string(), z.number()),
  groups: z.record(z.string(), z.number()),
  top: z.array(z.tuple([isoDate, z.number(), z.string(), z.string()])),
});
export type PaymentSupplier = z.infer<typeof PaymentSupplier>;

export const PaymentSuppliersFile = z.object({
  columns_top: z.tuple([z.literal("date"), z.literal("amount"), z.literal("group"), z.literal("type")]),
  suppliers: z.array(PaymentSupplier),
});
export type PaymentSuppliersFile = z.infer<typeof PaymentSuppliersFile>;

/** Cross-checks that do not need the month files. */
export function checkPayments(p: PaymentsIndex): string[] {
  const problems: string[] = [];
  const groups = new Set(p.groups.map((g) => g.id));
  const files = new Set(p.sources.map((s) => s.id));
  for (const m of p.months) {
    for (const f of m.files) if (!files.has(f)) problems.push(`payments ${m.month}: unknown file ${f}`);
    for (const g of Object.keys(m.by_group)) if (!groups.has(g)) problems.push(`payments ${m.month}: unknown group ${g}`);
    if (Math.abs(m.published_total + m.withheld_total - m.total) > 0.01) problems.push(`payments ${m.month}: published plus withheld is not the total`);
    if (m.published_rows + m.withheld_rows !== m.rows) problems.push(`payments ${m.month}: row counts do not add up`);
  }
  for (const s of p.sources) {
    const ms = p.months.filter((m) => m.files.includes(s.id));
    const total = ms.reduce((a, m) => a + m.total, 0);
    const rows = ms.reduce((a, m) => a + m.rows, 0);
    if (rows !== s.rows || Math.abs(total - s.total) > 0.01) problems.push(`payments ${s.id}: months do not add up to the file`);
    if (s.own_total !== null && Math.abs(s.own_total - s.total) > 0.01) problems.push(`payments ${s.id}: does not match the council's own total`);
  }
  return problems;
}
