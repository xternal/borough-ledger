"use client";

import { useEffect, useState } from "react";
import { YOUR_WARD_KEY, type YourWard as Ward } from "@/lib/wardFinder";

/** After a postcode in the finder opened this council's page: the ward it found, and a link to its councillors. Kept in
 *  this tab only (sessionStorage); nothing is shown when the ward is in another council or storage is unavailable. */
export function YourWard({ current }: { current: string }) {
  const [ward, setWard] = useState<Ward | null>(null);
  useEffect(() => {
    try {
      const w = JSON.parse(sessionStorage.getItem(YOUR_WARD_KEY) ?? "null") as Ward | null;
      // Read once, after the page has drawn: storage is not there on the server.
      if (w && w.place === current) setWard(w);
    } catch {
      // No storage, or something else in it: show nothing.
    }
  }, [current]);
  if (!ward) return null;
  return (
    <p className="your-ward" role="status">
      Your ward is <b>{ward.name}</b>. <a href={ward.href}>See its councillors and how it voted</a>.
    </p>
  );
}
