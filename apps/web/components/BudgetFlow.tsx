import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import { derive, type Figure } from "@borough-ledger/schema";
import type { FlowLine, PageModel, QualityItem } from "@/lib/model";
import { QUALITY_TITLE } from "@/lib/quality";
import { Num, NumT } from "./Num";
import { QualityLegend } from "./QualityLegend";
import { ChartTable, DataTable } from "./ChartTable";

interface FlowNode {
  id: string;
  label: string;
  side: "L" | "M" | "R";
  f?: Figure;
  gap?: boolean;
}
interface FlowLink {
  source: string;
  target: string;
  value: number;
  gap?: boolean;
}

const W = 1000;
const H = 640;
/** Room for labels either side of the flow. */
const LEFT = 300;
const RIGHT = 330;

/** Laid out on the server with d3-sankey and drawn as plain SVG, so it renders without JavaScript. */
function FlowChart({ funding, services, total }: { funding: FlowLine[]; services: FlowLine[]; total: Figure }) {
  // A flow cannot be drawn below zero: a line that brings in more than it costs is named under the chart instead.
  const left: FlowNode[] = funding.filter((x) => x.f.value > 0).map((x) => ({ id: x.id, label: x.label, side: "L", f: x.f, gap: x.gap }));
  const right: FlowNode[] = [...services]
    .filter((x) => x.f.value > 0)
    .sort((a, z) => z.f.value - a.f.value)
    .map((x) => ({ id: x.id, label: x.label, side: "R", f: x.f }));
  const nodes: FlowNode[] = [...left, { id: "pot", label: "Net budget", side: "M" }, ...right];
  const links: FlowLink[] = [
    ...left.map((n) => ({ source: n.id, target: "pot", value: n.f!.value, gap: n.gap })),
    ...right.map((n) => ({ source: "pot", target: n.id, value: n.f!.value })),
  ];
  const g = sankey<FlowNode, FlowLink>()
    .nodeId((d) => d.id)
    .nodeWidth(8)
    .nodePadding(18)
    .nodeSort(null)
    .extent([
      [LEFT, 24],
      [W - RIGHT, H - 10],
    ])({ nodes: nodes.map((d) => ({ ...d })), links: links.map((d) => ({ ...d })) });
  const path = sankeyLinkHorizontal();
  const pot = g.nodes.find((n) => n.id === "pot")!;

  return (
    <svg id="sankey" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flow of council funding into services">
      <defs>
        <pattern id="flow-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" style={{ fill: "var(--gap-soft)" }} />
          <line x1="0" y1="0" x2="0" y2="7" style={{ stroke: "var(--gap)", strokeWidth: 2.2 }} />
        </pattern>
      </defs>
      <g>
        {g.links.map((l, i) => {
          const s = l.source as FlowNode;
          const t = l.target as FlowNode;
          const stroke = l.gap ? "url(#flow-hatch)" : t.id === "pot" ? "var(--fund-soft)" : "var(--spend-soft)";
          return (
            <path key={i} d={path(l) ?? undefined} fill="none" strokeWidth={Math.max(1, l.width ?? 1)} style={{ stroke }}>
              <title>{`${s.label} to ${t.label}`}</title>
            </path>
          );
        })}
      </g>
      <g>
        {g.nodes.map((d) => {
          const x0 = d.x0 ?? 0;
          const x1 = d.x1 ?? 0;
          const y0 = d.y0 ?? 0;
          const y1 = d.y1 ?? 0;
          const fill = d.side === "M" ? "var(--ink)" : d.gap ? "var(--gap)" : d.side === "L" ? "var(--fund)" : "var(--spend)";
          if (d.side === "M" || !d.f) return <rect key={d.id} x={x0} y={y0} width={x1 - x0} height={Math.max(1, y1 - y0)} style={{ fill }} />;
          const L = d.side === "L";
          const x = L ? x0 - 12 : x1 + 12;
          const y = (y0 + y1) / 2;
          const anchor = L ? "end" : "start";
          const small = y1 - y0 < 30;
          return (
            <g key={d.id}>
              <rect x={x0} y={y0} width={x1 - x0} height={Math.max(1, y1 - y0)} style={{ fill }} />
              <circle className={`qdot ${d.f.quality}`} cx={L ? x0 - 5 : x1 + 5} cy={small ? y : y - 6} r={2.5}>
                <title>{QUALITY_TITLE[d.f.quality]}</title>
              </circle>
              {small ? (
                <text x={x} y={y + 4} textAnchor={anchor}>
                  {d.label}
                  <tspan className="v" dx="8">
                    <NumT f={d.f} fmt="m1" />
                  </tspan>
                </text>
              ) : (
                <>
                  <text x={x} y={y - 2} textAnchor={anchor}>
                    {d.label}
                  </text>
                  <text className="v" x={x} y={y + 14} textAnchor={anchor}>
                    <NumT f={d.f} fmt="m1" />, <NumT f={derive(d.f.value / total.value, d.f, total)} fmt="share0" />
                  </text>
                </>
              )}
            </g>
          );
        })}
      </g>
      <text className="mid" x={(pot.x0! + pot.x1!) / 2} y={pot.y0! - 8} textAnchor="middle">
        <NumT f={total} fmt="m0" />
      </text>
    </svg>
  );
}

