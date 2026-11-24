// Rematch, the left column: both teams, which match this is a rematch of, and a checklist of exactly what is copied.
// Server-rendered (no state). Teams use the initials badge (own team with a gold ring), players use the gold shirt.
import "./sv.css";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import { SvCheck, SvInfo } from "@/components/C2Icons";
import { LINEUP_EMPTY_HINT, LINEUP_HINT, SEPARATE_NOTE, lineupTitle, rulesHint, teamsHint } from "@/lib/c2";
import type { Rules } from "@/lib/matchRules";

export type CopiedPlayer = { name: string; number: number | null; side: 1 | 2; guest: boolean };

function Item({ title, hint }: { title: string; hint?: string }) {
  return (
    <li className="sv-ck">
      <span className="sv-tick" aria-hidden="true"><SvCheck size={14} /></span>
      <span className="sv-cktext"><b>{title}</b>{hint && <small>{hint}</small>}</span>
    </li>
  );
}

export default function RematchCopied({ side1, side2, ofText, venue, overs, rules, playersPerSide, lineup }: {
  side1: { name: string; mine: boolean; permanent: boolean }; side2: { name: string; mine: boolean; permanent: boolean };
  ofText: string; venue: string; overs: number; rules: Rules; playersPerSide: number; lineup: CopiedPlayer[];
}) {
  const sides: [1 | 2, string][] = [[1, side1.name], [2, side2.name]];
  return (
    <section className="sv-copied" aria-label="What is copied">
      <div className="sv-vs">
        <span className={side1.mine ? "sv-mine" : undefined}><TeamBadge name={side1.name} size="lg" /></span>
        <span className="sv-v" aria-hidden="true">v</span>
        <span className={side2.mine ? "sv-mine" : undefined}><TeamBadge name={side2.name} size="lg" /></span>
      </div>
      <h2 className="sv-sumtitle">{side1.name} v {side2.name}</h2>
      <p className="sv-sumsub">{ofText}</p>
      <h3 className="sv-kicker">Copied from the first match</h3>
      <ul className="sv-cklist">
        <Item title="Same two teams" hint={teamsHint(side1.permanent, side2.permanent)} />
        {venue && <Item title="Venue" hint={venue} />}
        <Item title={`${overs} overs and the same rules`} hint={rulesHint(rules, playersPerSide)} />
        <Item title={lineupTitle(lineup.length)} hint={lineup.length ? LINEUP_HINT : LINEUP_EMPTY_HINT} />
      </ul>
      {lineup.length > 0 && (
        <details className="sv-who">
          <summary>See who is copied</summary>
          <p className="sv-help">People who have left the community are skipped.</p>
          <div className="sv-whocols">
            {sides.map(([pos, nm]) => (
              <div key={pos}>
                <h4>{nm}</h4>
                <ul>
                  {lineup.filter((p) => p.side === pos).map((p, i) => (
                    <li key={`${pos}-${i}`}>
                      <Shirt number={p.guest ? null : p.number} size="small" label={p.guest ? "Guest, no player number" : undefined} />
                      <span>{p.name}{p.guest && <small> guest</small>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
      <p className="sv-note"><SvInfo size={16} /><span>{SEPARATE_NOTE}</span></p>
    </section>
  );
}
