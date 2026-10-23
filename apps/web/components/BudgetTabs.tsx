"use client";

import { usePathname } from "next/navigation";
import { BUDGET_PARTS, sectionForPath, sectionHref, sectionLabel } from "@/lib/nav";

/**
 * Budget's parts, as tabs under the top bar on each of their pages: the budget, the gap, Balance it and Payments. The
 * menu highlights Budget on all of them, and the tab says which part you are on (building work and council homes are
 * under the budget itself). Nothing elsewhere.
 */
export function BudgetTabs() {
  const section = sectionForPath(usePathname() ?? "/");
  if (!section || !BUDGET_PARTS.includes(section)) return null;
  return (
    <nav className="tabs" aria-label="Budget">
      {BUDGET_PARTS.map((id) => (
        <a key={id} href={sectionHref(id)} aria-current={id === section ? "page" : undefined}>
          {id === "budget" ? "The budget" : sectionLabel(id)}
        </a>
      ))}
    </nav>
  );
}
