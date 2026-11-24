// Test support for Phase D2 (live view): small, real engine states (built by the real engine from events) for each screen state.
import { buildState } from "@/lib/engine/engine";
import { DEFAULT_RULES, type Rules } from "@/lib/matchRules";
import type { BallPayload, MatchState, PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";

export const T = ["Ali Raza", "Zain Malik", "Bilal Ahmed", "Usman Tariq", "Faizan Ali", "Daniyal Shah"];
export const R = ["Hamza Khan", "Noman Iqbal", "Saad Hussain", "Hassan Raza", "Owais Qureshi", "Guest Kamran"];
export const SIDES: [string, string] = ["Thunder Strikers", "Royal Panthers"];
const t = (i: number) => `t${i}`;
const r = (i: number) => `r${i}`;

export const players = (): PlayerEntry[] => [
  ...T.map((name, i) => ({ id: t(i + 1), side: 1 as Side, name, number: [7, 12, 9, 10, 22, 5][i]!, kind: "member" as const, userId: `ut${i + 1}` })),
  ...R.map((name, i) => (i === 5
    ? { id: r(6), side: 2 as Side, name, number: null, kind: "guest" as const, userId: null }
    : { id: r(i + 1), side: 2 as Side, name, number: [3, 11, 14, 1, 8][i]!, kind: "member" as const, userId: `ur${i + 1}` })),
];

export class Sim {
  events: ScoreEvent[] = [];
  constructor(rules: Partial<Rules> = {}, overs = 6) {
    this.add({ type: "match_start", payload: { sides: SIDES, overs, playersPerSide: 6, rules: { ...DEFAULT_RULES, ...rules }, players: players(), toss: null, battingFirst: 1 } });
  }
  add(body: ScoreEventBody) {
    this.events.push({ ...body, id: `e${this.events.length + 1}`, seq: this.events.length + 1 } as ScoreEvent);
    return this;
  }
  startInnings(striker: string, nonStriker: string, bowler: string) { return this.add({ type: "innings_start", payload: { striker, nonStriker, bowler } }); }
  ball(p: BallPayload = {}) { return this.add({ type: "ball", payload: p }); }
  runs(...rs: number[]) { rs.forEach((x) => this.ball({ runs: x })); return this; }
  bowler(id: string) { return this.add({ type: "bowler", payload: { player: id } }); }
  batter(id: string) { return this.add({ type: "batter_in", payload: { player: id } }); }
  pause() { return this.add({ type: "pause", payload: {} }); }
  state(): MatchState {
    const b = buildState(this.events);
    if (!b.ok) throw new Error(`refused: ${b.error} at ${b.at}`);
    return b.state;
  }
}

const LIMIT: Partial<Rules> = { bowlerLimit: { mode: "max", overs: 2 } };

/** Innings 1, Thunder batting: 3.4 overs, one wicket, a wicket and a four in the current over. */
export function innings1(): MatchState {
  const s = new Sim(LIMIT);
  s.startInnings(t(1), t(2), r(1));
  s.runs(1, 0, 4, 0, 1, 2);        // over 1
  s.bowler(r(2)).runs(1, 1, 6, 0, 2, 1); // over 2
  s.bowler(r(1)).runs(2, 1, 0, 0, 1, 0); // over 3
  s.bowler(r(2)).runs(2, 1, 4);
  s.ball({ wicket: { type: "bowled" } }).batter(t(3));
  return s.state();
}

/** Both innings: Thunder 58/3 in 6 overs, Royal Panthers chasing 59 and part way through. `extra` adds balls to the current over. */
export function chase(extra: (s: Sim) => void = () => {}, rules: Partial<Rules> = LIMIT): Sim {
  const s = new Sim(rules);
  s.startInnings(t(1), t(2), r(1));
  s.runs(1, 4, 6, 0, 1, 2); s.bowler(r(2)).runs(4, 6, 1, 0, 2, 1); s.bowler(r(1)).runs(0, 6, 1); s.ball({ wicket: { type: "caught", fielder: r(5) } }).batter(t(3)); s.runs(1, 4);
  s.bowler(r(2)).runs(1, 1, 4, 0, 1, 1); s.bowler(r(4)).runs(2, 6, 1, 0, 4, 1); s.bowler(r(3)).runs(1, 2, 0, 4, 1, 1);
  s.startInnings(r(1), r(2), t(5));
  s.runs(1, 6, 0, 4, 1, 1); s.bowler(t(6)).runs(2, 4, 1, 0, 1, 1);
  extra(s);
  return s;
}

/** Innings 2 under way: Royal Panthers mid-chase. */
export const midChase = (): MatchState => chase((s) => { s.bowler(t(5)).runs(1, 1); }).state();
/** The first innings has ended and the second has not started. */
export function inningsBreak(): MatchState {
  const s = new Sim(LIMIT);
  s.startInnings(t(1), t(2), r(1));
  s.runs(1, 4, 6, 0, 1, 2); s.bowler(r(2)).runs(4, 6, 1, 0, 2, 1); s.bowler(r(1)).runs(0, 6, 1, 2, 1, 4);
  s.bowler(r(2)).runs(1, 1, 4, 0, 1, 1); s.bowler(r(4)).runs(2, 6, 1, 0, 4, 1); s.bowler(r(3)).runs(1, 2, 0, 4, 1, 1);
  return s.state();
}
export const freeHit = (): MatchState => chase((s) => { s.bowler(t(5)).runs(1).ball({ extra: "noball" }); }).state();
export const paused = (): MatchState => chase((s) => { s.bowler(t(5)).runs(1, 1).pause(); }).state();
export const notStarted = (): MatchState | null => { const b = buildState([]); return b.ok ? b.state : null; };
export function superOver(): MatchState {
  const s = new Sim({ superOver: "ask" }, 1);
  s.startInnings(t(1), t(2), r(1)); s.runs(1, 1, 1, 1, 1, 1);
  s.startInnings(r(1), r(2), t(1)); s.runs(1, 1, 1, 1, 1, 1);
  s.add({ type: "super_over_decision", payload: { play: true } });
  s.startInnings(r(3), r(4), t(2)); s.runs(4, 4, 4, 0, 0, 0);
  s.startInnings(t(3), t(4), r(5)); s.runs(4, 6);
  return s.state();
}
