// Phase 6: the pieces of a finished match's report. Server components (no hooks).
import Link from "next/link";
import { Scorecard } from "@/components/Live";
import { oversText } from "@/lib/engine/engine";
import type { MatchState } from "@/lib/engine/types";
import { POM_POINTS, computeMatchStats, matchFigures, oversSummary, partnershipsOf } from "@/lib/stats";

type Common = { m: MatchState; communityId: string | null };   // null = public view: no links into the community

export function PlayerName({ m, id, communityId }: { m: MatchState; id: string; communityId: string | null }) {
  const p = m.players[id];
  if (!p) return <>Player</>;
  return p.userId && communityId ? <Link href={`/c/${communityId}/players/${p.userId}`} style={{ textDecoration: "underline", textDecorationColor: "var(--line)" }}>{p.name}</Link> : <>{p.name}{p.kind === "guest" ? " (guest)" : ""}</>;
}

/** The Player of the Match and the "i" panel that explains, in plain words, how the app chose. */
export function PomCard({ m, communityId }: Common) {
  const { pom, players } = computeMatchStats(m);
  if (!pom) {
    return (
      <section className="card">
        <b>Player of the Match</b>
        <p className="muted small" style={{ margin: "6px 0 0" }}>{m.result?.kind === "abandoned" ? "An abandoned match has no Player of the Match." : "No Player of the Match for this result."}</p>
      </section>
    );
  }
  const winners = players.filter((p) => pom.winners.includes(p.entryId));
  return (
    <section className="card" style={{ borderColor: "var(--gold)" }}>
      <div className="row space">
        <b>Player of the Match{winners.length > 1 ? " (shared)" : ""}</b>
      </div>
      {winners.map((w) => (
        <div key={w.entryId} style={{ marginTop: 8 }}>
          <span style={{ fontSize: "1.2rem", fontWeight: 800 }}><PlayerName m={m} id={w.entryId} communityId={communityId} /></span>
          <span className="muted"> · {w.points} points{m.players[w.entryId]?.kind === "guest" ? " · guest (shown here; not counted in a career unless linked)" : ""}</span>
          <div className="muted small">{(pom.breakdown[w.entryId] ?? []).map((x) => `${x.label} ${x.points > 0 ? "+" : ""}${x.points}`).join(" · ")}</div>
        </div>
      ))}
      <details style={{ marginTop: 10 }}>
        <summary className="chip" style={{ listStyle: "none", cursor: "pointer", display: "inline-flex" }}>ⓘ How the app chose</summary>
        <div className="small" style={{ marginTop: 10, lineHeight: 1.55 }}>
          <p style={{ margin: 0 }}><b>The app adds up points from the balls scored in this match. Nobody picks the winner.</b></p>
          <table className="sc" aria-label="Points">
            <tbody>
              <tr><td>Batting runs</td><td>{POM_POINTS.run} per run</td></tr>
              <tr><td>Boundaries</td><td>+{POM_POINTS.four} per four, +{POM_POINTS.six} per six</td></tr>
              <tr><td>Strike-rate bonus</td><td>6 or more balls faced: 120+ +3, 150+ +6, 200+ +10</td></tr>
              <tr><td>Wickets</td><td>{POM_POINTS.wicket} each (not run-outs)</td></tr>
              <tr><td>Dot balls</td><td>+{POM_POINTS.dot} each</td></tr>
              <tr><td>Maidens</td><td>+{POM_POINTS.maiden} each</td></tr>
              <tr><td>Economy bonus</td><td>1 over or more: 6 or less +6, 4 or less +12</td></tr>
              <tr><td>Fielding</td><td>+{POM_POINTS.fielding} per catch, stumping or run-out</td></tr>
              <tr><td>Winning side</td><td>+{POM_POINTS.win} (+{POM_POINTS.tie} each in a tie)</td></tr>
            </tbody>
          </table>
          <p style={{ margin: "8px 0 4px" }}><b>Top three:</b> {pom.top.map((t, i) => `${i + 1}. ${t.name} ${t.points}`).join(" · ")}</p>
          <p className="muted" style={{ margin: 0 }}>If points are level: the player on the winning side, then more runs, then more wickets, then the better economy. If still level, the award is shared. If the match is corrected later, the award is worked out again by itself.</p>
        </div>
      </details>
    </section>
  );
}

