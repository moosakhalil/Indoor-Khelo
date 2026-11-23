import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type Rules } from "@/lib/matchRules";
import { buildState, currentInnings, dismissalText, requiredRate, runRate, selectableBatters, selectableBowlers, tryEvent } from "./engine";
import type { BallPayload, MatchState, PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "./types";

const A = (i: number) => `a${i}`;   // side 1 players a1..a6
const B = (i: number) => `b${i}`;   // side 2 players b1..b6
const players = (n = 6): PlayerEntry[] => [
  ...Array.from({ length: n }, (_, i) => ({ id: A(i + 1), side: 1 as Side, name: `Alpha${i + 1}`, number: i + 1, kind: "member" as const, userId: `ua${i + 1}` })),
  ...Array.from({ length: n }, (_, i) => ({ id: B(i + 1), side: 2 as Side, name: `Bravo${i + 1}`, number: i + 11, kind: "member" as const, userId: `ub${i + 1}` })),
];

/** A tiny scorer: collects events and checks every step is accepted. */
class Match {
  events: ScoreEvent[] = [];
  private n = 0;
  constructor(over: Partial<Rules> = {}, opts: { overs?: number; pps?: number; n?: number; battingFirst?: Side } = {}) {
    this.add({ type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs: opts.overs ?? 6, playersPerSide: opts.pps ?? 6, rules: { ...DEFAULT_RULES, ...over }, players: players(opts.n ?? 6), toss: null, battingFirst: opts.battingFirst ?? 1 } });
  }
  add(body: ScoreEventBody, id?: string): ScoreEvent {
    const ev = { ...body, id: id ?? `e${++this.n}`, seq: this.events.length + 1 } as ScoreEvent;
    this.events.push(ev);
    return ev;
  }
  /** Add and require acceptance. */
  ok(body: ScoreEventBody, id?: string) {
    const ev = this.add(body, id);
    const r = buildState(this.events);
    if (!r.ok) throw new Error(`refused: ${r.error}`);
    return ev;
  }
  /** Add and require refusal (the event is not kept). */
  no(body: ScoreEventBody, msg?: RegExp) {
    const r = tryEvent(this.events, { ...body, id: "probe", seq: this.events.length + 1 } as ScoreEvent);
    expect(r.ok).toBe(false);
    if (!r.ok && msg) expect(r.error).toMatch(msg);
  }
  get s(): MatchState {
    const r = buildState(this.events);
    if (!r.ok) throw new Error(`state refused: ${r.error}`);
    return r.state;
  }
  get inn() { return currentInnings(this.s)!; }
  start(bat = { striker: A(1), nonStriker: A(2) }, bowler = B(1)) { return this.ok({ type: "innings_start", payload: { ...bat, bowler } }); }
  ball(p: BallPayload = {}, id?: string) { return this.ok({ type: "ball", payload: p }, id); }
  runs(...rs: number[]) { for (const r of rs) this.ball({ runs: r }); }
  bowler(id: string) { return this.ok({ type: "bowler", payload: { player: id } }); }
  batter(id: string, end?: "striker" | "nonStriker") { return this.ok({ type: "batter_in", payload: { player: id, end } }); }
  undo() { return this.ok({ type: "undo", payload: {} }); }
  /** Bowl a full over of dots, then pick the next bowler. */
  over(next: string, runs = [0, 0, 0, 0, 0, 0]) { this.runs(...runs); if (next) this.bowler(next); }
}

describe("starting", () => {
  it("needs two players a side, a real striker and non-striker, and an allowed bowler", () => {
    const m = new Match();
    expect(m.s.phase).toBe("need_innings");
    m.no({ type: "innings_start", payload: { striker: B(1), nonStriker: A(2), bowler: B(1) } }, /batting side/);
    m.no({ type: "innings_start", payload: { striker: A(1), nonStriker: A(1), bowler: B(1) } }, /different/);
    m.no({ type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: A(3) } }, /bowling side/);
    m.no({ type: "ball", payload: { runs: 1 } }, /no innings/i);
    m.start();
    expect(m.s.phase).toBe("scoring");
    expect(m.inn).toMatchObject({ batting: 1, bowling: 2, runs: 0, striker: A(1), nonStriker: A(2), bowler: B(1), maxOvers: 6 });
    const few = [{ ...players(1)[0]! }, ...players(1).slice(1)];
    const bad = buildState([{ type: "match_start", id: "x", seq: 1, payload: { sides: ["A", "B"], overs: 4, playersPerSide: 6, rules: DEFAULT_RULES, players: few, toss: null, battingFirst: 1 } }]);
    expect(bad.ok).toBe(false);
  });
  it("the team named in battingFirst bats first", () => {
    const m = new Match({}, { battingFirst: 2 });
    m.start({ striker: B(1), nonStriker: B(2) }, A(1));
    expect(m.inn.batting).toBe(2);
  });
});

describe("runs, strike and boundaries", () => {
  it("odd runs change the strike, even runs do not", () => {
    const m = new Match({ ballsPerOver: 12 }); m.start();
    m.runs(1);
    expect(m.inn).toMatchObject({ striker: A(2), nonStriker: A(1) });
    m.runs(2);
    expect(m.inn.striker).toBe(A(2));
    m.runs(3);
    expect(m.inn.striker).toBe(A(1));
    m.runs(0, 4, 6, 5);
    expect(m.inn).toMatchObject({ runs: 1 + 2 + 3 + 4 + 6 + 5, legalBalls: 7 });
    const a1 = m.inn.batters[A(1)]!;
    expect(a1).toMatchObject({ fours: 1, sixes: 1 });
    expect(m.inn.bowlers[B(1)]).toMatchObject({ runs: 21, legalBalls: 7, wickets: 0 });
  });
  it("tracks balls faced, strike rate, run rate and the partnership", () => {
    const m = new Match(); m.start();
    m.runs(1, 1, 0, 4);
    const a1 = m.inn.batters[A(1)]!, a2 = m.inn.batters[A(2)]!;
    expect(a1.balls + a2.balls).toBe(4);
    expect(m.inn.partnership).toEqual({ runs: 6, balls: 4 });
    expect(runRate(m.inn, 6)).toBeCloseTo(9);
    expect(requiredRate(m.inn, 6)).toBeNull();
  });
  it("refuses impossible runs", () => {
    const m = new Match(); m.start();
    m.no({ type: "ball", payload: { runs: -1 } });
    m.no({ type: "ball", payload: { runs: 1.5 } });
    m.no({ type: "ball", payload: { runs: 13 } });
  });
});

