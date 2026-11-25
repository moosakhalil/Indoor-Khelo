// The Player of the Series card on the Series page. Server-safe (no hooks): "Points by match" is a plain <details>.
// While the series is open it says "Leading"; once the series is closed the same card is the award.
import Shirt from "@/components/Shirt";
import type { SeriesAward as Award } from "@/lib/seriesAward";

export type AwardView = Award & { final: boolean };

const pts = (n: number) => `${n} point${n === 1 ? "" : "s"}`;
const games = (n: number) => `${n} match${n === 1 ? "" : "es"}`;

export default function SeriesAward({ a }: { a: AwardView }) {
  const shared = a.winners.length > 1;
  const title = a.final ? (shared ? "Players of the Series" : "Player of the Series") : shared ? "Level at the top for Player of the Series" : "Leading for Player of the Series";
  return (
    <section className={`card sr-award${a.final ? " final" : ""}`} aria-label={a.final ? "Player of the Series" : "Player of the Series, so far"}>
      <p className="sr-award-k">{title}</p>
      {a.winners.map((w) => (
        <div className="sr-award-w" key={w.userId}>
          <Shirt number={w.number} size="big" name={w.name} label={`${w.name}${w.number !== null ? `, number ${w.number}` : ""}`} />
          <div className="sr-award-t">
            <b>{w.name}</b>
            <span className="sr-award-pts">{pts(w.points)} in {games(w.matches)}</span>
            <small className="muted">{w.runs} runs · {w.wickets} wicket{w.wickets === 1 ? "" : "s"} · {w.catches} catch{w.catches === 1 ? "" : "es"}</small>
          </div>
          <details className="sr-award-by">
            <summary>Points by match</summary>
            <ul>
              {w.perMatch.map((m, i) => <li key={m.matchId + i}><span>v {m.opponent}</span><b>{m.points}</b></li>)}
            </ul>
          </details>
        </div>
      ))}
      {a.others.length > 0 && (
        <p className="sr-award-next"><span className="muted">Next:</span> {a.others.map((o) => `${o.name} ${o.points}`).join(" · ")}</p>
      )}
      <p className="muted small sr-award-note">
        {a.final ? "Final. " : "Not final until the series is closed. "}
        Adds up each member&rsquo;s Player of the Match points over the {games(a.matchesCounted)} finished in this series. Guests are not counted.
        {shared ? " Equal points share the award." : ""}
      </p>
    </section>
  );
}
