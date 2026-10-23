"use client";

import { computeBalance, leverValue } from "@borough-ledger/engine";
import { balancePath } from "@/lib/balanceLink";
import { formatLever } from "@/lib/format";
import type { PageModel } from "@/lib/model";
import { useLedger } from "./LedgerState";
import { Num } from "./Num";

/**
 * Balance it on the first screen: next year's council tax rise, at the settings the tool itself marks (a freeze, and
 * the rise the council's forecast assumes), and what is still to find. It shares the page's choices with the full
 * tool further down, and "Open Balance it" carries them to /balance.
 */
export function BalanceCard({ balance, place }: Pick<PageModel, "balance" | "place">) {
  const { scenario, setLever } = useLedger();
  const lever = balance.levers.find((l) => l.id === "ct_rise");
  const r = computeBalance(balance.input, scenario);
  const at = (value: number) => ({ ...balance.computed, value });
  if (!lever) return null;
  const value = leverValue(scenario, lever);
  const settings = [...new Set([...(lever.marks ?? []), lever.base])].sort((a, b) => a - b);
  return (
    <section aria-labelledby="fs-balance-h" className="fs-card fs-dark">
      <div className="fs-head">
        <h2 id="fs-balance-h">Balance next year yourself</h2>
        <span>every choice has its source</span>
      </div>
      <p className="fs-line">
        {place.nextYearLabel} starts with a <Num f={balance.gap} fmt="m1" /> gap in the council&rsquo;s forecast.
      </p>
      <div role="group" aria-label={`${lever.label} in ${place.nextYearLabel}`} className="fs-lever">
        <span>{lever.label}</span>
        <div>
          {settings.map((v) => (
            <button key={v} type="button" aria-pressed={Math.abs(value - v) < 1e-9} onClick={() => setLever("ct_rise", v)}>
              {formatLever("%", v, false)}
              <small>{v === 0 ? "a freeze" : v === balance.ctAssumed?.value ? "as forecast" : ""}</small>
            </button>
          ))}
        </div>
      </div>
      <p className="fs-line" aria-live="polite">
        {r.status === "balanced" ? (
          <b>Balanced</b>
        ) : r.status === "short" ? (
          <>
            Still to find: <b><Num f={at(r.remainingM)} fmt="m1" /></b>
          </>
        ) : (
          <>
            Spare: <b><Num f={at(-r.remainingM)} fmt="m1" /></b>
          </>
        )}
        <span className="fs-quiet"> with the choices on this page</span>
      </p>
      <a className="fs-more" href={balancePath(balance.input, scenario)}>
        Open Balance it, with every choice <span aria-hidden="true">&rarr;</span>
      </a>
    </section>
  );
}
