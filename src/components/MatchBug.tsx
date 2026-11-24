// Phase D1: the score bug on the Match details page: both teams with their badges, runs/wickets in the score font, overs,
// the chase sentence while a chase is on, and the result line for a finished or abandoned match. Worked out from the engine
// state by lib/scoreLine.ts (the same summary Home uses), so it can never disagree with the live screen. Read only.
import { IconInfo } from "@/components/B4Icons";
import { MdTrophy } from "@/components/MdIcons";
import TeamBadge from "@/components/TeamBadge";
import { currentInnings, oversText } from "@/lib/engine/engine";
import { scoreLineFromState, scoreText } from "@/lib/scoreLine";
import { statusBadge } from "@/lib/md";
import type { MatchStatus } from "@/lib/matchRules";
import type { MatchState } from "@/lib/engine/types";
import "./md.css";

/** "Batting: Ali Raza 24* (16), Sara Khan 11 (9) · Bowling: Hamza Malik 1-14 (2.3)" for a live or paused match (decided 2026-11-24). */
export function creaseLine(state: MatchState): { batting: string; bowling: string } | null {
  const inn = currentInnings(state);
  if (!inn || inn.ended) return null;
  const name = (id: string | null) => (id ? state.players[id]?.name ?? "Player" : "");
  const bats = [inn.striker, inn.nonStriker].filter((x): x is string => !!x).map((id) => {
    const b = inn.batters[id];
    return b ? `${name(id)} ${b.runs}${id === inn.striker ? "*" : ""} (${b.balls})` : "";
  }).filter(Boolean);
  const bw = inn.bowler ? inn.bowlers[inn.bowler] : null;
  const bowling = inn.bowler ? (bw ? `${name(inn.bowler)} ${bw.wickets}-${bw.runs} (${oversText(bw.legalBalls, state.rules.ballsPerOver)})` : name(inn.bowler)) : "";
  if (!bats.length && !bowling) return null;
  return { batting: bats.join(", "), bowling };
}

export default function MatchBug({ state, status, sub }: { state: MatchState; status: MatchStatus; sub: string }) {
  const line = scoreLineFromState(state);
  if (!line) return null;
  const badge = statusBadge(status);
  const winner = state.result?.kind === "win" ? state.result.winner : null;
  const abandoned = status === "abandoned" || state.result?.kind === "abandoned";
  const live = status === "live" || status === "paused";
  const innings = live ? `Innings ${state.innings.length} · ` : "";
  return (
    <section className={`md-bug ${status}`} aria-label="Score">
      <div className="md-bughead">
        <span className={`md-badge ${badge.tone}`}>{live && status === "live" && <i className="md-dot" aria-hidden="true" />}{badge.label}</span>
        <span className="md-bugsub">{innings}{sub}</span>
      </div>
      {([1, 2] as const).map((pos) => {
        const s = line.sides[pos - 1];
        const own = line.batting === pos;
        const won = winner === pos;
        return (
          <div key={pos} className={`md-brow${own ? " bat" : ""}${won ? " won" : ""}`}>
            <TeamBadge name={s.name} size="sm" />
            <span className="md-bname">{s.name}{won && <span className="md-win"><MdTrophy size={15} /><span className="md-sr"> (winner)</span></span>}{own && <small>batting</small>}</span>
            <span className="md-bscore">{scoreText(s)}</span>
            <span className="md-bov">{s.batted ? s.overs : ""}</span>
          </div>
        );
      })}
      {line.chase && <p className="md-chase">{line.chase}</p>}
      {live && (() => {
        const c = creaseLine(state);
        return c ? (
          <p className="md-crease">
            {c.batting && <span><b>Batting</b> {c.batting}</span>}
            {c.bowling && <span><b>Bowling</b> {c.bowling}</span>}
          </p>
        ) : null;
      })()}
      {state.result && (
        abandoned
          ? <p className="md-result neutral"><IconInfo size={16} /><span>{state.result.text}</span></p>
          : <p className="md-result" role="status"><MdTrophy size={16} /><span>{state.result.text}</span></p>
      )}
      {status === "paused" && <p className="md-result neutral"><IconInfo size={16} /><span>Match paused</span></p>}
    </section>
  );
}
