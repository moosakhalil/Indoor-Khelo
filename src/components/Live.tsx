// Phase 5: the live score and the full scorecard, drawn from the engine's state. No hooks, so the server (for spectators)
// and the phone (for the scorer) draw exactly the same thing.
import {
  bowlerAllowance, currentInnings, dismissalText, economy, effectiveTarget, oversText, requiredRate, runRate, strikeRate, totalExtras,
} from "@/lib/engine/engine";
import type { InningsState, MatchState } from "@/lib/engine/types";

const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

function nameOf(m: MatchState, id: string | null) {
  return id ? m.players[id]?.name ?? "Player" : "";
}

export function inningsTitle(m: MatchState, inn: InningsState) {
  return inn.superOver ? `Super over: ${m.sides[inn.batting - 1]}` : `${m.sides[inn.batting - 1]}, innings ${inn.index + 1}`;
}

/** Everything a spectator or the scorer needs at a glance. `onBall` (scorer only) makes each ball in the strip tappable to edit it. */
export function LiveScore({ m, onBall }: { m: MatchState; onBall?: (eventId: string) => void }) {
  const inn = currentInnings(m);
  if (!m.started || !inn) {
    return (
      <section className="card center">
        <b>{m.started ? "Waiting for the innings to start" : "The match has not started yet"}</b>
        {m.started && <p className="muted small" style={{ margin: "6px 0 0" }}>{m.sides[0]} v {m.sides[1]}</p>}
      </section>
    );
  }
  const bpo = m.rules.ballsPerOver;
  const target = effectiveTarget(inn);
  const ballsLeft = inn.maxOvers * bpo - inn.legalBalls;
  const need = target !== null ? Math.max(0, target - inn.runs) : null;
  const rrr = requiredRate(inn, bpo);
  const bowler = inn.bowler ? inn.bowlers[inn.bowler] : null;
  const left = inn.bowler ? bowlerAllowance(m, inn, inn.bowler) : null;
  const counted = inn.overBalls.filter((b) => b.counted).length;
  const empties = inn.ended || inn.needBowler ? 0 : Math.max(0, bpo - counted);
  const strike = inn.striker ? inn.batters[inn.striker] : null;
  const non = inn.nonStriker ? inn.batters[inn.nonStriker] : null;
  const ballClass = (b: { wicket: boolean; label: string }) => (b.wicket ? " w" : b.label === "6" || b.label === "4" ? " four" : /^(Wd|Nb)/.test(b.label) ? " x" : "");
  return (
    <>
      {inn.freeHit && !inn.ended && (
        <div className="freehit" role="status"><b>FREE HIT</b><small>Only Run Out is allowed on this ball</small></div>
      )}
      <section className="live">
        <div className="live-head">
          <div className="live-left">
            <div className="live-score" aria-label={`${inn.runs} for ${inn.wickets}`}>{inn.runs}<span>/{inn.wickets}</span></div>
            <div className="live-ov"><b>{oversText(inn.legalBalls, bpo)}</b><small className="muted">of {inn.maxOvers} overs</small></div>
          </div>
          <div className="live-side">
            {target === null || inn.ended ? (
              <>
                <b>{m.sides[inn.batting - 1]} {inn.ended ? "innings over" : "batting"}</b>
                <small className="muted" style={{ display: "block" }}>Run rate {f2(runRate(inn, bpo))}</small>
              </>
            ) : (
              <>
                <b>Target {target}{inn.manualTarget !== null ? " (revised)" : ""}</b>
                <b className="need" style={{ display: "block" }}>Need {need} from {Math.max(0, ballsLeft)}</b>
                <small className="muted" style={{ display: "block" }}>RR {f2(runRate(inn, bpo))}{rrr !== null ? ` · RRR ${f2(rrr)}` : ""}</small>
              </>
            )}
            <small className="muted" style={{ display: "block" }}>{inningsTitle(m, inn)}</small>
          </div>
        </div>
        {m.paused && <div className="banner mute" style={{ textAlign: "center", margin: "8px 0 0" }}>Match paused</div>}
        <div className="live-div" />
        <div className="live-bat">
          {inn.needBatter && !strike && !non ? <span className="muted">Next batter needed</span> : (
            <>
              <span className="grow"><span className="star" aria-hidden="true">★</span> <b>{nameOf(m, inn.striker)}</b> <b className="n">{strike?.runs ?? 0}</b><small className="muted"> ({strike?.balls ?? 0})</small></span>
              {inn.nonStriker ? (
                <span className="muted">{nameOf(m, inn.nonStriker)} {non?.runs ?? 0} ({non?.balls ?? 0})</span>
              ) : inn.needBatter ? <span className="muted">Next batter needed</span> : <span className="chip" style={{ minHeight: 26, padding: "0 10px" }}>Batting alone</span>}
            </>
          )}
        </div>
        <div className="live-bowl">
          {inn.needBowler ? <span className="muted">New bowler needed</span> : (
            <>
              <span className="grow muted">Bowler <b style={{ color: "var(--white)" }}>{nameOf(m, inn.bowler)}</b> {bowler ? `${oversText(bowler.legalBalls, bpo)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : "0.0-0-0-0"}</span>
              {left !== null && <span className={`pill ${left === 0 ? "orange" : "green"}`}>{left} {left === 1 ? "OVER" : "OVERS"} LEFT</span>}
            </>
          )}
        </div>
        <div className="live-over" aria-label="This over">
          {inn.overBalls.map((b) => {
            const cls = `ball${ballClass(b)}`;
            return onBall
              ? <button key={b.eventId} className={cls} aria-label={`Edit ball ${b.label}`} onClick={() => onBall(b.eventId)}>{b.label}</button>
              : <span key={b.eventId} className={cls}>{b.label}</span>;
          })}
          {Array.from({ length: empties }, (_, i) => <span key={`e${i}`} className="ball empty" aria-hidden="true" />)}
          {!inn.ended && !inn.needBowler && <b className="ball-of">Ball {Math.min(counted + 1, bpo)} of {bpo}</b>}
        </div>
        <small className="muted" style={{ display: "block", marginTop: 6 }}>
          Partnership {inn.partnership.runs} ({inn.partnership.balls}){inn.fow.length > 0 && <> · Last wicket {nameOf(m, inn.fow[inn.fow.length - 1]!.player)} {inn.fow[inn.fow.length - 1]!.runs}/{inn.fow[inn.fow.length - 1]!.n}</>}
        </small>
      </section>
    </>
  );
}

/** The full scorecard: batting, bowling, extras, fall of wickets and the timeline. */
export function Scorecard({ m }: { m: MatchState }) {
  const bpo = m.rules.ballsPerOver;
  if (!m.started) return null;
  return (
    <div className="stack">
      {m.result && <div className="banner green" role="status"><b>{m.result.text}</b></div>}
      {m.innings.map((inn) => {
        const batted = Object.values(inn.batters).sort((a, b) => a.order - b.order);
        const dnb = Object.values(m.players).filter((p) => p.side === inn.batting && !inn.batters[p.id] && !m.gone[p.id]);
        const bowlers = Object.values(inn.bowlers);
        const name = inningsTitle(m, inn);
        return (
          <section key={inn.index} className="card">
            <div className="row space"><b>{name}</b><b>{inn.runs}/{inn.wickets} <small className="muted">({oversText(inn.legalBalls, bpo)} ov)</small></b></div>
            <table className="sc" aria-label={`${name} batting`}>
              <thead><tr><th>Batter</th><th></th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
              <tbody>
                {batted.map((b) => (
                  <tr key={b.id}>
                    <td><b>{nameOf(m, b.id)}</b>{m.players[b.id]?.kind === "guest" && <small className="muted"> (guest)</small>}</td>
                    <td className="muted">{dismissalText(m, b)}</td>
                    <td>{b.runs}</td><td>{b.balls}</td><td>{b.fours}</td><td>{b.sixes}</td><td>{f1(strikeRate(b))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dnb.length > 0 && <p className="muted small" style={{ margin: "6px 0" }}>Did not bat: {dnb.map((p) => p.name).join(", ")}</p>}
            <p className="small" style={{ margin: "6px 0" }}>
              <b>Extras {totalExtras(inn)}</b> <span className="muted">(wides {inn.extras.wide}, no balls {inn.extras.noball}, byes {inn.extras.bye}, leg-byes {inn.extras.legbye}{inn.extras.penalty ? `, penalty ${inn.extras.penalty}` : ""})</span>
            </p>
            {inn.fow.length > 0 && (
              <p className="muted small" style={{ margin: "6px 0" }}>
                <b style={{ color: "var(--white)" }}>Fall of wickets:</b> {inn.fow.map((w) => `${w.n}-${w.runs} (${nameOf(m, w.player)}, ${w.over} ov)`).join(", ")}
              </p>
            )}
            <table className="sc" aria-label={`${name} bowling`}>
              <thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
              <tbody>
                {bowlers.map((b) => (
                  <tr key={b.id}>
                    <td><b>{nameOf(m, b.id)}</b>{m.players[b.id]?.kind === "guest" && <small className="muted"> (guest)</small>}</td>
                    <td>{oversText(b.legalBalls, bpo)}</td><td>{b.maidens}</td><td>{b.runs}</td><td>{b.wickets}</td><td>{f1(economy(b, bpo))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      {m.timeline.length > 0 && (
        <section className="card">
          <b>Timeline</b>
          <ul className="muted small" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
            {m.timeline.map((t, i) => <li key={i}>{t.text}{t.by ? ` (${t.by})` : ""}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