describe("wides, no balls, byes and leg-byes", () => {
  it("a wide is one run, not counted, the batter does not face it, strike unchanged", () => {
    const m = new Match(); m.start();
    m.ball({ extra: "wide" });
    expect(m.inn).toMatchObject({ runs: 1, legalBalls: 0, striker: A(1) });
    expect(m.inn.batters[A(1)]!.balls).toBe(0);
    expect(m.inn.extras.wide).toBe(1);
    expect(m.inn.bowlers[B(1)]).toMatchObject({ runs: 1, wides: 1, legalBalls: 0 });
  });
  it("wide + extra runs (wide + 4) are all wides, odd extra runs change strike", () => {
    const m = new Match(); m.start();
    m.ball({ extra: "wide", runs: 4 });
    expect(m.inn).toMatchObject({ runs: 5, legalBalls: 0, striker: A(1) });
    expect(m.inn.extras.wide).toBe(5);
    m.ball({ extra: "wide", runs: 1 });
    expect(m.inn).toMatchObject({ runs: 7, striker: A(2) });
  });
  it("wide and no-ball run values follow the match rules", () => {
    const m = new Match({ wideRuns: 2, noBallRuns: 3 }); m.start();
    m.ball({ extra: "wide" }); m.ball({ extra: "noball" });
    expect(m.inn.runs).toBe(5);
    expect(m.inn.extras).toMatchObject({ wide: 2, noball: 3 });
  });
  it("if the rules say a wide counts as a ball, it does", () => {
    const m = new Match({ widesReBowled: false }); m.start();
    m.ball({ extra: "wide" });
    expect(m.inn.legalBalls).toBe(1);
  });
  it("a no ball is one run plus runs off the bat to the batter; not counted; the batter faces it", () => {
    const m = new Match(); m.start();
    m.ball({ extra: "noball", runs: 4 });
    expect(m.inn).toMatchObject({ runs: 5, legalBalls: 0 });
    expect(m.inn.batters[A(1)]).toMatchObject({ runs: 4, balls: 1, fours: 1 });
    expect(m.inn.bowlers[B(1)]).toMatchObject({ runs: 5, noballs: 1 });
  });
  it("byes and leg-byes count as balls, are faced, are extras and are not charged to the bowler", () => {
    const m = new Match(); m.start();
    m.ball({ extra: "bye", runs: 1 });
    m.ball({ extra: "legbye", runs: 2 });
    expect(m.inn).toMatchObject({ runs: 3, legalBalls: 2 });
    expect(m.inn.extras).toMatchObject({ bye: 1, legbye: 2 });
    expect(m.inn.bowlers[B(1)]!.runs).toBe(0);
    expect(m.inn.batters[A(1)]!.runs + m.inn.batters[A(2)]!.runs).toBe(0);
    expect(m.inn.striker).toBe(A(2));   // one bye: strike changes
    m.no({ type: "ball", payload: { extra: "bye", runs: 0 } }, /at least 1/);
  });
});

describe("free hit", () => {
  it("follows a no ball, allows only a run-out, survives a wide, ends after a fair ball", () => {
    const m = new Match(); m.start();
    m.ball({ extra: "noball" });
    expect(m.inn.freeHit).toBe(true);
    m.no({ type: "ball", payload: { wicket: { type: "bowled" } } }, /free hit/);
    m.no({ type: "ball", payload: { wicket: { type: "caught", fielder: B(3) } } }, /free hit/);
    m.ball({ extra: "wide" });
    expect(m.inn.freeHit).toBe(true);
    m.ball({ runs: 2 });
    expect(m.inn.freeHit).toBe(false);
    m.ball({ wicket: { type: "bowled" } });
    expect(m.inn.wickets).toBe(1);
  });
  it("a run-out is allowed on a free hit", () => {
    const m = new Match(); m.start();
    m.ball({ extra: "noball" });
    m.ball({ runs: 1, wicket: { type: "run_out", out: A(1), fielder: B(3) } });
    expect(m.inn.wickets).toBe(1);
  });
  it("can be switched off for a match", () => {
    const m = new Match({ freeHit: false }); m.start();
    m.ball({ extra: "noball" });
    expect(m.inn.freeHit).toBe(false);
    m.ball({ wicket: { type: "bowled" } }); // allowed? a no ball only allows run-out, but this is the next fair ball
    expect(m.inn.wickets).toBe(1);
  });
  it("a wicket other than a run-out is refused on a no ball itself", () => {
    const m = new Match(); m.start();
    m.no({ type: "ball", payload: { extra: "noball", wicket: { type: "bowled" } } }, /no ball/i);
    m.no({ type: "ball", payload: { extra: "wide", wicket: { type: "bowled" } } }, /wide/i);
    m.ball({ extra: "wide", wicket: { type: "stumped", fielder: B(3) } });
    expect(m.inn.wickets).toBe(1);
  });
});

