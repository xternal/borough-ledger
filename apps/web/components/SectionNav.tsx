"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SECTIONS, isStatementPath, sectionForPath, sectionHref, type SectionId } from "@/lib/nav";

/** A borough page's own sections, on that page: [id, label], each a part of the long page at `base`. */
export type BoroughSections = { base: string; items: readonly (readonly [string, string])[] };

/** The top bar's menu. Highlights the page's section, or on the statement the section in view, and keeps it visible on narrow screens. */
export function SectionNav({ borough }: { borough?: BoroughSections } = {}) {
  const path = usePathname() ?? "/";
  const items = borough ? borough.items : SECTIONS;
  const statement = borough ? path === borough.base : isStatementPath(path);
  const [inView, setInView] = useState<string | null>(null);
  const nav = useRef<HTMLElement>(null);
  const current = statement ? inView : borough ? null : sectionForPath(path);
  const href = (id: string) => (borough ? `${borough.base}#${id}` : sectionHref(id as SectionId));

  // On the statement, follow the section in view: the last one whose top has passed just under the bar.
  useEffect(() => {
    if (!statement) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = 96;
      let found: string | null = null;
      for (const [id] of items) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) found = id;
      }
      // At the very bottom the last short section may never reach the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) found = items[items.length - 1]![0];
      setInView(found);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [statement, items]);

  // Keep the highlighted item visible when the menu scrolls sideways on a phone: straight away once layout and
  // fonts have settled, again if the menu changes size, and smoothly when the section in view changes.
  const first = useRef(true);
  useEffect(() => {
    const n = nav.current;
    if (!n || !current) return;
    const align = (smooth: boolean) => {
      const a = n.querySelector<HTMLAnchorElement>(`a[data-section="${current}"]`);
      if (!a || n.scrollWidth <= n.clientWidth) return;
      const offset = a.getBoundingClientRect().left - n.getBoundingClientRect().left + n.scrollLeft;
      n.scrollTo({ left: offset - (n.clientWidth - a.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" });
    };
    const smooth = !first.current;
    first.current = false;
    const frame = requestAnimationFrame(() => align(smooth));
    let live = true;
    document.fonts?.ready.then(() => live && align(false));
    const ro = new ResizeObserver(() => align(false));
    ro.observe(n);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [current]);

  return (
    <nav className="sections" aria-label="Sections" ref={nav}>
      {items.map(([id, label]) => (
        <a key={id} href={href(id)} data-section={id} aria-current={id === current ? (statement ? "location" : "page") : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}
