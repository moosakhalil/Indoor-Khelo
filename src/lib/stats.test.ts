import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type Rules } from "@/lib/matchRules";
import { buildState } from "@/lib/engine/engine";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import { STATS, buildBoard, careerOf, fmt, type MatchLine } from "./career";
import { computeMatchStats, matchFigures, oversSummary, partnershipsOf } from "./stats";

const A = (i: number) => `a${i}`;
const B = (i: number) => `b${i}`;
const players = (): PlayerEntry[] => [
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: A(i), side: 1 as Side, name: `Alpha${i}`, number: i, kind: "member" as const, userId: `ua${i}` })),
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: B(i), side: 2 as Side, name: `Bravo${i}`, number: i + 10, kind: "member" as const, userId: `ub${i}` })),
];

function run(rules: Partial<Rules>, bodies: ScoreEventBody[]) {
  const events = bodies.map((b, i) => ({ ...b, id: `e${i + 1}`, seq: i + 1 }) as ScoreEvent);
  const r = buildState(events);
  if (!r.ok) throw new Error(`refused at ${r.at}: ${r.error}`);
  void rules;
  return r.state;
}
const ball = (p: object): ScoreEventBody => ({ type: "ball", payload: p } as ScoreEventBody);
const start = (rules: Partial<Rules> = {}, overs = 2): ScoreEventBody => ({ type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs, playersPerSide: 6, rules: { ...DEFAULT_RULES, ...rules }, players: players(), toss: null, battingFirst: 1 } });

/** Alpha 19 in 2 overs, Bravo chase 20 in 5 balls. B1: 19 off 4 with three sixes, one wicket (caught by B2). */
function sampleMatch() {
  return run({}, [
    start(),
    { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
    ball({ runs: 4 }), ball({ runs: 1 }), ball({ runs: 6 }), ball({ extra: "wide" }), ball({ runs: 0 }),
    ball({ wicket: { type: "caught", fielder: B(2) } }),
    { type: "batter_in", payload: { player: A(3), end: "striker" } },
    ball({ runs: 2 }),
    { type: "bowler", payload: { player: B(2) } },
    ball({ runs: 1 }), ball({ runs: 4 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
    { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } },
    ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 1 }), ball({ runs: 1 }),
    { type: "finish", payload: {} },
  ]);
}

