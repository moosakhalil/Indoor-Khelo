// Phase D2 (UI redesign): the broadcast-style live view for people who are not scoring. No hooks, so the server draws it.
// The older `LiveScore` and `Scorecard` in Live.tsx stay exactly as they were (the scoring pad and the match page use them);
// this file adds the new score bug, the crease strips, the over strip, the stats and the new scorecard cards.
import { bowlerAllowance, currentInnings, dismissalText, economy, oversText, requiredRate, runRate, strikeRate, totalExtras } from "@/lib/engine/engine";
import type { InningsState, MatchState } from "@/lib/engine/types";
import { ballKind, bugView, srText } from "@/lib/liveView";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import { IconRefresh } from "@/components/LvIcons";
import "./lv.css";

const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);
const nameOf = (m: MatchState, id: string | null) => (id ? m.players[id]?.name ?? "Player" : "");
const numOf = (m: MatchState, id: string | null) => (id ? m.players[id]?.number ?? null : null);

/** The green "Auto-updating" chip for the top bar (orange "Paused" while the match is paused: the page still refreshes, so a resume shows up). */
export function AutoChip({ paused = false }: { paused?: boolean }) {
  return (
    <span className={`lv-auto${paused ? " paused" : ""}`} role="status">
      <span className="lv-dot" aria-hidden="true" />
      {paused ? "Paused" : <span>Auto<span className="lv-auto-long">-updating</span></span>}
    </span>
  );
}

/** The score bug: both teams with badges, big scores, overs, the chase sentence. */
export function LiveBug({ m, venue, paused = false, auto = true }: { m: MatchState; venue?: string; paused?: boolean; auto?: boolean }) {
  const v = bugView(m);
  if (!v) return null;
  const meta = venue ? `${v.heading} · ${venue}` : v.heading;
  return (
    <section className="lv-bug" aria-label="Score">
      <div className="lv-bug-top">
        {paused
          ? <span className="lv-state paused">PAUSED<span className="lv-sr"> Match paused</span></span>
          : <span className="lv-state live"><span className="lv-dot" aria-hidden="true" />LIVE</span>}
        <div className="lv-meta">{meta}</div>
        {auto && <span className="lv-auto" role="status"><IconRefresh size={14} /><span className="lv-sr">Updates by itself</span><span aria-hidden="true">Auto</span></span>}
      </div>
      {v.rows.map((r) => (
        <div key={`${r.side}-${r.runs}-${r.name}`} className={`lv-row ${r.current ? "on" : "off"}`}>
          <span className="lv-tb"><TeamBadge name={r.name} size="md" /></span>
          <span className="lv-tn">{r.name}</span>
          <span className="lv-score" aria-label={`${r.name} ${r.runs} for ${r.wickets}`}>{r.runs}/{r.wickets}<small>{r.overs}</small></span>
        </div>
      ))}
      <p className={`lv-line${v.isResult ? " ok" : ""}`} role="status">{v.line}</p>
    </section>
  );
}

function Strip({ m, id, sub, value, extra, star }: { m: MatchState; id: string | null; sub: string; value?: React.ReactNode; extra?: React.ReactNode; star?: boolean }) {
  return (
    <div className="lv-strip">
      <Shirt number={numOf(m, id)} size="small" label={numOf(m, id) !== null ? `${nameOf(m, id)}, number ${numOf(m, id)}` : `${nameOf(m, id)}, no player number`} />
      <span className="lv-who"><b>{star && <><span className="lv-star" aria-hidden="true">★</span><span className="lv-sr">At the crease: </span> </>}{nameOf(m, id)}</b><small>{sub}</small></span>
      {value}
      {extra}
    </div>
  );
}

