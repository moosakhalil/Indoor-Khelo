// Phase E1: the board of the scoring pad (score bug, batters and bowler, this over, earlier overs).
// Drawn from the engine's state only. No hooks and nothing here can make an event: the only action is `onBall`, which the pad
// passes in to open the "edit this ball" sheet (the same call it always made).
import "./pp.css";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import { IcAlert, IcBowl, IcClock, IcStar, IcZap } from "@/components/PpIcons";
import { ballCaption, ballTone, finishedOverBalls, lastOverBalls, nameOf, numberOf, overLeftText, previousOvers } from "@/components/padInfo";
import { bowlerAllowance, currentInnings, effectiveTarget, oversText, requiredRate, runRate } from "@/lib/engine/engine";
import type { BallRecord, InningsState, MatchState } from "@/lib/engine/types";

const f2 = (n: number) => n.toFixed(2);

export type BoardProps = {
  m: MatchState;
  /** Scorer only: tapping a ball opens it for editing. */
  onBall?: (eventId: string) => void;
  /** Events saved on this phone and not yet on the server, and events the server refused (shown as a clock / an alert on the ball). */
  pendingIds?: ReadonlySet<string>;
  heldIds?: ReadonlySet<string>;
  /** What to show before the first ball (the match is not started, so the engine does not know the teams yet). */
  pre: { sides: [string, string]; overs: number; playersPerSide: number };
};

function Chip({ b, onBall, pending, held }: { b: BallRecord; onBall?: (id: string) => void; pending: boolean; held: boolean }) {
  const cls = `pp-ball ${ballTone(b)}`;
  const state = held ? "held" : pending ? "pending" : "saved";
  return (
    <span className="pp-b" data-state={state}>
      {onBall
        ? <button type="button" className={cls} aria-label={`Edit ball ${b.label}`} onClick={() => onBall(b.eventId)}>{b.label}</button>
        : <span className={cls}>{b.label}</span>}
      <small className="pp-cap">{ballCaption(b)}</small>
      {(pending || held) && (
        <span className={`pp-badge ${held ? "bad" : "clk"}`}>
          {held ? <IcAlert size={11} /> : <IcClock size={11} />}
          <span className="pp-sr">{held ? "Refused by the server" : "Saved on this phone, not sent yet"}</span>
        </span>
      )}
    </span>
  );
}

/** One short sentence for the strip under the score: the chase, or how the innings stands. */
export function chaseText(m: MatchState, inn: InningsState): string {
  const bpo = m.rules.ballsPerOver;
  const target = effectiveTarget(inn);
  if (m.phase === "level_prompt") return `Scores level: ${inn.runs} all`;
  if (m.phase === "need_innings" && inn.ended) return `Innings ${inn.index + 1} complete: ${m.sides[inn.batting - 1]} finish on ${inn.runs}/${inn.wickets}`;
  if (m.result && (m.phase === "result" || m.phase === "finished" || m.phase === "abandoned")) return m.result.text;
  if (target === null || inn.ended) return `${m.sides[inn.batting - 1]} ${inn.ended ? "innings over" : "batting"} · Run rate ${f2(runRate(inn, bpo))}`;
  const need = Math.max(0, target - inn.runs);
  const left = Math.max(0, inn.maxOvers * bpo - inn.legalBalls);
  const rrr = requiredRate(inn, bpo);
  return `Need ${need} from ${left} ball${left === 1 ? "" : "s"} · ${rrr !== null ? `RRR ${f2(rrr)} · ` : ""}RR ${f2(runRate(inn, bpo))}`;
}

function PlayerRow({ m, id, tag, tone, right, extra }: { m: MatchState; id: string; tag: string; tone: "strike" | "plain"; right: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className={`pp-row ${tone === "strike" ? "pp-on" : ""}`}>
      <Shirt size="small" number={numberOf(m, id)} />
      <div className="pp-who">
        <b>{nameOf(m, id)}</b>
        <small className="pp-tag">{tone === "strike" && <IcStar size={12} />}{tag}</small>
      </div>
      {extra}
      <span className="pp-fig">{right}</span>
    </div>
  );
}

