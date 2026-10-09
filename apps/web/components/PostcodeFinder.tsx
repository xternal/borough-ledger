"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { YOUR_WARD_KEY, lookupPlace, type FinderPlace, type PlaceLookup, type YourWard } from "@/lib/wardFinder";

/** Postcode to ward, in any borough on the site. The lookup runs in the browser against postcodes.io; the postcode
 *  never reaches us or the address bar (docs/PRIVACY.md). On a council's page (here), a postcode in another council opens
 *  that council's page at the top, and the ward it found is kept for this tab so the page can say "your ward"; a postcode
 *  in this council opens its ward. */
export function PostcodeFinder({
  places,
  covered,
  example,
  compact = false,
  here,
  label = "Find your ward and councillors",
}: {
  places: FinderPlace[];
  covered: string;
  example: string;
  compact?: boolean;
  here?: string;
  label?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlaceLookup | null>(null);

  const elsewhere = (r: PlaceLookup): r is Extract<PlaceLookup, { kind: "ward" }> & { placeHref: string } =>
    r.kind === "ward" && !!here && r.place !== here && !!r.placeHref;
  const message = (r: PlaceLookup) => {
    switch (r.kind) {
      case "ward":
        return `${r.postcode} is in ${r.name} ${r.word ?? "ward"}, ${r.place}. Opening ${elsewhere(r) ? r.place : "it"}…`;
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
        if (elsewhere(r)) {
          try {
            sessionStorage.setItem(YOUR_WARD_KEY, JSON.stringify({ place: r.place, name: r.name, href: r.href, ...(r.word ? { word: r.word } : {}) } satisfies YourWard));
          } catch {
            // No storage (a private window): the page opens without the "your ward" line.
          }
          router.push(r.placeHref);
        } else if (r.kind === "ward" || r.kind === "council") router.push(r.href);
      }}
    >
      <label htmlFor={`${id}-pc`}>{label}</label>
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