describe("overs", () => {
  it("six balls end an over: strike changes, a new bowler is needed, and nothing is scored until chosen", () => {
    const m = new Match(); m.start();
    m.runs(0, 0, 0, 0, 0, 0);
    expect(m.inn).toMatchObject({ legalBalls: 6, needBowler: true, striker: A(2), nonStriker: A(1) });
    m.no({ type: "ball", payload: { runs: 1 } }, /bowler/);
    m.no({ type: "bowler", payload: { player: B(1) } }, /last over|two overs/i);
    m.no({ type: "bowler", payload: { player: A(1) } }, /bowling side/);
    m.bowler(B(2));
    expect(m.inn.needBowler).toBe(false);
    expect(m.inn.bowlers[B(1)]!.maidens).toBe(1);
  });
  it("a wide does not count towards the six; the over has six fair balls", () => {
    const m = new Match(); m.start();
    m.ball({ extra: "wide" });
    m.runs(0, 0, 0, 0, 0);
    expect(m.inn.needBowler).toBe(false);
    m.runs(0);
    expect(m.inn.needBowler).toBe(true);
    expect(m.inn.bowlers[B(1)]!.maidens).toBe(0);   // the wide was charged
  });
  it("the same bowler may bowl two overs in a row if the rule allows", () => {
    const m = new Match({ sameBowlerTwoInARow: true }); m.start();
    m.runs(0, 0, 0, 0, 0, 0);
    m.bowler(B(1));
    expect(m.inn.bowler).toBe(B(1));
  });
  it("balls per over is a setting", () => {
    const m = new Match({ ballsPerOver: 4 }); m.start();
    m.runs(0, 0, 0, 0);
    expect(m.inn.needBowler).toBe(true);
  });
  it("the innings ends when the overs are bowled, and the second innings starts with a target", () => {
    const m = new Match({}, { overs: 2 }); m.start();
    m.over(B(2), [1, 0, 0, 0, 0, 0]);
    m.runs(2, 0, 0, 0, 0, 0);
    expect(m.inn).toMatchObject({ ended: true, endReason: "overs", runs: 3 });
    expect(m.s.phase).toBe("need_innings");
    m.start({ striker: B(1), nonStriker: B(2) }, A(1));
    expect(m.inn).toMatchObject({ batting: 2, target: 4, maxOvers: 2 });
    expect(requiredRate(m.inn, 6)).toBeCloseTo(2);
  });
  it("maidens are counted only for a full over by one bowler with no runs charged", () => {
    const m = new Match(); m.start();
    m.runs(0, 0, 0, 0, 0, 0); m.bowler(B(2));
    m.ball({ extra: "bye", runs: 1 }); m.runs(0, 0, 0, 0, 0);
    expect(m.inn.bowlers[B(2)]!.maidens).toBe(1);   // a bye is not charged to the bowler, so the over is still a maiden
    m.bowler(B(3));
    m.runs(0, 0, 0, 0, 0, 1);
    expect(m.inn.bowlers[B(3)]!.maidens).toBe(0);   // a run off the bat spoils it
    m.bowler(B(4));
    m.ball({ extra: "wide" }); m.runs(0, 0, 0, 0, 0, 0);
    expect(m.inn.bowlers[B(4)]!.maidens).toBe(0);   // a wide is charged to the bowler
  });
});

describe("wickets", () => {
  it("a wicket takes the batter out, records the fall, credits the bowler, and needs the next batter", () => {
    const m = new Match(); m.start();
    m.runs(2);
    m.ball({ wicket: { type: "bowled" } });
    expect(m.inn).toMatchObject({ wickets: 1, needBatter: true, striker: null, vacant: "striker" });
    expect(m.inn.fow).toEqual([{ n: 1, runs: 2, over: "0.2", player: A(1) }]);
    expect(m.inn.bowlers[B(1)]!.wickets).toBe(1);
    expect(dismissalText(m.s, m.inn.batters[A(1)]!)).toBe("b Bravo1");
    m.no({ type: "ball", payload: { runs: 1 } }, /next batter/);
    m.no({ type: "batter_in", payload: { player: A(2) } }, /cannot bat/);
    m.no({ type: "batter_in", payload: { player: B(3) } }, /batting side/);
    m.batter(A(3));
    expect(m.inn).toMatchObject({ striker: A(3), nonStriker: A(2), needBatter: false });
    expect(m.inn.partnership).toEqual({ runs: 0, balls: 0 });
  });
  it("the next batter can be chosen at either end with one tap", () => {
    const m = new Match(); m.start();
    m.ball({ wicket: { type: "caught", fielder: B(4) } });
    expect(dismissalText(m.s, m.inn.batters[A(1)]!)).toBe("c Bravo4 b Bravo1");
    m.batter(A(3), "nonStriker");
    expect(m.inn).toMatchObject({ striker: A(2), nonStriker: A(3) });
  });
  it("any available batter can be chosen, not only the next in order, including a late player", () => {
    const m = new Match(); m.start();
    m.ball({ wicket: { type: "lbw" } });
    m.batter(A(6));
    expect(m.inn.striker).toBe(A(6));
    expect(m.inn.batters[A(6)]!.order).toBe(3);
  });
  it("refuses a way of getting out that is switched off, runs on a bowled ball, or a fielder from the wrong side", () => {
    const m = new Match({ dismissals: ["bowled", "run_out"] }); m.start();
    m.no({ type: "ball", payload: { wicket: { type: "caught", fielder: B(3) } } }, /switched off/);
    m.no({ type: "ball", payload: { runs: 1, wicket: { type: "bowled" } } }, /Runs cannot/);
    m.no({ type: "ball", payload: { wicket: { type: "run_out", fielder: A(3) } } }, /fielding side/);
    m.no({ type: "ball", payload: { wicket: { type: "run_out", out: A(5), fielder: B(3) } } }, /at the crease/);
  });
  it("a catch, a stumping and a run-out must name the fielder; the fielder must be on the fielding side; the bowler can take a catch", () => {
    const m = new Match(); m.start();
    m.no({ type: "ball", payload: { wicket: { type: "caught" } } }, /who took the catch/);
    m.no({ type: "ball", payload: { wicket: { type: "stumped" } } }, /wicket-keeper/);
    m.no({ type: "ball", payload: { runs: 1, wicket: { type: "run_out", out: A(1) } } }, /fielder who ran/);
    m.no({ type: "ball", payload: { wicket: { type: "caught", fielder: A(3) } } }, /fielding side/);
    m.ball({ wicket: { type: "caught", fielder: B(1) } });                       // caught and bowled
    expect(dismissalText(m.s, m.inn.batters[A(1)]!)).toBe("c & b Bravo1");
    m.batter(A(3));
    m.ball({ wicket: { type: "bowled" } });                                         // no fielder needed
    expect(m.inn.wickets).toBe(2);
  });
  it("a stumped wicket is the bowler's; a run-out is not", () => {
    const m = new Match(); m.start();
    m.ball({ wicket: { type: "stumped", fielder: B(6) } });
    expect(m.inn.bowlers[B(1)]!.wickets).toBe(1);
    expect(dismissalText(m.s, m.inn.batters[A(1)]!)).toBe("st Bravo6 b Bravo1");
    m.batter(A(3));
    m.ball({ runs: 0, wicket: { type: "run_out", out: A(2), fielder: B(3) } });
    expect(m.inn.bowlers[B(1)]!.wickets).toBe(1);
    expect(m.inn.wickets).toBe(2);
  });
});

