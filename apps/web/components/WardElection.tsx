import { formatDay } from "@/lib/format";
import { ELECTIONS_CREDIT, NUMBER, type ElectionView } from "@/lib/wards";
import { Num } from "./Num";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** How the ward voted at the last borough election. Only the councillors elected are named (CLAUDE.md invariant 6). */
export function WardElection({ name, e }: { name: string; e: ElectionView }) {
  const top = Math.max(...e.candidates.map((c) => c.votes.value));
  const winners = [...new Set(e.candidates.filter((c) => c.councillor).map((c) => c.party))];
  return (
    <section aria-labelledby="vote-h" className="ward-sec">
      <h2 id="vote-h">How {name} voted on {formatDay(e.date)}</h2>
      <p>
        {cap(NUMBER[e.seats] ?? String(e.seats))} seats, {e.candidates.length} candidates. <Num f={e.ballots} fmt="int" /> people voted, a turnout of{" "}
        <Num f={e.turnout} fmt="pct1" />. {winners.length === 1 ? `${winners[0]} won ${e.seats === 2 ? "both" : `all ${NUMBER[e.seats] ?? e.seats}`} seats.` : `The seats went to ${winners.join(" and ")}.`}{" "}
        Each voter could pick up to {NUMBER[e.seats] ?? e.seats} candidates.
      </p>
      <div className="tablewrap votes">
        <table>
          <caption className="sr-only">Votes for each candidate in {name} ward</caption>
          <thead>
            <tr>
              <th scope="col">Party</th>
              <th scope="col" className="n">
                Votes
              </th>
              <th scope="col">Elected</th>
            </tr>
          </thead>
          <tbody>
            {e.candidates.map((c, i) => (
              <tr key={i} className={c.councillor ? "won" : undefined}>
                <th scope="row">{c.partyId ? <a href={`/party/${c.partyId}`}>{c.party}</a> : c.party}</th>
                <td className="n">
                  <span className="vbar" aria-hidden="true" style={{ width: `calc((100% - 80px) * ${(c.votes.value / top).toFixed(3)})` }} />
                  <Num f={c.votes} fmt="int" />
                </td>
                <td>{c.councillor ? <a href={`/councillor/${c.councillor.id}`}>{c.councillor.name}</a> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        <Num f={e.rejected} fmt="int" /> ballot papers were rejected. Results from the{" "}
        <a href={e.resultUrl} rel="noopener">
          council&rsquo;s declaration
        </a>
        , via{" "}
        <a href={e.dcUrl} rel="noopener">
          Democracy Club
        </a>{" "}
        (
        <a href={ELECTIONS_CREDIT.licence_url} rel="license noopener">
          {ELECTIONS_CREDIT.licence}
        </a>
        ). Only the councillors elected are named here; everyone else stood as their party&rsquo;s candidate.
      </p>
    </section>
  );
}
