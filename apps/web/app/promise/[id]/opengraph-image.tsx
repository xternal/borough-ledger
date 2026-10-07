import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DATA } from "@borough-ledger/schema";
import { format } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { assertRenderable } from "@/lib/quality";

export const alt = "A promise tracked by Borough Ledger";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return DATA.content.promises.map((p) => ({ id: p.id }));
}

const STATUS: Record<string, string> = {
  promised: "Promised",
  in_plan: "In plan",
  budgeted: "Budgeted",
  delivering: "Delivering",
  delivered: "Delivered",
  failed: "Failed",
  quietly_dropped: "Quietly dropped",
  not_in_power: "Opposition pledge",
  unscoreable: "Unscoreable",
};

/** Share image for one card: quote, who, status, the cost per Band D home where known, and who pays. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = buildModel();
  const p = m.promises.find((x) => x.id === id)!;
  const fonts = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
  const [regular, semibold] = await Promise.all([readFile(join(fonts, "Geist-Regular.ttf")), readFile(join(fonts, "Geist-SemiBold.ttf"))]);
  const cost = p.cost ?? p.capital;
  if (cost) assertRenderable(cost.perBandD.quality, `share image for ${id}`);
  const costLine = p.cost
    ? `${format("gbp0", p.cost.perBandD.value)} a year per Band D home`
    : p.capital
      ? `${format("m1", p.capital.central.value)} capital, ${format("gbp0", p.capital.perBandD.value)} once per Band D home`
      : "Cost not stated";
  const quote = p.text.length > 150 ? `${p.text.slice(0, 147)}…` : p.text;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFFFF", color: "#0B0B0D", padding: "60px 80px", fontFamily: "Geist" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 600 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, display: "flex", overflow: "hidden" }}>
              <div style={{ width: "64%", background: "#2457F5" }} />
              <div style={{ width: "36%", background: "#A1A1AA" }} />
            </div>
            Borough Ledger
          </div>
          <div style={{ display: "flex", color: "#61616B" }}>{`${p.actor}, ${p.made_on.slice(0, 4)}`}</div>
        </div>
        <div style={{ display: "flex", fontSize: quote.length > 100 ? 50 : 60, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{`“${quote}”`}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 20, fontSize: 28, alignItems: "center" }}>
            <div style={{ display: "flex", padding: "6px 16px", borderRadius: 999, background: "#F5F5F6", fontWeight: 600 }}>{STATUS[p.status] ?? p.status}</div>
            <div style={{ display: "flex", color: "#0B0B0D" }}>{costLine}</div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#61616B" }}>{`Paid for by: ${p.funded_by ?? "not stated"}`}</div>
          <div style={{ display: "flex", fontSize: 20, color: "#61616B" }}>{`Independent. Not run by or affiliated with ${m.place.short} Council.`}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