describe("run-outs", () => {
  it("counts the runs completed before the run-out and credits them to the batter, not the bowler's wickets", () => {
    const m = new Match(); m.start();
    m.ball({ runs: 1, wicket: { type: "run_out", out: A(2), fielder: B(3) } });   // 1 + out: non-striker out
    expect(m.inn).toMatchObject({ runs: 1, wickets: 1, legalBalls: 1 });
    expect(m.inn.batters[A(1)]!.runs).toBe(1);
    expect(m.inn.bowlers[B(1)]).toMatchObject({ wickets: 0, runs: 1 });
    expect(m.inn.batters[A(2)]!.status).toBe("out");
    // they crossed once: A1 is now at the non-striker's end; the new batter takes the striker's end by default
    expect(m.inn).toMatchObject({ nonStriker: A(1), vacant: "striker" });
    m.batter(A(3));
    expect(m.inn).toMatchObject({ striker: A(3), nonStriker: A(1) });
  });
  it("0 + out, with the striker out", () => {
    const m = new Match(); m.start();
    m.ball({ runs: 0, wicket: { type: "run_out", out: A(1), fielder: B(3) } });
    expect(m.inn).toMatchObject({ runs: 0, striker: null, nonStriker: A(2), vacant: "striker" });
  });
  it("2 + out keeps the ends, and the new batter can take the other end with one tap", () => {
    const m = new Match(); m.start();
    m.ball({ runs: 2, wicket: { type: "run_out", out: A(1), fielder: B(3) } });
    expect(m.inn.runs).toBe(2);
    m.batter(A(3), "nonStriker");
    expect(m.inn).toMatchObject({ striker: A(2), nonStriker: A(3) });
  });
  it("is allowed on a wide and on a no ball: the extra run is added, the ball is not counted", () => {
    const m = new Match(); m.start();
    m.ball({ extra: "wide", runs: 1, wicket: { type: "run_out", out: A(2), fielder: B(3) } });
    expect(m.inn).toMatchObject({ runs: 2, legalBalls: 0, wickets: 1 });
    expect(m.inn.extras.wide).toBe(2);
    m.batter(A(3));
    m.ball({ extra: "noball", runs: 1, wicket: { type: "run_out", out: A(3), fielder: B(3) } });
    expect(m.inn).toMatchObject({ runs: 4, legalBalls: 0, wickets: 2 });
    expect(m.inn.freeHit).toBe(true);
  });
  it("a run-out on the last ball of an over also changes the bowler and the strike for the next over", () => {
    const m = new Match(); m.start();
    m.runs(0, 0, 0, 0, 0);
    m.ball({ runs: 0, wicket: { type: "run_out", out: A(1), fielder: B(3) } });
    expect(m.inn.needBowler).toBe(true);
    expect(m.inn).toMatchObject({ striker: A(2), nonStriker: null });   // A2 faces the next over
    expect(m.inn.vacant).toBe("nonStriker");                            // so the new batter is at the other end
    m.batter(A(3));
    m.bowler(B(2));
    expect(m.inn).toMatchObject({ striker: A(2), nonStriker: A(3) });
  });
});

describe("all out and the last batter", () => {
  function allButOne(m: Match, n: number) {
    // n wickets, always bowled, choosing the next batter in order
    let next = 3;
    for (let i = 0; i < n; i++) {
      m.ball({ wicket: { type: "bowled" } });
      if (m.inn.ended) return;
      if (m.inn.needBatter) m.batter(A(next++));
      if (m.inn.needBowler) m.bowler(m.inn.lastOverBowler === B(1) ? B(2) : B(1));
    }
  }
  it("the last batter can bat alone: six players, six wickets, then the innings ends", () => {
    const m = new Match(); m.start();
    allButOne(m, 5);
    expect(m.inn).toMatchObject({ wickets: 5, ended: false, nonStriker: null });
    expect(m.inn.striker).toBeTruthy();
    m.ball({ runs: 1 });                        // lone batter: no change of strike
    expect(m.inn.nonStriker).toBeNull();
    if (m.inn.needBowler) m.bowler(B(2));
    m.ball({ wicket: { type: "lbw" } });
    expect(m.inn).toMatchObject({ wickets: 6, ended: true, endReason: "allout" });
  });
  it("with the switch off the innings ends when one batter is left (five wickets for six players)", () => {
    const m = new Match({ lastBatterAlone: false }); m.start();
    allButOne(m, 5);
    expect(m.inn).toMatchObject({ wickets: 5, ended: true, endReason: "allout" });
  });
  it("a short side ends when it runs out of batters", () => {
    const m = new Match({}, { n: 3, pps: 6 }); m.start();
    m.ball({ wicket: { type: "bowled" } }); m.batter(A(3));
    m.ball({ wicket: { type: "bowled" } });
    expect(m.inn).toMatchObject({ wickets: 2, ended: false, nonStriker: null });
    m.ball({ wicket: { type: "bowled" } });
    expect(m.inn.ended).toBe(true);
  });
  it("lone batter: end of an over does not swap strike", () => {
    const m = new Match(); m.start();
    allButOne(m, 5);
    const lone = m.inn.striker;
    const before = m.inn.legalBalls % 6;
    m.runs(...Array(6 - before).fill(0));
    expect(m.inn.striker).toBe(lone);
  });
});

