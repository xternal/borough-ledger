"use client";

import { useEffect, useRef } from "react";

/** Which borough you are looking at, and the others on the site. A plain disclosure of links, so it works without
 *  JavaScript; with it, a click outside or Escape closes it. */
export function BoroughPicker({ current, boroughs }: { current: string; boroughs: { short: string; href: string }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
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
        <span className="picker-k">Borough</span>
        <span className="picker-v">{current}</span>
        <span className="sr-only">, choose another borough</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <ul>
        {boroughs.map((b) => (
          <li key={b.href}>
            <a href={b.href} aria-current={b.short === current ? "page" : undefined}>
              {b.short}
            </a>
          </li>
        ))}
        <li className="picker-more">More London boroughs are on the way.</li>
      </ul>
    </details>
  );
}
