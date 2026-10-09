"use client";

import { useEffect, useRef } from "react";

/**
 * The ALTCHA proof-of-work check (self-hosted; no cookies, no third party).
 * It runs in the background as soon as the form appears and hands over its
 * payload through `onPayload`.
 */
export function SpamCheck({ onPayload }: { onPayload?: (payload: string | null) => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<{ state: string; payload?: string }>).detail;
      onPayload?.(d.state === "verified" ? (d.payload ?? null) : null);
    };
    import("altcha").then(() => {
      if (cancelled || !el) return;
      el.addEventListener("statechange", onChange);
    });
    return () => {
      cancelled = true;
      el?.removeEventListener("statechange", onChange);
    };
  }, [onPayload]);
  return <altcha-widget ref={ref} challenge="/api/altcha" auto="onload" display="invisible" hidelogo hidefooter name="altcha" />;
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "altcha-widget": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        challenge?: string;
        auto?: string;
        display?: string;
        hidelogo?: boolean;
        hidefooter?: boolean;
        name?: string;
      };
    }
  }
}