function RankedRows({ lines, max, kind }: { lines: FlowLine[]; max: number; kind: "fund" | "spend" }) {
  return (
    <div className="rows">
      {lines.map((n) => (
        <div key={n.id} className={`row ${kind === "fund" ? (n.gap ? "gap" : "fund") : ""}`}>
          <span>{n.label}</span>
          <span className="v">
            <Num f={n.f} fmt="m1" />
          </span>
          <div className="track" aria-hidden="true">
            <i style={{ width: `${((n.f.value / max) * 100).toFixed(1)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FlowTable({ caption, lines, total }: { caption: string; lines: FlowLine[]; total: Figure }) {
  return (
    <DataTable
      caption={caption}
      head={["", "£m", "Share of the net budget"]}
      rows={lines.map((l) => ({
        key: l.id,
        cells: [
          l.gap ? `${l.label} (one-off)` : l.label,
          <Num key="m" f={l.f} fmt="m1" />,
          <Num key="s" f={derive(l.f.value / total.value, l.f, total)} fmt="share1" />,
        ],
      }))}
      foot={["Net budget", <Num key="m" f={total} fmt="m1" />, "100%"]}
    />
  );
}

/** Any borough's budget. `more` is what follows the chart on that borough's page. */
export function BudgetFlow({ m, legend, more }: { m: Pick<PageModel, "funding" | "services" | "netBudget" | "place">; legend: QualityItem[]; more?: React.ReactNode }) {
  const services = [...m.services].sort((a, z) => z.f.value - a.f.value);
  const below = [...m.funding, ...m.services].filter((l) => l.f.value <= 0 && Math.abs(l.f.value) >= 0.05);
  const max = Math.max(...m.funding.map((x) => x.f.value), ...services.map((x) => x.f.value));
  return (
    <section id="budget" aria-labelledby="budget-h">
      <div className="sec-head">
        <h2 id="budget-h">The council&rsquo;s budget</h2>
        <p>
          What the council spends on day-to-day services after fees and charges, and where the money comes from
          {m.funding.some((f) => f.ringFencedTo)
            ? ", including grants that can only be spent on schools or public health"
            : m.funding.some((f) => f.id === "specific_grants")
              ? ", including specific grants, which the return does not tie to particular services"
              : "; grants tied to a particular service are already taken off it"}
          . It must balance by law.
        </p>
      </div>
      <div className="flow-head">
        <div className="legend">
          <span>
            <i style={{ background: "var(--fund)" }} />
            Funding
          </span>
          <span>
            <i style={{ background: "var(--gap)" }} />
            Reserves (one-off)
          </span>
          <span>
            <i style={{ background: "var(--spend)" }} />
            Services
          </span>
        </div>
      </div>
      <div className="flow-desktop">
        <FlowChart funding={m.funding} services={m.services} total={m.netBudget} />
        {below.length ? (
          <p className="small muted">
            Not drawn in the flow, because they are below zero:{" "}
            {below.map((l, i) => (
              <span key={l.id}>
                {i ? ", " : ""}
                {/* A draw on reserves below zero is money put into them (Edinburgh's surplus, Leeds): said that way round. */}
                {/^Drawn from /.test(l.label) ? (
                  <>
                    {l.label.replace(/^Drawn from /, "Put into ")} (<Num f={derive(-l.f.value, l.f)} fmt="m1" />)
                  </>
                ) : (
                  <>
                    {l.label} (<Num f={l.f} fmt="m1" />)
                  </>
                )}
              </span>
            ))}
            . They are in the tables.
          </p>
        ) : null}
        <ChartTable summary="Show the budget as a table">
          <FlowTable caption={`Where the money comes from, ${m.place.yearLabel}`} lines={m.funding} total={m.netBudget} />
          <FlowTable caption={`What it pays for, ${m.place.yearLabel}`} lines={services} total={m.netBudget} />
        </ChartTable>
      </div>
      <div className="flow-mobile">
        <div>
          <h3>Where the money comes from</h3>
          <RankedRows lines={m.funding} max={max} kind="fund" />
        </div>
        <div className="totalrow">
          <span>Net budget</span>
          <span>
            <Num f={m.netBudget} fmt="m1" />
          </span>
        </div>
        <div>
          <h3>What it pays for</h3>
          <RankedRows lines={services} max={max} kind="spend" />
        </div>
      </div>
      <QualityLegend items={legend} />
      {more}
    </section>
  );
}
