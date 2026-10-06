"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Band, LeverId } from "@borough-ledger/schema";
import { defaultScenario, type BalanceInput, type Scenario } from "@borough-ledger/engine";

/** What the resident has chosen. Lives in the browser only; nothing is sent anywhere (docs/PRIVACY.md). */
interface LedgerState {
  band: Band;
  singlePerson: boolean;
  scenario: Scenario;
  setBand: (b: Band) => void;
  setSinglePerson: (v: boolean) => void;
  setLever: (id: LeverId, v: number) => void;
  setToggle: (id: string, on: boolean) => void;
}

const Ctx = createContext<LedgerState | null>(null);

export function LedgerStateProvider({ input, children }: { input: BalanceInput; children: React.ReactNode }) {
  const [band, setBand] = useState<Band>("D");
  const [singlePerson, setSinglePerson] = useState(false);
  const [scenario, setScenario] = useState<Scenario>(() => defaultScenario(input));

  const setLever = useCallback((id: LeverId, v: number) => setScenario((s) => ({ ...s, levers: { ...s.levers, [id]: v } })), []);
  const setToggle = useCallback((id: string, on: boolean) => setScenario((s) => ({ ...s, toggles: { ...s.toggles, [id]: on } })), []);

  const value = useMemo(
    () => ({ band, singlePerson, scenario, setBand, setSinglePerson, setLever, setToggle }),
    [band, singlePerson, scenario, setLever, setToggle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLedger(): LedgerState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLedger outside LedgerStateProvider");
  return v;
}