export function SummaryTab({ m, communityId, scorers, createdBy }: Common & { scorers: { name: string; balls: number }[]; createdBy: string | null }) {
  const f = matchFigures(m);
  const regular = m.innings.filter((i) => !i.superOver);
  return (
    <div className="stack">
      {m.result && <div className="banner green" role="status"><b style={{ fontSize: "1.05rem" }}>{m.result.text}</b></div>}
      <section className="card">
        {regular.map((i) => (
          <div key={i.index} className="row space" style={{ padding: "4px 0" }}>
            <b>{m.sides[i.batting - 1]}</b><b>{i.runs}/{i.wickets} <small className="muted">({oversText(i.legalBalls, m.rules.ballsPerOver)} ov)</small></b>
          </div>
        ))}
        <p className="muted small" style={{ margin: "8px 0 0" }}>
          Created by <b style={{ color: "var(--white)" }}>{createdBy ?? "—"}</b>
          {scorers.length > 0 && <> · Scored by <b style={{ color: "var(--white)" }}>{scorers.map((s) => `${s.name} (${s.balls} ball${s.balls === 1 ? "" : "s"})`).join(", ")}</b></>}
        </p>
      </section>
      <PomCard m={m} communityId={communityId} />
      <section className="card">
        <b>Top performers</b>
        <div className="list" style={{ marginTop: 6 }}>
          {f.topBatters.map((p) => {
            const runs = p.bat.reduce((a, b) => a + b.runs, 0), balls = p.bat.reduce((a, b) => a + b.balls, 0);
            return <div key={`b${p.entryId}`} className="item space"><span><PlayerName m={m} id={p.entryId} communityId={communityId} /> <small className="muted">{m.sides[p.side - 1]}</small></span><b>{runs} ({balls})</b></div>;
          })}
          {f.topBowlers.map((p) => {
            const w = p.bowl.reduce((a, b) => a + b.wickets, 0), r = p.bowl.reduce((a, b) => a + b.runs, 0), balls = p.bowl.reduce((a, b) => a + b.balls, 0);
            return <div key={`w${p.entryId}`} className="item space"><span><PlayerName m={m} id={p.entryId} communityId={communityId} /> <small className="muted">{m.sides[p.side - 1]}</small></span><b>{w}/{r} <small className="muted">({oversText(balls, m.rules.ballsPerOver)} ov)</small></b></div>;
          })}
        </div>
      </section>
    </div>
  );
}