describe("chasing, results and super overs", () => {
  function firstInnings(m: Match, total: number) {
    m.start();
    // score `total` quickly: sixes then singles in a 6-over innings, new bowler each over
    let left = total;
    let bowlers = [B(2), B(1)];
    let overs = 0;
    for (let i = 0; i < 36 && !m.inn.ended; i++) {
      const r = left >= 6 ? 6 : left;
      m.ball({ runs: r }); left -= r;
      if (m.inn.needBowler) m.bowler(bowlers[overs++ % 2]!);
    }
  }
  it("the chase ends the moment the target is reached; the win is by wickets left", () => {
    const m = new Match({}, { overs: 1 });
    m.start(); m.runs(6, 6, 6, 0, 0, 0);                    // 18
    expect(m.inn).toMatchObject({ ended: true, runs: 18 });
    m.start({ striker: B(1), nonStriker: B(2) }, A(1));
    expect(m.inn.target).toBe(19);
    m.runs(6, 6, 6);
    expect(m.inn.ended).toBe(false);
    m.ball({ runs: 1 });
    expect(m.inn).toMatchObject({ ended: true, endReason: "target", legalBalls: 4 });
    expect(m.s.phase).toBe("result");
    expect(m.s.result).toMatchObject({ kind: "win", winner: 2, margin: { type: "wickets", n: 6 }, text: "Bravo won by 6 wickets" });
    m.ok({ type: "finish", payload: {} });
    expect(m.s.phase).toBe("finished");
    m.no({ type: "ball", payload: { runs: 1 } }, /finished|locked/i);
  });
  it("the side batting first wins by runs when the chase falls short", () => {
    const m = new Match({}, { overs: 1 });
    m.start(); m.runs(6, 6, 6, 0, 0, 0);
    m.start({ striker: B(1), nonStriker: B(2) }, A(1));
    m.runs(1, 1, 1, 1, 1, 1);
    expect(m.s.result).toMatchObject({ kind: "win", winner: 1, margin: { type: "runs", n: 12 }, text: "Alpha won by 12 runs" });
  });
  it("a level score is a tie by default if the rule says never; otherwise it asks about a super over", () => {
    const tie = new Match({ superOver: "never" }, { overs: 1 });
    tie.start(); tie.runs(1, 1, 1, 1, 1, 1);
    tie.start({ striker: B(1), nonStriker: B(2) }, A(1)); tie.runs(1, 1, 1, 1, 1, 1);
    expect(tie.s.phase).toBe("result");
    expect(tie.s.result).toMatchObject({ kind: "tie" });

    const ask = new Match({ superOver: "ask" }, { overs: 1 });
    ask.start(); ask.runs(1, 1, 1, 1, 1, 1);
    ask.start({ striker: B(1), nonStriker: B(2) }, A(1)); ask.runs(1, 1, 1, 1, 1, 1);
    expect(ask.s.phase).toBe("level_prompt");
    ask.ok({ type: "super_over_decision", payload: { play: false } });
    expect(ask.s).toMatchObject({ phase: "result", result: { kind: "tie" } });
  });
  it("a super over: the side that batted second bats first, one over each, and the winner is decided", () => {
    const m = new Match({ superOver: "ask" }, { overs: 1 });
    m.start(); m.runs(1, 1, 1, 1, 1, 1);
    m.start({ striker: B(1), nonStriker: B(2) }, A(1)); m.runs(1, 1, 1, 1, 1, 1);
    m.ok({ type: "super_over_decision", payload: { play: true } });
    expect(m.s.phase).toBe("need_innings");
    m.start({ striker: B(3), nonStriker: B(4) }, A(2));
    expect(m.inn).toMatchObject({ superOver: true, batting: 2, maxOvers: 1 });
    m.runs(4, 4, 4, 0, 0, 0);
    m.start({ striker: A(3), nonStriker: A(4) }, B(5));
    expect(m.inn).toMatchObject({ superOver: true, batting: 1, target: 13 });
    m.runs(6, 6, 6);
    expect(m.s.result).toMatchObject({ kind: "win", winner: 1, text: expect.stringContaining("super over") });
  });
  it("'always' goes straight to a super over without asking", () => {
    const m = new Match({ superOver: "always" }, { overs: 1 });
    m.start(); m.runs(2, 0, 0, 0, 0, 0);
    m.start({ striker: B(1), nonStriker: B(2) }, A(1)); m.runs(2, 0, 0, 0, 0, 0);
    expect(m.s.phase).toBe("need_innings");
  });
  it("a one-innings match just records the score", () => {
    const m = new Match({ innings: 1 }, { overs: 1 });
    m.start(); m.runs(1, 2, 3, 0, 0, 0);
    expect(m.s.phase).toBe("result");
    expect(m.s.result).toMatchObject({ kind: "innings", text: "Alpha scored 6 for 0" });
  });
  it("a revised target can be entered by hand; otherwise the target stays where it is", () => {
    const m = new Match({}, { overs: 2 });
    firstInnings(m, 20);
    expect(m.s.innings[0]!.runs).toBe(20);
    m.start({ striker: B(1), nonStriker: B(2) }, A(1));
    expect(m.inn.target).toBe(21);
    m.ok({ type: "overs_change", payload: { overs: 1, scope: "innings" } });
    expect(m.inn.target).toBe(21);               // target does not move when overs are cut
    m.ok({ type: "target_manual", payload: { target: 15 } });
    m.runs(6, 6, 3);
    expect(m.inn).toMatchObject({ ended: true, endReason: "target" });
    m.no({ type: "target_manual", payload: { target: 0 } });
  });
});

