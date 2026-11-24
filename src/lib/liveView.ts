// Phase D2: the numbers and sentences of the broadcast-style score bug, worked out from the engine's state (read-only).
// Pure functions, so the server page, the scoring pad and the tests all get the same answer. Nothing here changes the engine.
import { currentInnings, effectiveTarget, oversText, requiredRate, runRate } from "@/lib/engine/engine";
import type { BallRecord, InningsState, MatchState } from "@/lib/engine/types";

export type BugRow = { side: 1 | 2; name: string; runs: number; wickets: number; overs: string; current: boolean };
export type BugView = {
  /** "Innings 2 · 6 overs" or "Super over · 1 over". */
  heading: string;
  superOver: boolean;
  rows: BugRow[];
  /** The gold sentence under the rows: the chase, "innings over", the result, or "batting · run rate". */
  line: string;
  /** True when the line is a result (shown in green). */
  isResult: boolean;
  /** Chase progress: runs scored of the runs needed. Null when nobody is chasing. */
  progress: { have: number; of: number; pct: number; revised: boolean } | null;
};

const f2 = (n: number) => n.toFixed(2);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Which innings feed the two rows of the bug: the super overs while one is being played, otherwise the regular innings. */
function rowInnings(m: MatchState, cur: InningsState): InningsState[] {
  const pool = m.innings.filter((i) => i.superOver === cur.superOver);
  const out: InningsState[] = [];
  for (const pos of [1, 2] as const) {
    const mine = pool.filter((i) => i.batting === pos);
    if (mine.length) out.push(mine[mine.length - 1]!);
  }
  return out.sort((a, b) => a.index - b.index);
}

export function bugView(m: MatchState): BugView | null {
  const cur = currentInnings(m);
  if (!m.started || !cur) return null;
  const bpo = m.rules.ballsPerOver;
  const rows: BugRow[] = rowInnings(m, cur).map((i) => ({
    side: i.batting, name: m.sides[i.batting - 1], runs: i.runs, wickets: i.wickets, overs: oversText(i.legalBalls, bpo), current: i.index === cur.index,
  }));
  const team = m.sides[cur.batting - 1];
  const target = effectiveTarget(cur);
  const rr = runRate(cur, bpo);
  const heading = `${cur.superOver ? "Super over" : `Innings ${cur.index + 1}`} · ${cur.maxOvers} ${plural(cur.maxOvers, "over", "overs")}`;
  let line: string;
  let isResult = false;
  if (cur.ended) {
    if (m.result) { line = m.result.text; isResult = true; } else line = `${team} innings over · run rate ${f2(rr)}`;
  } else if (target !== null) {
    const need = Math.max(0, target - cur.runs);
    const left = Math.max(0, cur.maxOvers * bpo - cur.legalBalls);
    const rrr = requiredRate(cur, bpo);
    line = `${team} need ${need} from ${left} ${plural(left, "ball", "balls")}${rrr !== null ? ` · RRR ${f2(rrr)}` : ""} · RR ${f2(rr)}`;
  } else {
    line = `${team} batting · run rate ${f2(rr)}`;
  }
  const progress = target !== null && target > 0
    ? { have: cur.runs, of: target, pct: Math.max(0, Math.min(100, Math.round((cur.runs / target) * 100))), revised: cur.manualTarget !== null }
    : null;
  return { heading, superOver: cur.superOver, rows, line, isResult, progress };
}

/** The class of one ball bubble: a six is gold and filled, a four blue and outlined, a wicket red, wides and no balls orange. */
export function ballKind(b: Pick<BallRecord, "wicket" | "label">): "w" | "six" | "four" | "x" | "" {
  if (b.wicket) return "w";
  if (b.label === "6") return "six";
  if (b.label === "4") return "four";
  if (/^(Wd|Nb)/.test(b.label)) return "x";
  return "";
}

/** "SR 229" for the striker line. */
export const srText = (b: { runs: number; balls: number } | undefined | null) => `SR ${b && b.balls > 0 ? Math.round((b.runs * 100) / b.balls) : 0}`;
