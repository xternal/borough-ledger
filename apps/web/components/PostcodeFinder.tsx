"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { lookupPlace, type FinderPlace, type PlaceLookup } from "@/lib/wardFinder";

/** Postcode to ward, in any borough on the site. The lookup runs in the browser against postcodes.io; the postcode
 *  never reaches us or the address bar (docs/PRIVACY.md). */
export function PostcodeFinder({ places, covered, example, compact = false }: { places: FinderPlace[]; covered: string; example: string; compact?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlaceLookup | null>(null);

  const message = (r: PlaceLookup) => {
    switch (r.kind) {
      case "ward":
        return `${r.postcode} is in ${r.name} ward, ${r.place}. Opening it…`;
      case "council":
        return `${r.postcode} is in ${r.place}. Opening its page…`;
      case "elsewhere":
        return `${r.postcode} is in ${r.district}. Borough Book covers ${covered} so far.`;
      case "invalid":
        return `That does not look like a full postcode, such as ${example}.`;
      case "not_found":
        return "We could not find that postcode. Check it and try again.";
      case "error":
        return "The postcode service did not answer. Try again in a moment.";
    }
  };

  return (
    <form
      className={compact ? "finder finder-compact" : "finder"}
      role="search"
      aria-label="Find your ward by postcode"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await lookupPlace(value, places);
        setResult(r);
        setBusy(false);
        if (r.kind === "ward" || r.kind === "council") router.push(r.href);
      }}
    >
      <label htmlFor={`${id}-pc`}>Find your ward and councillors</label>
      <div className="finder-row">
        <input
          id={`${id}-pc`}
          name="postcode"
          type="text"
          autoComplete="postal-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={`Postcode, such as ${example}`}
          maxLength={10}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null);
          }}
          aria-describedby={`${id}-msg ${id}-note`}
        />
        <button type="submit" className="btn" aria-disabled={busy || undefined} disabled={busy}>
          {busy ? "Finding…" : "Find"}
        </button>
      </div>
      <p id={`${id}-msg`} className={result && result.kind !== "ward" && result.kind !== "council" ? "finder-msg warn" : "finder-msg"} aria-live="polite">
        {result ? message(result) : null}
      </p>
      <p id={`${id}-note`} className="finder-note">
        Looked up in your browser with postcodes.io. We never see your postcode.
      </p>
    </form>
  );
}