describe("undo and edit", () => {
  it("undo takes away the latest event, one at a time, with strike and totals restored", () => {
    const m = new Match(); m.start();
    m.runs(1, 4);
    m.undo();
    expect(m.inn).toMatchObject({ runs: 1, legalBalls: 1, striker: A(2) });
    m.undo();
    expect(m.inn).toMatchObject({ runs: 0, legalBalls: 0, striker: A(1) });
    m.undo();                                   // undoes the innings start
    expect(m.s.phase).toBe("need_innings");
    m.no({ type: "undo", payload: {} }, /start or the end/);
  });
  it("undo of a wicket brings the batter back; undo of a late player removes them", () => {
    const m = new Match({}, { pps: 7 }); m.start();
    m.ball({ wicket: { type: "bowled" } });
    m.undo();
    expect(m.inn).toMatchObject({ wickets: 0, striker: A(1), needBatter: false });
    m.ok({ type: "player_added", payload: { player: { id: "g1", side: 1, name: "Sami", number: null, kind: "guest", userId: null } } }, "pa");
    m.undo();
    expect(m.s.players["g1"]).toBeUndefined();
  });
  it("is the same after any number of undo and redo", () => {
    const m = new Match(); m.start();
    m.runs(1, 2, 3); m.undo(); m.undo(); m.runs(4);
    expect(m.inn.runs).toBe(5);
  });
  it("an earlier delivery can be edited and everything after it is recalculated", () => {
    const m = new Match(); m.start();
    const first = m.ball({ runs: 1 }, "ball-1");
    m.runs(2, 0);
    expect(m.inn).toMatchObject({ runs: 3, striker: A(2) });
    m.ok({ type: "edit", payload: { target: first.id, patch: { runs: 4 } } });
    expect(m.inn.runs).toBe(6);
    expect(m.inn.striker).toBe(A(1));                          // 4 does not change the strike, so the later balls went to the other batter
    expect(m.inn.batters[A(1)]!.fours).toBe(1);
    expect(m.s.timeline.some((t) => /corrected/.test(t.text))).toBe(true);
    m.undo();                                                  // an edit can itself be undone
    expect(m.inn.runs).toBe(3);
  });
  it("an edit that would break the balls after it is refused", () => {
    const m = new Match(); m.start();
    const w = m.ball({ wicket: { type: "bowled" } }, "w1");
    m.batter(A(3));
    m.ball({ runs: 1 });
    m.no({ type: "edit", payload: { target: w.id, patch: { wicket: null } } }, /batter|cannot/i);
    m.no({ type: "edit", payload: { target: "nope", patch: { runs: 1 } } }, /cannot be edited/);
  });
});

describe("bowler limits (locked)", () => {
  it("a maximum per bowler: a bowler who used their overs cannot be picked, and the reason is given", () => {
    const m = new Match({ bowlerLimit: { mode: "max", overs: 1 } }, { overs: 6 }); m.start();
    m.over(B(2));
    const sel = selectableBowlers(m.s, m.inn).find((x) => x.player.id === B(1))!;
    expect(sel.ok).toBe(false);
    m.over(B(3));
    m.no({ type: "bowler", payload: { player: B(2) } }, /used all 1 over/);
    m.over(B(4));
    expect(m.inn.bowler).toBe(B(4));
  });
  it("the pattern 2-1-1 in 4 overs: one bowler may bowl 2 (not in a row), the others 1 each", () => {
    const m = new Match({ bowlerLimit: { mode: "pattern", pattern: [2, 1, 1] } }, { overs: 4 }); m.start();   // over 1: B1
    m.over(B(2));                                             // over 2: B2
    m.over(B(1));                                             // over 3: B1 again (his 2nd: he takes the 2-over slot)
    m.runs(0, 0, 0, 0, 0, 0);
    m.no({ type: "bowler", payload: { player: B(2) } }, /pattern/);   // B2 would be a second 2-over bowler
    m.no({ type: "bowler", payload: { player: B(1) } }, /pattern|last over/i);
    m.bowler(B(3));                                           // a third bowler takes the last 1-over slot
    expect(m.inn.bowler).toBe(B(3));
    const ok = selectableBowlers(m.s, m.inn).filter((x) => x.ok).map((x) => x.player.id);
    expect(ok).toContain(B(3));
    expect(ok).not.toContain(B(1));    // already has his two
    expect(ok).not.toContain(B(2));    // would be a second two-over bowler
  });
  it("a fourth bowler is refused once the three slots are taken", () => {
    const m = new Match({ bowlerLimit: { mode: "pattern", pattern: [2, 1, 1] } }, { overs: 4 }); m.start();   // B1
    m.over(B(2));      // B2
    m.over(B(3));      // B3
    m.runs(0, 0, 0, 0, 0, 0);
    m.no({ type: "bowler", payload: { player: B(4) } }, /pattern/);
    m.no({ type: "bowler", payload: { player: B(3) } }, /last over|two overs/i);
    m.bowler(B(1));    // B1's 2nd over: fine
    expect(m.inn.bowler).toBe(B(1));
    const sel = selectableBowlers(m.s, m.inn);
    const okIds = sel.filter((x) => x.ok).map((x) => x.player.id);
    expect(okIds).toContain(B(1));
    expect(okIds).not.toContain(B(4));
    expect(okIds).not.toContain(B(5));
  });
  it("the first bowler may be the one who takes only one over; any bowler can take the 2-over slot once", () => {
    const m = new Match({ bowlerLimit: { mode: "pattern", pattern: [2, 1, 1] } }, { overs: 4 }); m.start();   // B1 bowls 1
    m.over(B(2)); m.over(B(3));
    m.over(B(2));                                          // B2 takes the 2-slot instead
    expect(m.inn.bowler).toBe(B(2));
    m.runs(0, 0, 0, 0, 0, 0);
    expect(m.inn.ended).toBe(true);
  });
  it("a bowler cannot be picked who is gone; the limit can be changed with a logged event", () => {
    const m = new Match({ bowlerLimit: { mode: "max", overs: 1 } }, { overs: 6 }); m.start();
    m.over(B(2));
    m.ok({ type: "limit_change", payload: { limit: { mode: "none" } } });
    m.over(B(1));
    expect(m.inn.bowler).toBe(B(1));
    expect(m.s.timeline.some((t) => /limit changed from 1 over each to no limit/.test(t.text))).toBe(true);
    m.no({ type: "limit_change", payload: { limit: { mode: "pattern", pattern: [3] } } });
  });
  it("super overs ignore the over limit", () => {
    const m = new Match({ bowlerLimit: { mode: "max", overs: 1 }, superOver: "always" }, { overs: 1 }); m.start();
    m.runs(1, 0, 0, 0, 0, 0);
    m.start({ striker: B(1), nonStriker: B(2) }, A(1)); m.runs(1, 0, 0, 0, 0, 0);
    m.start({ striker: B(3), nonStriker: B(4) }, A(1));       // A1 bowled over 1 of the match; allowed again in the super over
    expect(m.inn.bowler).toBe(A(1));
  });
});

