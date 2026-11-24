// Test support for Phase E2 (the pad's sheets): small, real engine states, built by the real engine from events.
// Thunder Strikers (side 1) bat first with a1 (Hamza Khan) and a2 (Saad Hussain); Royal Panthers (side 2) bowl with b1 (Bilal Ahmed).
import { buildState } from "@/lib/engine/engine";
import { DEFAULT_RULES, type Rules } from "@/lib/matchRules";
import type { BallPayload, MatchState, PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";

export const SIDES: [string, string] = ["Thunder Strikers", "Royal Panthers"];
const A = ["Hamza Khan", "Saad Hussain", "Talha Mehmood", "Owais Qureshi", "Arsalan Mir", "Noman Iqbal"];
const B = ["Bilal Ahmed", "Usman Tariq", "Ali Raza", "Zain Malik", "Faizan Ali", "Moiz Abbasi"];
const NUM_A = [10, 99, 7, 8, 9, 11];
const NUM_B = [1, 2, 3, 4, 5, 6];

export const players = (perSide = 6): PlayerEntry[] => [
  ...A.slice(0, perSide).map((name, i) => ({ id: `a${i + 1}`, side: 1 as Side, name, number: NUM_A[i]!, kind: "member" as const, userId: `ua${i + 1}` })),
  ...B.slice(0, perSide).map((name, i) => ({ id: `b${i + 1}`, side: 2 as Side, name, number: NUM_B[i]!, kind: "member" as const, userId: `ub${i + 1}` })),
];

export class Sim {
  events: ScoreEvent[] = [];
  constructor(rules: Partial<Rules> = {}, overs = 6, perSide = 6, guest = false) {
    const pl = players(perSide);
    if (guest) pl[pl.length - 1] = { id: "b-guest", side: 2, name: "Guest Kamran", number: null, kind: "guest", userId: null };
    this.add({ type: "match_start", payload: { sides: SIDES, overs, playersPerSide: perSide, rules: { ...DEFAULT_RULES, ...rules }, players: pl, toss: null, battingFirst: 1 } });
  }
  add(body: ScoreEventBody) {
    this.events.push({ ...body, id: `e${this.events.length + 1}`, seq: this.events.length + 1 } as ScoreEvent);
    return this;
  }
  startInnings(striker = "a1", nonStriker: string | null = "a2", bowler = "b1") { return this.add({ type: "innings_start", payload: { striker, nonStriker, bowler } }); }
  ball(p: BallPayload = {}) { return this.add({ type: "ball", payload: p }); }
  runs(...rs: number[]) { rs.forEach((x) => this.ball({ runs: x })); return this; }
  bowler(id: string) { return this.add({ type: "bowler", payload: { player: id } }); }
  batter(id: string, end?: "striker" | "nonStriker") { return this.add({ type: "batter_in", payload: { player: id, end: end ?? null } }); }
  state(): MatchState {
    const b = buildState(this.events);
    if (!b.ok) throw new Error(`refused: ${b.error} at ${b.at}`);
    return b.state;
  }
  /** The id of the n-th ball event (1-based). */
  ballId(n: number): string { return this.events.filter((e) => e.type === "ball")[n - 1]!.id; }
}

/** A fresh innings: Hamza on strike, Saad at the other end, Bilal bowling, nothing bowled. */
export const fresh = (rules: Partial<Rules> = {}) => new Sim(rules).startInnings();
/** Three balls into an over (the bowler can be changed mid-over). */
export const midOver = (rules: Partial<Rules> = {}) => fresh(rules).runs(1, 0, 4);
/** Hamza was bowled on ball 4: the pad needs the next batter. */
export const afterWicket = () => fresh().runs(1, 0, 4).ball({ wicket: { type: "bowled" } });
/** A no ball was bowled: the next ball is a free hit. */
export const freeHitSim = () => fresh().ball({ extra: "noball" });
/** One over finished: the pad needs the bowler for over 2. */
export const overDone = (rules: Partial<Rules> = {}) => fresh(rules).runs(1, 0, 4, 0, 0, 0);
/** Three players a side; two wickets later one batter is left alone, so a third wicket would end the innings. */
export function lastBatter() {
  const s = new Sim({}, 6, 3).startInnings("a1", "a2", "b1");
  s.runs(1).ball({ wicket: { type: "bowled" } }).batter("a3", "striker");
  return s;
}
/** Innings 1 of a one-over match is over; innings 2 under way with a target of 8 (Hamza and Saad bowled to Bilal). */
export function chasing() {
  const s = new Sim({}, 1).startInnings("a1", "a2", "b1");
  s.runs(1, 1, 1, 1, 1, 2);
  return s.startInnings("b1", "b2", "a1");
}

/** One batter left at the crease and nobody to come in: the next wicket ends the innings. */
export function aloneBatter() {
  const s = lastBatter();
  return s.ball({ wicket: { type: "bowled" } });
}
/** Two players a side and a one-over limit: after two overs nobody is allowed to bowl the third. */
export function nobodyAllowed() {
  const s = new Sim({ bowlerLimit: { mode: "max", overs: 1 } }, 6, 2).startInnings("a1", "a2", "b1");
  s.runs(0, 0, 0, 0, 0, 0).bowler("b2").runs(1, 0, 0, 0, 0, 0);
  return s;
}