export function ScorecardTab({ m, communityId }: Common) {
  return (
    <div className="stack">
      <Scorecard m={m} />
      {m.innings.map((inn) => {
        const parts = partnershipsOf(inn);
        if (!parts.length) return null;
        return (
          <section key={inn.index} className="card">
            <b>Partnerships: {inn.superOver ? "super over" : `innings ${inn.index + 1}`}</b>
            <div className="list" style={{ marginTop: 6 }}>
              {parts.map((p, i) => (
                <div key={i} className="item space">
                  <span><PlayerName m={m} id={p.a} communityId={communityId} />{p.b && <> &amp; <PlayerName m={m} id={p.b} communityId={communityId} /></>}</span>
                  <b>{p.runs} <small className="muted">({p.balls})</small></b>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Every delivery in order, with the over and ball, who bowled to whom and what happened. */
export function BallsTab({ m, communityId, matchId }: Common & { matchId: string }) {
  return (
    <div className="stack">
      {m.innings.map((inn) => (
        <section key={inn.index} className="card">
          <b>{inn.superOver ? "Super over" : `Innings ${inn.index + 1}`}: {m.sides[inn.batting - 1]}</b>
          <div className="list" style={{ marginTop: 6 }}>
            {inn.balls.map((b) => (
              <div key={b.eventId} className="item" style={{ alignItems: "flex-start" }}>
                <span className={`ball${b.wicket ? " w" : b.label === "4" || b.label === "6" ? " four" : /^(Wd|Nb)/.test(b.label) ? " x" : ""}`} style={{ flex: "0 0 auto" }}>{b.label}</span>
                <span className="grow small">{b.text}</span>
                {communityId && <Link href={`/c/${communityId}/matches/${matchId}/correct?ball=${b.eventId}`} className="chip" style={{ minHeight: 30, padding: "0 10px" }}>Correct</Link>}
              </div>
            ))}
            {inn.balls.length === 0 && <div className="item muted">No balls bowled.</div>}
          </div>
        </section>
      ))}
    </div>
  );
}

export function OversTab({ m }: { m: MatchState }) {
  const all = oversSummary(m);
  const max = Math.max(1, ...all.map((o) => o.runs));
  return (
    <div className="stack">
      {m.innings.map((inn) => {
        const overs = all.filter((o) => o.innings === inn.index);
        return (
          <section key={inn.index} className="card">
            <b>{inn.superOver ? "Super over" : `Innings ${inn.index + 1}`}: {m.sides[inn.batting - 1]}</b>
            <div className="list" style={{ marginTop: 6 }}>
              {overs.map((o) => (
                <div key={o.over} className="item" style={{ alignItems: "center" }}>
                  <b style={{ width: 54 }}>Over {o.over + 1}</b>
                  <span className="grow" aria-hidden="true"><span style={{ display: "block", height: 14, borderRadius: 7, width: `${Math.max(4, (o.runs * 100) / max)}%`, background: o.wickets ? "var(--red)" : "var(--blue)" }} /></span>
                  <span className="small" style={{ width: 120, textAlign: "right" }}><b>{o.runs}</b> runs{o.wickets ? `, ${o.wickets} wkt${o.wickets === 1 ? "" : "s"}` : ""}<br /><span className="muted">{m.players[o.bowler]?.name}</span></span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <p className="muted small" style={{ margin: 0 }}>Blue bars are runs in the over. A red bar means a wicket fell.</p>
    </div>
  );
}

export function StatsTab({ m, communityId }: Common) {
  const f = matchFigures(m);
  const regular = m.innings.filter((i) => !i.superOver);
  const bpo = m.rules.ballsPerOver;
  return (
    <div className="stack">
      <section className="card">
        <div className="list">
          {regular.map((i) => <div key={i.index} className="item space"><span className="muted">Run rate, {m.sides[i.batting - 1]}</span><b>{i.legalBalls ? ((i.runs * bpo) / i.legalBalls).toFixed(2) : "0.00"}</b></div>)}
          <div className="item space"><span className="muted">Fours</span><b>{f.fours}</b></div>
          <div className="item space"><span className="muted">Sixes</span><b>{f.sixes}</b></div>
          <div className="item space"><span className="muted">Dot balls</span><b>{f.dotPercent}%</b></div>
          <div className="item space"><span className="muted">Extras</span><b>{f.extras.wide + f.extras.noball + f.extras.bye + f.extras.legbye + f.extras.penalty}</b></div>
        </div>
        <p className="muted small" style={{ margin: "8px 0 0" }}>Wides {f.extras.wide} · no balls {f.extras.noball} · byes {f.extras.bye} · leg-byes {f.extras.legbye}{f.extras.penalty ? ` · penalty ${f.extras.penalty}` : ""}</p>
      </section>
      <section className="card">
        <b>Best partnerships</b>
        <div className="list" style={{ marginTop: 6 }}>
          {f.bestPartnerships.map((p, i) => (
            <div key={i} className="item space"><span><PlayerName m={m} id={p.a} communityId={communityId} />{p.b && <> &amp; <PlayerName m={m} id={p.b} communityId={communityId} /></>}</span><b>{p.runs} <small className="muted">({p.balls})</small></b></div>
          ))}
        </div>
      </section>
      <section className="card">
        <b>Top batters and bowlers</b>
        <div className="list" style={{ marginTop: 6 }}>
          {f.topBatters.map((p) => <div key={`b${p.entryId}`} className="item space"><span><PlayerName m={m} id={p.entryId} communityId={communityId} /></span><b>{p.bat.reduce((a, b) => a + b.runs, 0)} ({p.bat.reduce((a, b) => a + b.balls, 0)})</b></div>)}
          {f.topBowlers.map((p) => <div key={`w${p.entryId}`} className="item space"><span><PlayerName m={m} id={p.entryId} communityId={communityId} /></span><b>{p.bowl.reduce((a, b) => a + b.wickets, 0)}/{p.bowl.reduce((a, b) => a + b.runs, 0)}</b></div>)}
        </div>
      </section>
    </div>
  );
}

export function ChangesTab({ m }: { m: MatchState }) {
  return (
    <section className="card">
      <b>Changes during the match, and corrections after it</b>
      {m.timeline.length === 0 ? <p className="muted small" style={{ margin: "6px 0 0" }}>Nothing was changed.</p> : (
        <ul className="muted small" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
          {m.timeline.map((t, i) => <li key={i}>{t.text}{t.by ? ` (${t.by})` : ""}</li>)}
        </ul>
      )}
    </section>
  );
}