describe("changing the match while it is live", () => {
  it("overs can be reduced or increased, for this innings or all remaining, never below what is bowled", () => {
    const m = new Match({}, { overs: 6 }); m.start();
    m.over(B(2)); m.runs(0, 0, 1);
    m.no({ type: "overs_change", payload: { overs: 1, scope: "innings" } }, /already been bowled/);
    m.ok({ type: "overs_change", payload: { overs: 5, scope: "innings" } });
    expect(m.inn.maxOvers).toBe(5);
    expect(m.s.overs).toBe(6);
    expect(m.s.timeline.at(-1)!.text).toBe("Overs reduced from 6 to 5 for this innings after 1.3 overs");
    m.ok({ type: "overs_change", payload: { overs: 8, scope: "remaining" } });
    expect(m.s.overs).toBe(8);
    expect(m.inn.maxOvers).toBe(8);
    m.ok({ type: "overs_change", payload: { overs: 2, scope: "remaining" } });
    m.runs(0, 0, 0);
    expect(m.inn.ended).toBe(true);
    expect(m.s.overs).toBe(2);
  });
  it("cutting the overs to exactly what has been bowled ends the innings", () => {
    const m = new Match({}, { overs: 6 }); m.start();
    m.over(B(2));
    m.ok({ type: "overs_change", payload: { overs: 1, scope: "innings" } });
    expect(m.inn.ended).toBe(true);
    m.no({ type: "overs_change", payload: { overs: 0, scope: "innings" } });
    m.no({ type: "overs_change", payload: { overs: 51, scope: "remaining" } });
  });
  it("a late player or guest joins a side at any time, after the innings started, and can be the next batter", () => {
    const m = new Match({}, { n: 5, pps: 6 }); m.start();
    m.runs(1, 1);
    m.ok({ type: "player_added", payload: { player: { id: "late", side: 1, name: "Hamza", number: 7, kind: "member", userId: "u-hamza" } } });
    expect(m.s.timeline.at(-1)!.text).toBe("Hamza joined Alpha after 0.2 overs");
    m.ball({ wicket: { type: "bowled" } });
    expect(selectableBatters(m.s, m.inn).map((c) => c.player.id)).toContain("late");
    m.batter("late");
    expect(m.inn.striker ?? m.inn.nonStriker).toBeTruthy();
    m.ok({ type: "player_added", payload: { player: { id: "gst", side: 2, name: "Imran", number: null, kind: "guest", userId: null } } }, "pa2");
    expect(m.s.timeline.at(-1)!.text).toMatch(/Imran \(guest\) joined Bravo/);
  });
  it("a late player is refused when the side is full, a duplicate member, or a duplicate guest; raising the limit fixes it", () => {
    const m = new Match(); m.start();
    const p = (id: string, side: Side, name: string, userId: string | null = null): PlayerEntry => ({ id, side, name, number: null, kind: userId ? "member" : "guest", userId });
    m.no({ type: "player_added", payload: { player: p("x", 1, "Full side") } }, /Raise/);
    m.ok({ type: "players_change", payload: { playersPerSide: 7 } });
    m.ok({ type: "player_added", payload: { player: p("x", 1, "Sami") } }, "pa");
    m.no({ type: "player_added", payload: { player: p("y", 2, "sami") } }, /already/);
    m.no({ type: "player_added", payload: { player: p("z", 2, "Other", "ua3") } }, /already in this match/);
    m.no({ type: "players_change", payload: { playersPerSide: 1 } });
    m.no({ type: "players_change", payload: { playersPerSide: 12 } });
  });
  it("changing players per side during the match changes when the innings ends", () => {
    const m = new Match({ lastBatterAlone: false }, { n: 6, pps: 6 }); m.start();
    m.ok({ type: "players_change", payload: { playersPerSide: 4 } });
    m.ball({ wicket: { type: "bowled" } }); m.batter(A(3));
    m.ball({ wicket: { type: "bowled" } }); m.batter(A(4));
    m.ball({ wicket: { type: "bowled" } });
    expect(m.inn).toMatchObject({ wickets: 3, ended: true });   // 4 players, one left, not allowed to bat alone
  });
  it("retired hurt can return, retired out is a wicket, absent and replaced players are taken out", () => {
    const m = new Match(); m.start();
    m.ok({ type: "retire", payload: { player: A(2), kind: "retired_hurt" } });
    expect(m.inn).toMatchObject({ wickets: 0, needBatter: true });
    m.batter(A(3));
    m.ball({ wicket: { type: "bowled" } });
    expect(selectableBatters(m.s, m.inn).find((c) => c.player.id === A(2))?.returning).toBe(true);
    m.batter(A(2));
    expect(m.inn.batters[A(2)]!.status).toBe("batting");
    m.ok({ type: "retire", payload: { player: A(3), kind: "retired_out" } });
    expect(m.inn.wickets).toBe(2);
    expect(dismissalText(m.s, m.inn.batters[A(3)]!)).toBe("retired out");
    expect(m.inn.bowlers[B(1)]!.wickets).toBe(1);
    m.batter(A(4));
    m.no({ type: "retire", payload: { player: A(2), kind: "absent" } }, /batting or bowling/);
    m.ok({ type: "retire", payload: { player: A(6), kind: "absent" } });
    expect(selectableBatters(m.s, m.inn).map((c) => c.player.id)).not.toContain(A(6));
    m.ok({ type: "retire", payload: { player: B(6), kind: "replaced", replacedBy: B(5) } });
    m.no({ type: "retire", payload: { player: B(5), kind: "replaced", replacedBy: A(1) } });
  });
  it("retired hurt cannot return if the rule says so", () => {
    const m = new Match({ retiredCanReturn: false }); m.start();
    m.ok({ type: "retire", payload: { player: A(2), kind: "retired_hurt" } });
    m.batter(A(3));
    m.ball({ wicket: { type: "bowled" } });
    expect(selectableBatters(m.s, m.inn).map((c) => c.player.id)).not.toContain(A(2));
  });
  it("a bowler can be changed in the middle of an over, and the over still ends after six fair balls", () => {
    const m = new Match(); m.start();
    m.runs(0, 0, 0);
    m.bowler(B(2));
    expect(m.s.timeline.at(-1)!.text).toBe("Bravo2 replaced Bravo1 mid-over after 0.3 overs");
    m.runs(1, 0, 0);
    expect(m.inn.needBowler).toBe(true);
    expect(m.inn.bowlers[B(1)]!.legalBalls).toBe(3);
    expect(m.inn.bowlers[B(2)]!.legalBalls).toBe(3);
    expect(m.inn.bowlers[B(2)]!.maidens + m.inn.bowlers[B(1)]!.maidens).toBe(0);   // two bowlers shared it
    m.no({ type: "bowler", payload: { player: B(2) } }, /last over|two overs/i);
  });
  it("strike can be swapped, batters corrected, and the remaining batters reordered", () => {
    const m = new Match(); m.start();
    m.ok({ type: "swap_strike", payload: {} });
    expect(m.inn.striker).toBe(A(2));
    m.ok({ type: "set_crease", payload: { striker: A(1), nonStriker: A(3) } });
    expect(m.inn).toMatchObject({ striker: A(1), nonStriker: A(3) });
    expect(m.inn.batters[A(2)]).toBeUndefined();
    m.runs(1);
    m.no({ type: "set_crease", payload: { striker: A(4), nonStriker: A(3) } }, /already batted/);
    m.ok({ type: "batting_order", payload: { order: [A(6), A(5)] } });
    m.ball({ wicket: { type: "bowled" } });
    expect(selectableBatters(m.s, m.inn)[0]!.player.id).toBe(A(6));
    m.no({ type: "batting_order", payload: { order: [B(1)] } }, /batting side/);
  });
  it("penalty runs, early end of an innings, a substitute fielder and pause/resume", () => {
    const m = new Match(); m.start();
    m.ok({ type: "penalty", payload: { runs: 5 } });
    expect(m.inn).toMatchObject({ runs: 5, legalBalls: 0 });
    expect(m.inn.extras.penalty).toBe(5);
    m.ok({ type: "substitute", payload: { side: 2, name: "Rafay" } });
    expect(m.s.timeline.at(-1)!.text).toMatch(/Substitute fielder Rafay/);
    m.ok({ type: "pause", payload: {} });
    m.no({ type: "ball", payload: { runs: 1 } }, /paused/);
    m.ok({ type: "resume", payload: {} });
    m.runs(1);
    m.ok({ type: "innings_end", payload: {} });
    expect(m.inn).toMatchObject({ ended: true, endReason: "declared" });
    m.no({ type: "penalty", payload: { runs: 0 } });
    expect(m.s.phase).toBe("need_innings");
  });
  it("the match can be abandoned or ended early with a result, and then it is locked", () => {
    const m = new Match(); m.start(); m.runs(1);
    m.ok({ type: "match_end", payload: { kind: "abandoned" } });
    expect(m.s).toMatchObject({ phase: "abandoned", result: { kind: "abandoned" } });
    m.no({ type: "ball", payload: { runs: 1 } }, /locked|finished/);
    const n = new Match(); n.start(); n.runs(1);
    n.ok({ type: "match_end", payload: { kind: "result", winner: 2 } });
    expect(n.s).toMatchObject({ phase: "finished", result: { kind: "win", winner: 2 } });
  });
});