describe("statistics from one match", () => {
  const m = sampleMatch();
  const s = computeMatchStats(m);
  const p = (id: string) => s.players.find((x) => x.entryId === id)!;

  it("the match is what we think it is", () => {
    expect(m.phase).toBe("finished");
    expect(m.result).toMatchObject({ kind: "win", winner: 2, text: "Bravo won by 6 wickets" });
  });
  it("batting lines: runs, balls, boundaries, how out, how the runs came", () => {
    expect(p(A(1)).bat[0]).toMatchObject({ runs: 6, balls: 3, fours: 1, sixes: 0, out: null, singles: 2 });
    expect(p(A(2)).bat[0]).toMatchObject({ runs: 6, balls: 3, sixes: 1, out: "caught", dots: 2, golden: false });
    expect(p(B(1)).bat[0]).toMatchObject({ runs: 19, balls: 4, sixes: 3, out: null });
    expect(p(A(4)).bat).toEqual([]);   // did not bat
  });
  it("bowling lines: wicket, runs charged (the wide is charged), dots, maidens", () => {
    expect(p(B(1)).bowl[0]).toMatchObject({ balls: 6, runs: 14, wickets: 1, maidens: 0, dots: 2, wides: 1, byType: { caught: 1, caughtBowled: 0 } });
    expect(p(B(2)).bowl[0]).toMatchObject({ balls: 6, runs: 5, wickets: 0, dots: 4 });
  });
  it("fielding: the catch is credited to the fielder named", () => {
    expect(p(B(2)).field).toEqual({ catches: 1, caughtBowled: 0, stumpings: 0, runOuts: 0 });
    expect(p(B(1)).field.catches).toBe(0);
  });
  it("partnerships: the pair, runs and balls; a wide adds runs but is not a ball faced", () => {
    const parts = partnershipsOf(m.innings[0]!);
    expect(parts[0]).toMatchObject({ a: A(1), b: A(2), runs: 12, balls: 5, endedByWicket: true });
    expect(parts[1]).toMatchObject({ a: A(1), b: A(3), runs: 7, balls: 7 });
    expect(p(A(1)).partnerships.map((x) => x.withName).sort()).toEqual(["Alpha2", "Alpha3"]);
  });
  it("Player of the Match: points from the balls, the winner, the top three, and the breakdown", () => {
    expect(s.pom!.winners).toEqual([B(1)]);
    expect(p(B(1)).points).toBe(57);      // 19 runs + 6 for three sixes + 20 for the wicket + 2 dots + 10 winning side
    expect(p(B(2)).points).toBe(29);      // 1 run + 4 dots + 6 economy bonus (5 an over) + 8 for the catch + 10 winning side
    expect(s.pom!.top.map((t) => [t.name, t.points])).toEqual([["Bravo1", 57], ["Bravo2", 29], ["Alpha2", 8]]);
    expect(s.pom!.breakdown[B(1)]!.map((x) => x.label)).toEqual(expect.arrayContaining(["19 runs", "1 wicket", "winning side"]));
    expect(p(B(1)).pom).toBe(true);
    expect(p(A(1)).pom).toBe(false);
  });
  it("a tied match gives both sides 5; an abandoned match has no award; a manual no result has none", () => {
    const tie = run({ superOver: "never" }, [
      start({ superOver: "never" }, 1),
      { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }),
      { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } }, ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }),
      { type: "finish", payload: {} },
    ]);
    const t = computeMatchStats(tie);
    expect(tie.result?.kind).toBe("tie");
    expect(t.players.find((x) => x.entryId === A(1))!.points).toBeGreaterThanOrEqual(5);
    expect(t.pom).not.toBeNull();
    const ab = run({}, [start(), { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ball({ runs: 4 }), { type: "match_end", payload: { kind: "abandoned" } }]);
    expect(computeMatchStats(ab).pom).toBeNull();
    const nr = run({}, [start(), { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ball({ runs: 4 }), { type: "match_end", payload: { kind: "result", winner: null } }]);
    expect(computeMatchStats(nr).pom).toBeNull();
  });
  it("level points: the winning side, then runs, then wickets decide; a real tie is shared", () => {
    const shared = run({}, [
      start({}, 1),
      { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 1 }),
      { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } }, ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      { type: "finish", payload: {} },
    ]);
    const r = computeMatchStats(shared);
    expect(shared.result?.winner).toBe(1);
    expect(r.pom!.winners.length).toBeGreaterThanOrEqual(1);
    for (const w of r.pom!.winners) expect(r.players.find((x) => x.entryId === w)!.result).toBe("win");
  });
  it("super over innings are shown on the scorecard but kept out of the figures", () => {
    const so = run({ superOver: "always" }, [
      start({ superOver: "always" }, 1),
      { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ball({ runs: 1 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } }, ball({ runs: 1 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      { type: "innings_start", payload: { striker: B(3), nonStriker: B(4), bowler: A(2) } }, ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      { type: "innings_start", payload: { striker: A(3), nonStriker: A(4), bowler: B(5) } }, ball({ runs: 1 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      { type: "finish", payload: {} },
    ]);
    const x = computeMatchStats(so).players;
    expect(x.find((p) => p.entryId === B(3))!.bat).toEqual([]);       // his 12 in the super over are not in his career figures
    expect(so.innings).toHaveLength(4);
    expect(so.result?.text).toContain("super over");
  });
});

describe("the match report figures", () => {
  const m = sampleMatch();
  it("over by over: runs, wickets and balls for every over", () => {
    const o = oversSummary(m);
    expect(o.filter((x) => x.innings === 0).map((x) => [x.over, x.runs, x.wickets])).toEqual([[0, 14, 1], [1, 5, 0]]);
    expect(o.filter((x) => x.innings === 1)).toHaveLength(1);
  });
  it("match stats: boundaries, dot percentage, extras, best partnerships, top performers", () => {
    const f = matchFigures(m);
    expect(f).toMatchObject({ fours: 2, sixes: 4, extras: { wide: 1 } });
    expect(f.bestPartnerships[0]!.runs).toBe(20);
    expect(f.topBatters[0]!.name).toBe("Bravo1");
    expect(f.topBowlers[0]!.name).toBe("Bravo1");
    expect(f.dotPercent).toBeGreaterThan(0);
  });
  it("the ball-by-ball record keeps every delivery with its text", () => {
    expect(m.innings[0]!.balls).toHaveLength(13);
    expect(m.innings[0]!.balls[3]!.text).toContain("Wide: 1 run");
  });
});

describe("a player's career and the leaderboard", () => {
  const m = sampleMatch();
  const lineFor = (id: string): MatchLine => ({ ...computeMatchStats(m).players.find((x) => x.entryId === id)!, matchId: "m1", when: "2026-11-23T10:00:00Z", ballsPerOver: 6, teamName: "Bravo", opponent: "Alpha", resultText: "won", numberUsed: 11 });
  it("batting, bowling, fielding, record and awards add up", () => {
    const c = careerOf([lineFor(B(1))]);
    expect(c.matches).toBe(1);
    expect(c.batting).toMatchObject({ innings: 1, notOuts: 1, runs: 19, balls: 4, average: null, highest: { score: 19, notOut: true }, fours: 0, sixes: 3, ducks: 0 });
    expect(c.batting.strikeRate).toBeCloseTo(475);
    expect(c.bowling).toMatchObject({ wickets: 1, balls: 6, runs: 14, maidens: 0, best: { wickets: 1, runs: 14 } });
    expect(c.bowling.economy).toBeCloseTo(14);
    expect(c.bowling.average).toBe(14);
    expect(c.bowling.strikeRate).toBe(6);
    expect(c.record).toMatchObject({ played: 1, won: 1, lost: 0, winPercent: 100 });
    expect(c.awards).toMatchObject({ count: 1, points: 57 });
    expect(careerOf([lineFor(B(2))]).fielding).toMatchObject({ catches: 1, total: 1, matchesRecorded: 1 });
  });
  it("average is runs per time out; not outs are not counted as outs", () => {
    const c = careerOf([lineFor(A(2))]);     // out once for 6
    expect(c.batting.average).toBe(6);
    expect(c.batting.howOut).toMatchObject({ caught: 1, not_out: 0 });
    expect(c.batting.ducks).toBe(0);
  });
  it("a leaderboard lists every member, shares ranks, flips, and puts rate stats below the minimum last", () => {
    const mk = (userId: string, id: string) => ({ userId, name: userId, number: null, career: careerOf([lineFor(id)]) });
    const members = [mk("zed", B(1)), mk("amy", A(1)), mk("bob", A(2)), mk("cat", A(5))];
    const runs = STATS.find((x) => x.key === "runs")!;
    const board = buildBoard(members, runs);
    expect(board.map((r) => r.userId)).toEqual(["zed", "amy", "bob", "cat"]);
    expect(board.map((r) => [r.rank, r.tied])).toEqual([[1, false], [2, true], [2, true], [4, false]]);   // amy and bob tie on 6; cat has 0 runs
    expect(board.find((r) => r.userId === "cat")!.value).toBe(0);                    // nobody is hidden
    expect(buildBoard(members, runs, true)[0]!.userId).toBe("cat");                  // flipped
    const avg = STATS.find((x) => x.key === "bat_avg")!;
    const rate = buildBoard(members, avg);
    expect(rate.every((r) => !r.ranked)).toBe(true);                                 // one innings is below the minimum of 3
    expect(rate[0]!.note).toMatch(/at least 3 innings/);
    const wkts = buildBoard(members, STATS.find((x) => x.key === "wickets")!);
    expect(wkts[0]).toMatchObject({ userId: "zed", value: 1, rank: 1 });
    expect(fmt(3.456, { decimals: 2 })).toBe("3.46");
    expect(fmt(null, {})).toBe("–");
  });
});
