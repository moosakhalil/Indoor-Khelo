// A small, read-only score summary for Home: one line per side (runs, wickets, overs) and the chase sentence.
// It runs the scoring engine over a match's saved events, exactly like the live page does (see components/Live.tsx),
// so the numbers on Home can never disagree with the live screen. Nothing is written.
import { buildState, currentInnings, effectiveTarget, oversText, requiredRate } from "@/lib/engine/engine";
import type { MatchState } from "@/lib/engine/types";
import { loadEvents } from "@/lib/scoring";

export type SideScore = {
  name: string;
  /** False until this side has faced a ball (or the innings has started): then no score is shown, only a dash. */
  batted: boolean;
  runs: number;
  wickets: number;
  /** Overs as "6.0" or "4.2" (balls in the over after the dot). */
  overs: string;
};

export type ScoreLine = {
  sides: [SideScore, SideScore];
  /** Which side is batting right now (1 or 2), or null when nobody is (not started, innings over, finished). */
  batting: 1 | 2 | null;
  /** "Royal Panthers need 12 from 10 balls · RRR 7.20", or null when there is no chase going on. */
  chase: string | null;
};

/** "58/3", or a dash when the side has not batted. */
export function scoreText(s: SideScore): string {
  return s.batted ? `${s.runs}/${s.wickets}` : "–";
}

/** Pure part: turn the engine's state into the summary. Returns null when the match has not started. */
export function scoreLineFromState(m: MatchState): ScoreLine | null {
  if (!m.started || m.innings.length === 0) return null;
  const bpo = m.rules.ballsPerOver;
  const side = (pos: 1 | 2): SideScore => {
    // The side's own regular innings (the latest one); super overs never replace the match score.
    const inns = m.innings.filter((i) => i.batting === pos && !i.superOver);
    const inn = inns[inns.length - 1];
    return inn
      ? { name: m.sides[pos - 1], batted: true, runs: inn.runs, wickets: inn.wickets, overs: oversText(inn.legalBalls, bpo) }
      : { name: m.sides[pos - 1], batted: false, runs: 0, wickets: 0, overs: oversText(0, bpo) };
  };
  const cur = currentInnings(m);
  const live = cur && !cur.ended ? cur : null;
  let chase: string | null = null;
  if (live) {
    const target = effectiveTarget(live);
    if (target !== null) {
      const need = Math.max(0, target - live.runs);
      const ballsLeft = Math.max(0, live.maxOvers * bpo - live.legalBalls);
      const rrr = requiredRate(live, bpo);
      const who = live.superOver ? `Super over: ${m.sides[live.batting - 1]}` : m.sides[live.batting - 1];
      chase = `${who} need ${need} from ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"}${rrr !== null ? ` · RRR ${rrr.toFixed(1)}` : ""}`;
    }
  }
  return { sides: [side(1), side(2)], batting: live ? live.batting : null, chase };
}

/** Loads the events of one match and summarises them. Null when there is nothing to show or the events cannot be read. */
export async function loadScoreLine(matchId: string): Promise<ScoreLine | null> {
  try {
    const built = buildState(await loadEvents(matchId));
    return built.ok ? scoreLineFromState(built.state) : null;
  } catch {
    return null;
  }
}

/** Several matches at once (the live match and the latest results), in parallel. */
export async function loadScoreLines(matchIds: string[]): Promise<Map<string, ScoreLine | null>> {
  const unique = Array.from(new Set(matchIds));
  const lines = await Promise.all(unique.map((id) => loadScoreLine(id)));
  return new Map(unique.map((id, i) => [id, lines[i]!]));
}