/** Striker (star), non-striker and bowler as three strips. */
export function LiveStrips({ m, inn }: { m: MatchState; inn?: InningsState }) {
  const cur = inn ?? currentInnings(m);
  if (!cur) return null;
  const bpo = m.rules.ballsPerOver;
  const strike = cur.striker ? cur.batters[cur.striker] : null;
  const non = cur.nonStriker ? cur.batters[cur.nonStriker] : null;
  const bowler = cur.bowler ? cur.bowlers[cur.bowler] : null;
  const left = cur.bowler ? bowlerAllowance(m, cur, cur.bowler) : null;
  const val = (b: { runs: number; balls: number } | null | undefined) => <span className="lv-val">{b?.runs ?? 0}<small> ({b?.balls ?? 0})</small></span>;
  return (
    <div className="lv-col" aria-label="At the crease">
      {cur.striker && <Strip m={m} id={cur.striker} star sub={`Striker · ${srText(strike)}`} value={val(strike)} />}
      {cur.nonStriker && <Strip m={m} id={cur.nonStriker} sub="Non-striker" value={val(non)} />}
      {cur.needBatter ? <div className="lv-strip need">Next batter needed</div>
        : !cur.nonStriker && cur.striker ? <div className="lv-strip need">Batting alone</div> : null}
      {cur.needBowler ? <div className="lv-strip need">New bowler needed</div> : (
        <Strip
          m={m} id={cur.bowler}
          sub={`Bowler · ${bowler ? `${oversText(bowler.legalBalls, bpo)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : "0.0-0-0-0"}`}
          extra={left !== null ? <span className={`lv-lim${left === 0 ? " zero" : ""}`}>{left} {left === 1 ? "OVER" : "OVERS"} LEFT</span> : null}
        />
      )}
    </div>
  );
}

/** This over: bubbles with the letters W, Wd, Nb, 4, 6; dashed empty slots for the balls still to come; "Ball 3 of 6". */
export function OverStrip({ m, inn }: { m: MatchState; inn?: InningsState }) {
  const cur = inn ?? currentInnings(m);
  if (!cur) return null;
  const bpo = m.rules.ballsPerOver;
  const counted = cur.overBalls.filter((b) => b.counted).length;
  const empties = cur.ended || cur.needBowler ? 0 : Math.max(0, bpo - counted);
  return (
    <section className="lv-over" aria-label="This over">
      <div className="lv-over-head"><span>This over</span>{!cur.ended && !cur.needBowler && <span>Ball {Math.min(counted + 1, bpo)} of {bpo}</span>}</div>
      <div className="lv-over-balls">
        {cur.overBalls.map((b) => <span key={b.eventId} className={`lv-b ${ballKind(b)}`}>{b.label}</span>)}
        {Array.from({ length: empties }, (_, i) => <span key={`e${i}`} className="lv-b empty" aria-hidden="true" />)}
        {cur.overBalls.length === 0 && empties === 0 && <span className="muted small">No balls yet</span>}
      </div>
    </section>
  );
}

/** Partnership, last wicket, run rate, required rate, the chase bar, and who scored. */
export function LiveStats({ m, scoredBy }: { m: MatchState; scoredBy?: string[] }) {
  const cur = currentInnings(m);
  const v = bugView(m);
  if (!cur || !v) return null;
  const bpo = m.rules.ballsPerOver;
  const last = cur.fow[cur.fow.length - 1];
  const rrr = requiredRate(cur, bpo);
  return (
    <section className="lv-stats" aria-label="Match numbers">
      <div className="lv-stat"><span>Partnership</span><b>{cur.partnership.runs} ({cur.partnership.balls})</b></div>
      {last && <div className="lv-stat"><span>Last wicket</span><b>{nameOf(m, last.player)} {last.runs}/{last.n}</b></div>}
      <div className="lv-stat"><span>Run rate</span><b>{f2(runRate(cur, bpo))}</b></div>
      {rrr !== null && !cur.ended && <div className="lv-stat"><span>Required rate</span><b>{f2(rrr)}</b></div>}
      {v.progress && (
        <div className="lv-prog">
          <div className="lv-prog-l"><span>{v.progress.have} of {v.progress.of} needed{v.progress.revised ? " (revised target)" : ""}</span><span>{v.progress.pct}%</span></div>
          <div className="lv-bar" role="progressbar" aria-label="Chase progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.progress.pct}><i style={{ width: `${v.progress.pct}%` }} /></div>
        </div>
      )}
      {scoredBy && scoredBy.length > 0 && <div className="lv-stat"><span>Scored by</span><b style={{ fontFamily: "inherit" }}>{scoredBy.join(", ")}</b></div>}
    </section>
  );
}

/** Before the first ball, or between innings before the next one starts: the two teams and one sentence. */
export function LiveIdle({ sides, text }: { sides: [string, string]; text: string }) {
  return (
    <section className="lv-idle" aria-label="Match">
      <div className="lv-idle-sides">
        <span className="lv-idle-side"><TeamBadge name={sides[0]} size="lg" /><b>{sides[0]}</b></span>
        <span className="lv-v" aria-hidden="true">v</span>
        <span className="lv-idle-side"><TeamBadge name={sides[1]} size="lg" /><b>{sides[1]}</b></span>
      </div>
      <p className="muted small" role="status">{text}</p>
    </section>
  );
}

/** Everything above the gate: free hit, score bug, crease strips, this over, stats. Falls back to the idle card. */
export default function LiveView({ m, sides, venue, paused = false, auto = true, scoredBy }: {
  m: MatchState | null; sides: [string, string]; venue?: string; paused?: boolean; auto?: boolean; scoredBy?: string[];
}) {
  const cur = m ? currentInnings(m) : null;
  if (!m || !m.started || !cur) {
    return <LiveIdle sides={sides} text={m?.started ? "Waiting for the innings to start" : "The match has not started yet"} />;
  }
  return (
    <>
      {cur.freeHit && !cur.ended && (
        <div className="lv-freehit" role="status"><b>FREE HIT</b><small>Only Run Out is allowed on this ball</small></div>
      )}
      <LiveBug m={m} venue={venue} paused={paused || m.paused} auto={auto} />
      <LiveStrips m={m} inn={cur} />
      <OverStrip m={m} inn={cur} />
      <LiveStats m={m} scoredBy={scoredBy} />
    </>
  );
}

/** The full scorecard as cards: batting, extras, did not bat, fall of wickets, bowling, and the timeline. Same facts as the old `Scorecard`. */
export function ScorecardView({ m }: { m: MatchState }) {
  if (!m.started) return null;
  const bpo = m.rules.ballsPerOver;
  return (
    <div className="lv-col">
      {m.result && <div className="banner green" role="status"><b>{m.result.text}</b></div>}
      {m.innings.map((inn) => {
        const batted = Object.values(inn.batters).sort((a, b) => a.order - b.order);
        const dnb = Object.values(m.players).filter((p) => p.side === inn.batting && !inn.batters[p.id] && !m.gone[p.id]);
        const bowlers = Object.values(inn.bowlers);
        const team = m.sides[inn.batting - 1];
        const name = inn.superOver ? `Super over: ${team}` : `${team}, innings ${inn.index + 1}`;
        return (
          <section key={inn.index} className="lv-sc" aria-label={name}>
            <div className="lv-sc-head">
              <span className="lv-tb"><TeamBadge name={team} size="md" /></span>
              <span className="lv-sct"><small>{inn.superOver ? "Super over" : `Innings ${inn.index + 1}`}</small><b>{team}</b></span>
              <span className="lv-sctot"><b>{inn.runs}/{inn.wickets}</b><small>{oversText(inn.legalBalls, bpo)} ov · RR {f2(runRate(inn, bpo))}</small></span>
            </div>
            <table className="lv-t" aria-label={`${name} batting`}>
              <thead><tr><th scope="col">Batter</th><th scope="col">R</th><th scope="col">B</th><th scope="col">4s</th><th scope="col">6s</th><th scope="col">SR</th></tr></thead>
              <tbody>
                {batted.map((b) => (
                  <tr key={b.id}>
                    <td><b>{nameOf(m, b.id)}{b.status === "batting" && <span className="lv-star" aria-hidden="true"> *</span>}{m.players[b.id]?.kind === "guest" && <small style={{ display: "inline", marginLeft: 4 }}> (guest)</small>}</b><small>{dismissalText(m, b)}</small></td>
                    <td>{b.runs}</td><td>{b.balls}</td><td>{b.fours}</td><td>{b.sixes}</td><td>{f1(strikeRate(b))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lv-ext">
              <b>Extras {totalExtras(inn)}</b> (wides {inn.extras.wide}, no balls {inn.extras.noball}, byes {inn.extras.bye}, leg-byes {inn.extras.legbye}{inn.extras.penalty ? `, penalty ${inn.extras.penalty}` : ""})
              {dnb.length > 0 && <><br />Did not bat: {dnb.map((p) => p.name).join(", ")}</>}
            </p>
            {inn.fow.length > 0 && (
              <>
                <h3 className="lv-fow-h">Fall of wickets</h3>
                <ul className="lv-fow">{inn.fow.map((w) => <li key={w.n}><b>{w.n}-{w.runs}</b> {nameOf(m, w.player)} · {w.over} ov</li>)}</ul>
              </>
            )}
            <table className="lv-t" aria-label={`${name} bowling`}>
              <thead><tr><th scope="col">Bowler</th><th scope="col">O</th><th scope="col">M</th><th scope="col">R</th><th scope="col">W</th><th scope="col">Econ</th></tr></thead>
              <tbody>
                {bowlers.map((b) => (
                  <tr key={b.id}>
                    <td><b>{nameOf(m, b.id)}{m.players[b.id]?.kind === "guest" && <small style={{ display: "inline", marginLeft: 4 }}> (guest)</small>}</b></td>
                    <td>{oversText(b.legalBalls, bpo)}</td><td>{b.maidens}</td><td>{b.runs}</td><td className={b.wickets > 0 ? "hi" : ""}>{b.wickets}</td><td>{f1(economy(b, bpo))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      {m.timeline.length > 0 && (
        <section className="lv-tl">
          <b>Timeline</b>
          <ul>{m.timeline.map((t, i) => <li key={i}>{t.text}{t.by ? ` (${t.by})` : ""}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
