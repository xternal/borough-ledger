import type { ReactNode } from "react";

/* The figures behind a chart as plain tables, folded away under it: for screen readers, for copying into a spreadsheet,
   and for anyone who would rather read numbers than shapes. Server-rendered, so it works without JavaScript. */

export interface TableRow {
  key: string;
  /** The first cell names the row; the rest are figures. */
  cells: ReactNode[];
}
export type TableLine = TableRow | { key: string; group: string };

export function ChartTable({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="chart-table">
      <summary>{summary}</summary>
      {children}
    </details>
  );
}

export function DataTable({ caption, head, rows, foot }: { caption: string; head: string[]; rows: TableLine[]; foot?: ReactNode[] }) {
  const num = (i: number) => (i > 0 ? "n" : undefined);
  return (
    <div className="tablewrap">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={num(i)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            "group" in r ? (
              <tr key={r.key} className="group">
                <th scope="rowgroup" colSpan={head.length}>
                  {r.group}
                </th>
              </tr>
            ) : (
              <tr key={r.key}>
                {r.cells.map((c, i) =>
                  i === 0 ? (
                    <th key={i} scope="row">
                      {c}
                    </th>
                  ) : (
                    <td key={i} className="n">
                      {c}
                    </td>
                  ),
                )}
              </tr>
            ),
          )}
        </tbody>
        {foot ? (
          <tfoot>
            <tr>
              {foot.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row">
                    {c}
                  </th>
                ) : (
                  <td key={i} className="n">
                    {c}
                  </td>
                ),
              )}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
