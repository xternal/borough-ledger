"use client";

import { useEffect, useId, useRef } from "react";
import type { PlaceGroup } from "@/lib/boroughList";

/** In this order, except that the group of the place you are on comes first. */
const GROUPS: PlaceGroup[] = ["London boroughs", "Cities"];

/** Which place you are looking at, and the others on the site, London boroughs and cities under their own headings. A
 *  plain disclosure of links, so it works without JavaScript; with it, a click outside or Escape closes it. */
export function BoroughPicker({ current, boroughs }: { current: string; boroughs: { short: string; href: string; group: PlaceGroup }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const id = useId();
  const kind = boroughs.find((b) => b.short === current)?.group === "Cities" ? "City" : "Borough";
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const close = (e: Event) => {
      if (!d.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) {
        d.open = false;
        if (e instanceof KeyboardEvent) d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details className="picker" ref={ref}>
      <summary>
        <span className="picker-k">{kind}</span>
        <span className="picker-v">{current}</span>
        <span className="sr-only">, choose another place</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="picker-panel">
        {(kind === "City" ? [...GROUPS].reverse() : GROUPS).map((g, i) => {
          const items = boroughs.filter((b) => b.group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <p className="picker-h" id={`${id}-g${i}`}>
                {g}
              </p>
              <ul aria-labelledby={`${id}-g${i}`}>
                {items.map((b) => (
                  <li key={b.href}>
                    <a href={b.href} aria-current={b.short === current ? "page" : undefined}>
                      {b.short}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <p className="picker-more">More places are on the way.</p>
      </div>
    </details>
  );
}