export default function PadBoard({ m, onBall, pendingIds, heldIds, pre }: BoardProps) {
  const inn = currentInnings(m);
  if (!m.started || !inn) {
    const sides = m.started ? m.sides : pre.sides;
    return (
      <section className="pp-hero" aria-label="The match">
        <div className="pp-hero-teams">
          <TeamBadge name={sides[0]} size="lg" /><span className="pp-vs" aria-hidden="true">v</span><TeamBadge name={sides[1]} size="lg" />
        </div>
        <b>{m.started ? "Waiting for the innings to start" : "The match has not started yet"}</b>
        <small className="muted">{sides[0]} v {sides[1]} · {pre.overs} overs · {pre.playersPerSide} a side</small>
      </section>
    );
  }
  const bpo = m.rules.ballsPerOver;
  const target = effectiveTarget(inn);
  const strike = inn.striker ? inn.batters[inn.striker] : null;
  const non = inn.nonStriker ? inn.batters[inn.nonStriker] : null;
  const bowler = inn.bowler ? inn.bowlers[inn.bowler] : null;
  const left = inn.bowler ? bowlerAllowance(m, inn, inn.bowler) : null;
  const counted = inn.overBalls.filter((b) => b.counted).length;
  const finished = finishedOverBalls(inn, bpo);
  const lastEnded = lastOverBalls(inn, bpo);
  const frozen = finished.length ? finished : lastEnded;      // an over that is over: kept on show until the next one starts
  const shown = frozen.length ? frozen : inn.overBalls;
  const empties = inn.ended || inn.needBowler ? 0 : Math.max(0, bpo - counted);
  const shownOver = finished.length ? inn.legalBalls / bpo - 1 : lastEnded.length ? Math.floor((inn.legalBalls - 1) / bpo) : Math.floor(inn.legalBalls / bpo);
  const earlier = previousOvers(m, inn, shownOver);
  const battingName = m.sides[inn.batting - 1];
  const otherName = m.sides[inn.bowling - 1];
  const first = m.innings[0];
  const sub = inn.superOver
    ? `Super over · ${battingName} batting`
    : inn.index === 0 ? `Batting · ${otherName} to bowl` : `Batting · ${first ? `${m.sides[first.batting - 1]} ${first.runs}/${first.wickets}` : otherName}`;
  const pend = pendingIds ?? new Set<string>();
  const held = heldIds ?? new Set<string>();
  const over = m.phase === "finished" || m.phase === "abandoned" || m.phase === "result" || m.phase === "level_prompt" || m.phase === "need_innings";
  const badge = m.phase === "finished" || m.phase === "abandoned" || m.phase === "result" ? "FINAL" : over ? "BREAK" : "LIVE";
  const vacantStrike = inn.needBatter && !inn.striker;
  const vacantNon = inn.needBatter && !inn.nonStriker && !vacantStrike;
  return (
    <>
      <section className="pp-bug" aria-label="Score">
        <div className="pp-bug-top">
          <span className={`pp-live${over ? " done" : ""}`}>{!over && <span className="pp-live-dot" aria-hidden="true" />}{badge}</span>
          <span className="pp-bug-meta">{inn.superOver ? "Super over" : `Innings ${inn.index + 1}`}{target !== null ? ` · Target ${target}${inn.manualTarget !== null ? " (revised)" : ""}` : ""}</span>
          {m.paused && <span className="pp-paused">Paused</span>}
        </div>
        <div className="pp-bug-main">
          <TeamBadge name={battingName} size="lg" />
          <div className="pp-bug-team"><b>{battingName}</b><small className="muted">{sub}</small></div>
          <div className="pp-bug-score">
            <div className="pp-score" aria-label={`${inn.runs} for ${inn.wickets}`}>{inn.runs}<span>/{inn.wickets}</span></div>
            <div className="pp-ov"><b>{oversText(inn.legalBalls, bpo)}</b><small className="muted">of {inn.maxOvers} overs</small></div>
          </div>
        </div>
        <div className="pp-chase" role="status">{chaseText(m, inn)}</div>
      </section>

      {m.phase === "need_innings" ? null : <>
      {inn.freeHit && !inn.ended && (
        <div className="pp-freehit" role="status"><IcZap size={18} /><b>FREE HIT</b><small id="pp-fh-note">Only Run Out is allowed on this ball</small></div>
      )}

      <section className="pp-players" aria-label="Batters and bowler">
        {inn.striker ? (
          <PlayerRow m={m} id={inn.striker} tone="strike" tag="ON STRIKE" right={<><b className="pp-n">{strike?.runs ?? 0}</b><small className="muted">({strike?.balls ?? 0})</small></>} />
        ) : vacantStrike ? (
          <div className="pp-row pp-need" role="status"><Shirt size="small" number={null} /><div className="pp-who"><b>Next batter needed</b><small className="pp-tag">STRIKE END IS EMPTY</small></div></div>
        ) : null}
        {inn.nonStriker ? (
          <PlayerRow m={m} id={inn.nonStriker} tone="plain" tag="NON-STRIKER" right={<><b className="pp-n">{non?.runs ?? 0}</b><small className="muted">({non?.balls ?? 0})</small></>} />
        ) : vacantNon ? (
          <div className="pp-row pp-need" role="status"><Shirt size="small" number={null} /><div className="pp-who"><b>Next batter needed</b><small className="pp-tag">NON-STRIKER END IS EMPTY</small></div></div>
        ) : !inn.needBatter && inn.striker ? (
          <div className="pp-row pp-alone"><span className="pp-chipnote">Batting alone</span></div>
        ) : null}
        {inn.needBowler ? (
          <div className="pp-row pp-need"><span className="pp-ico"><IcBowl size={20} /></span><div className="pp-who"><b>New bowler needed</b><small className="pp-tag">OVER {Math.floor(inn.legalBalls / bpo) + 1}</small></div></div>
        ) : inn.bowler ? (
          <div className="pp-row">
            <span className="pp-ico"><IcBowl size={20} /></span>
            <div className="pp-who"><b>{nameOf(m, inn.bowler)}</b><small className="pp-tag">BOWLING</small></div>
            <span className="pp-fig"><b className="pp-n">{bowler ? `${oversText(bowler.legalBalls, bpo)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : "0.0-0-0-0"}</b></span>
            {left !== null && <span className={`pill ${left === 0 ? "orange" : "green"}`}>{overLeftText(left)}</span>}
          </div>
        ) : null}
      </section>

      <section className="pp-over" aria-label="This over">
        <div className="pp-over-head">
          <small>{frozen.length ? `OVER ${shownOver + 1}` : "THIS OVER"}</small>
          {!inn.ended && !inn.needBowler && <b className="ball-of">Ball {Math.min(counted + 1, bpo)} of {bpo}</b>}
          {finished.length > 0 && <b className="ball-of">Over complete</b>}
          {finished.length === 0 && lastEnded.length > 0 && <b className="ball-of">Innings over</b>}
        </div>
        <div className="pp-balls">
          {shown.map((b) => <Chip key={b.eventId} b={b} onBall={onBall} pending={pend.has(b.eventId)} held={held.has(b.eventId)} />)}
          {Array.from({ length: empties }, (_, i) => <span key={`e${i}`} className="pp-b" aria-hidden="true"><span className="pp-ball empty" /></span>)}
        </div>
      </section>

      <small className="muted pp-part">
        Partnership {inn.partnership.runs} ({inn.partnership.balls}){inn.fow.length > 0 && <> · Last wicket {nameOf(m, inn.fow[inn.fow.length - 1]!.player)} {inn.fow[inn.fow.length - 1]!.runs}/{inn.fow[inn.fow.length - 1]!.n}</>}
      </small>

      {earlier.length > 0 && (
        <section className="pp-prev" aria-label="Previous overs">
          <small className="pp-prev-h">PREVIOUS OVERS</small>
          {earlier.map((o) => (
            <div className="pp-prev-row" key={o.over}>
              <div className="pp-prev-who"><small>OVER {o.over}</small><b>{o.bowler}</b></div>
              <div className="pp-balls small">{o.balls.map((b) => <Chip key={b.eventId} b={b} onBall={onBall} pending={pend.has(b.eventId)} held={held.has(b.eventId)} />)}</div>
              <b className="pp-prev-runs">{o.runs}</b>
            </div>
          ))}
        </section>
      )}
      </>}
    </>
  );
}