describe("the record of what happened", () => {
  it("keeps every ball with its label, text and who bowled to whom", () => {
    const m = new Match(); m.start();
    m.ball({ extra: "wide", runs: 1 }); m.ball({ runs: 4 }); m.ball({ wicket: { type: "bowled" } });
    expect(m.inn.balls.map((b) => b.label)).toEqual(["Wd+1", "4", "W"]);
    expect(m.inn.balls[1]!.text).toBe("0.1 Bravo1 to Alpha2: Four runs.");   // the wide + 1 changed the strike
    expect(m.inn.balls[0]!.text).toContain("Wide: 2 runs, ball not counted");
    expect(m.inn.overBalls).toHaveLength(3);
  });
  it("only a started match can take events; the first event must be the start", () => {
    const r = buildState([{ type: "ball", id: "x", seq: 1, payload: { runs: 1 } }]);
    expect(r.ok).toBe(false);
    expect(buildState([]).ok).toBe(true);
  });
  it("is a pure function: the same events always give the same state", () => {
    const m = new Match(); m.start(); m.runs(1, 4, 6, 0); m.ball({ wicket: { type: "caught", fielder: B(3) } });
    expect(JSON.stringify(buildState(m.events))).toBe(JSON.stringify(buildState(m.events)));
  });
});
