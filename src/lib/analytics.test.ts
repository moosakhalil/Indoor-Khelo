import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type Rules } from "@/lib/matchRules";
import { buildState } from "@/lib/engine/engine";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import { careerOf, type MatchLine } from "./career";
import {
  batterVsBowler, bowlerVsBatters, bowlingByOver, ballsToFifty, chaseProbability, communityRecords, compareCareers, formSeries, formSummary, normalCdf, partnershipPairs,
  runSources, scoresSeries, teamForm, winSeries, wormSeries, type HistoryItem, type StateRow,
} from "./analytics";
import { computeMatchStats } from "./stats";

const A = (i: number) => `a${i}`;
const B = (i: number) => `b${i}`;
const players = (): PlayerEntry[] => [
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: A(i), side: 1 as Side, name: `Alpha${i}`, number: i, kind: "member" as const, userId: `ua${i}` })),
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: B(i), side: 2 as Side, name: `Bravo${i}`, number: i + 10, kind: "member" as const, userId: `ub${i}` })),
];
const ball = (p: object): ScoreEventBody => ({ type: "ball", payload: p } as ScoreEventBody);
const start = (overs = 2, rules: Partial<Rules> = {}): ScoreEventBody => ({ type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs, playersPerSide: 6, rules: { ...DEFAULT_RULES, ...rules }, players: players(), toss: null, battingFirst: 1 } });
const state = (bodies: ScoreEventBody[]) => {
  const r = buildState(bodies.map((b, i) => ({ ...b, id: `e${i + 1}`, seq: i + 1 }) as ScoreEvent));
  if (!r.ok) throw new Error(`refused at ${r.at}: ${r.error}`);
  return r.state;
};
const row = (matchId: string, when: string, s: ReturnType<typeof state>): StateRow => ({ matchId, when, sides: ["Alpha", "Bravo"], teamIds: [null, null], state: s });
const sixes = (n: number) => Array.from({ length: n }, () => ball({ runs: 6 }));
const dots = (n: number) => Array.from({ length: n }, () => ball({ runs: 0 }));

/** Match 1: Alpha 19, Bravo chase 20 in 5 balls. B1 bowled over 1 (wicket: A2 caught by B2). */
const m1 = state([
  start(),
  { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
  ball({ runs: 4 }), ball({ runs: 1 }), ball({ runs: 6 }), ball({ extra: "wide" }), ball({ runs: 0 }), ball({ wicket: { type: "caught", fielder: B(2) } }),
  { type: "batter_in", payload: { player: A(3), end: "striker" } }, ball({ runs: 2 }),
  { type: "bowler", payload: { player: B(2) } }, ball({ runs: 1 }), ball({ runs: 4 }), ...dots(4),
  { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } },
  ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 1 }), ball({ runs: 1 }), { type: "finish", payload: {} },
]);

/** Match 2: Alpha 53 (A1 hits 52 not out, fifty in 9 balls, 8 sixes), Bravo 2. Alpha win. */
const m2 = state([
  start(),
  { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
  ...sixes(6),
  { type: "bowler", payload: { player: B(2) } },
  ball({ runs: 1 }), ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 4 }), ...dots(2),
  { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } },
  ball({ runs: 1 }), ball({ runs: 1 }), ...dots(4),
  { type: "bowler", payload: { player: A(2) } }, ...dots(6),
  { type: "finish", payload: {} },
]);

/** Match 3: four-over innings, one bowler a over (B1 B2 B3 B4), not finished: only the balls matter. */
const m3 = state([
  start(4),
  { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
  ball({ runs: 1 }), ...dots(5),
  { type: "bowler", payload: { player: B(2) } }, ...dots(6),
  { type: "bowler", payload: { player: B(3) } }, ball({ runs: 6 }), ...dots(5),
  { type: "bowler", payload: { player: B(4) } }, ...dots(6),
]);

describe("sample matches are what we think", () => {
  it("results", () => {
    expect(m1.result?.text).toBe("Bravo won by 6 wickets");
    expect(m2.result?.text).toBe("Alpha won by 51 runs");
    expect(m2.innings[0]!.runs).toBe(53);
  });
});

describe("3. batter v bowler", () => {
  const rows = [row("m1", "2026-11-01", m1)];
  it("a batter against each bowler: balls faced (a wide is not one), runs, dismissals credited to the bowler, dots", () => {
    expect(batterVsBowler(rows, "ua2")).toEqual([{ opponentUserId: "ub1", name: "Bravo1", balls: 3, runs: 6, dismissals: 1, dots: 2, strikeRate: 200 }]);
    const a1 = batterVsBowler(rows, "ua1");
    expect(a1.map((d) => [d.name, d.balls, d.runs])).toEqual([["Bravo1", 2, 5], ["Bravo2", 1, 1]]);
    expect(a1[0]!.strikeRate).toBeCloseTo(250);
    expect(batterVsBowler(rows, "nobody")).toEqual([]);
  });
  it("a run-out is not the bowler's dismissal", () => {
    const ro = state([
      start(), { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
      ball({ runs: 1, wicket: { type: "run_out", out: A(1), fielder: B(3) } }),
    ]);
    expect(batterVsBowler([row("r", "2026-11-01", ro)], "ua1")[0]!.dismissals).toBe(0);
  });
  it("the reverse: a bowler against each batter, most balls first", () => {
    const v = bowlerVsBatters(rows, "ub1");
    expect(v.map((d) => [d.name, d.balls, d.runs, d.dismissals])).toEqual([["Alpha2", 3, 6, 1], ["Alpha1", 2, 5, 0], ["Alpha3", 1, 2, 0]]);
  });
  it("adds up across matches", () => {
    const two = [row("m1", "2026-11-01", m1), row("m1b", "2026-11-02", m1)];
    expect(batterVsBowler(two, "ua2")[0]).toMatchObject({ balls: 6, runs: 12, dismissals: 2 });
  });
  it("guests are skipped", () => {
    const g = state([
      { type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs: 2, playersPerSide: 6, rules: DEFAULT_RULES, toss: null, battingFirst: 1,
        players: players().map((p) => (p.id === B(1) ? { ...p, kind: "guest" as const, userId: null } : p)) } },
      { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ball({ runs: 1 }),
    ]);
    expect(batterVsBowler([row("g", "2026-11-01", g)], "ua1")).toEqual([]);
  });
});

describe("4. where the runs come from", () => {
  it("shares of bat runs: singles, running, fours, sixes; extras while on strike kept apart", () => {
    const a1 = runSources([row("m1", "2026-11-01", m1)], "ua1");
    expect(a1).toMatchObject({ runs: 6, balls: 3, singles: 2, fours: 4, sixes: 0, running: 0 });
    expect(a1.share.fours).toBeCloseTo(66.67, 1);
    expect(a1.share.singles).toBeCloseTo(33.33, 1);
    const a2 = runSources([row("m1", "2026-11-01", m1)], "ua2");
    expect(a2).toMatchObject({ runs: 6, sixes: 6, extrasWhileOnStrike: 1 });
    expect(a2.share.sixes).toBe(100);
    expect(runSources([row("m1", "2026-11-01", m1)], "ua9")).toMatchObject({ runs: 0, share: { singles: 0, fours: 0 } });
  });
  it("2, 3 and 5 count as running", () => {
    const r = state([start(), { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ball({ runs: 2 }), ball({ runs: 3 }), ball({ runs: 5 })]);
    expect(runSources([row("x", "2026-11-01", r)], "ua1")).toMatchObject({ running: 5, runs: 5 });   // the 2 and the 3
    expect(runSources([row("x", "2026-11-01", r)], "ua2")).toMatchObject({ running: 5 });   // the 5
  });
});

describe("9. partnership pairs", () => {
  it("the pairs that score the most together, with partnerships and best", () => {
    const pairs = partnershipPairs([row("m1", "2026-11-01", m1)]);
    expect(pairs.map((p) => [p.nameA, p.nameB, p.runs, p.partnerships])).toEqual([["Bravo1", "Bravo2", 20, 1], ["Alpha1", "Alpha2", 12, 1], ["Alpha1", "Alpha3", 7, 1]]);
    const two = partnershipPairs([row("m1", "2026-11-01", m1), row("m2", "2026-11-02", m2)]);
    const bravo = two.find((p) => p.userIdA === "ub1")!;
    expect(bravo).toMatchObject({ runs: 22, partnerships: 2, best: 20, bestMatchId: "m1" });
  });
});

describe("10. community records", () => {
  const rows = [row("m1", "2026-11-01", m1), row("m2", "2026-11-02", m2), row("m2b", "2026-11-03", m2)];
  const rec = communityRecords(rows);
  const line = (t: string) => rec.lines.find((l) => l.title === t)!;
  it("highest score, best bowling, fastest fifty, most sixes in a match", () => {
    expect(line("Highest score")).toMatchObject({ holder: "Alpha1", figure: "52*", userId: "ua1" });
    expect(line("Highest score").detail).toContain("against Bravo");
    expect(line("Best bowling")).toMatchObject({ holder: "Bravo1", figure: "1/14" });
    expect(line("Fastest fifty")).toMatchObject({ holder: "Alpha1", figure: "9 balls" });
    expect(line("Most sixes in a match")).toMatchObject({ holder: "Alpha1", figure: "8" });
    expect(line("Highest score").matchId).toBe("m2");
  });
  it("longest unbeaten run per team: wins and ties in a row", () => {
    expect(rec.streaks[0]).toEqual({ team: "Alpha", length: 2 });
    expect(rec.streaks.find((s) => s.team === "Bravo")!.length).toBe(1);
    expect(line("Longest unbeaten run")).toMatchObject({ holder: "Alpha", figure: "2 matches" });
  });
  it("says so when there is nothing yet", () => {
    const none = communityRecords([]);
    expect(none.lines.every((l) => l.holder === null && l.figure === "–")).toBe(true);
    expect(none.lines.find((l) => l.title === "Fastest fifty")!.detail).toBe("No fifty yet");
    expect(communityRecords([row("m1", "2026-11-01", m1)]).lines.find((l) => l.title === "Fastest fifty")!.detail).toBe("No fifty yet");
  });
  it("balls to fifty counts balls faced, not wides", () => {
    expect(ballsToFifty(m2.innings[0]!, A(1))).toBe(9);
    expect(ballsToFifty(m2.innings[0]!, A(2))).toBeNull();
  });
  it("a permanent team is followed by its id even if it was renamed", () => {
    const r1 = { ...row("a", "2026-11-01", m1), teamIds: ["t-alpha", null] as [string | null, string | null], sides: ["Alpha", "Bravo"] as [string, string] };
    const r2 = { ...row("b", "2026-11-02", m2), teamIds: ["t-alpha", null] as [string | null, string | null], sides: ["Alpha Renamed", "Bravo"] as [string, string] };
    const x = communityRecords([r1, r2]);
    expect(x.streaks.find((s) => s.team === "Alpha Renamed")!.length).toBe(1);
  });
});

describe("11. bowling by over", () => {
  it("start is the first two overs and end is the last two, per member, ranked only from 12 balls", () => {
    const r = bowlingByOver([row("m3", "2026-11-01", m3)]);
    expect(r.start.map((x) => x.name).sort()).toEqual(["Bravo1", "Bravo2"]);
    expect(r.end.map((x) => x.name).sort()).toEqual(["Bravo3", "Bravo4"]);
    expect(r.start.every((x) => x.balls === 6 && !x.ranked)).toBe(true);
    expect(r.end.find((x) => x.name === "Bravo3")).toMatchObject({ balls: 6, runs: 6, economy: 6 });
  });
  it("ranked once a bowler has 12 balls in the window; ranked first, best economy first", () => {
    const r = bowlingByOver([row("m1", "2026-11-01", m1), row("m2", "2026-11-02", m2)]);
    const b1 = r.start.find((x) => x.name === "Bravo1")!;
    expect(b1).toMatchObject({ balls: 12, ranked: true, wickets: 1 });
    expect(b1.economy).toBeCloseTo(((14 + 6 * 6) * 6) / 12 > 0 ? (50 * 6) / 12 : 0, 5);   // 14 runs in match 1, 36 in match 2
    const ranked = r.start.filter((x) => x.ranked);
    expect(ranked.map((x) => x.economy)).toEqual([...ranked.map((x) => x.economy)].sort((a, b) => a! - b!));
    expect(r.start.findIndex((x) => !x.ranked)).toBeGreaterThanOrEqual(ranked.length);
  });
});

describe("12. match worm", () => {
  it("cumulative runs ball by ball; a wide adds runs without moving across; wickets are marked", () => {
    const w = wormSeries(m1);
    expect(w.lines).toHaveLength(2);
    const a = w.lines[0]!;
    expect(a.side).toBe("Alpha");
    expect(a.points[0]).toEqual({ x: 0, y: 0, wicket: false });
    expect(a.points.slice(1, 7).map((p) => [p.x, p.y, p.wicket])).toEqual([[1, 4, false], [2, 5, false], [3, 11, false], [3, 12, false], [4, 12, false], [5, 12, true]]);
    expect(a.points.at(-1)).toMatchObject({ y: 19 });
    expect(a.total).toBe(19);
    expect(w.lines[1]!.total).toBe(20);
    expect(w.maxRuns).toBe(20);
    expect(w.maxBalls).toBe(12);
  });
  it("super overs are left out of the worm", () => {
    const so = state([
      start(1, { superOver: "always" }), { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ...dots(5), ball({ runs: 1 }),
      { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } }, ...dots(5), ball({ runs: 1 }),
      { type: "innings_start", payload: { striker: B(3), nonStriker: B(4), bowler: A(2) } }, ...dots(6),
    ]);
    expect(wormSeries(so).lines).toHaveLength(2);
  });
});

describe("13. win likelihood", () => {
  const base = { target: 40, runs: 10, wickets: 1, ballsBowled: 12, maxBalls: 36, firstRate: 1.2 };
  it("more runs, fewer wickets and a lower target all raise the chance", () => {
    const p = chaseProbability(base);
    expect(p).toBeGreaterThan(0.01);
    expect(p).toBeLessThan(0.99);
    expect(chaseProbability({ ...base, runs: 20 })).toBeGreaterThan(p);
    expect(chaseProbability({ ...base, wickets: 0 })).toBeGreaterThan(p);
    expect(chaseProbability({ ...base, wickets: 3 })).toBeLessThan(p);
    expect(chaseProbability({ ...base, target: 30 })).toBeGreaterThan(p);
    expect(chaseProbability({ ...base, target: 60 })).toBeLessThan(p);
    for (let r = 0; r < 40; r++) expect(chaseProbability({ ...base, runs: r + 1 })).toBeGreaterThanOrEqual(chaseProbability({ ...base, runs: r }));
  });
  it("target reached is certain; no balls left and short is lost; otherwise kept away from 0 and 1", () => {
    expect(chaseProbability({ ...base, runs: 40 })).toBe(1);
    expect(chaseProbability({ ...base, runs: 55 })).toBe(1);
    expect(chaseProbability({ ...base, ballsBowled: 36, runs: 39 })).toBe(0);
    expect(chaseProbability({ ...base, runs: 39, ballsBowled: 6, wickets: 0, firstRate: 3 })).toBeLessThanOrEqual(0.99);
    expect(chaseProbability({ ...base, runs: 0, ballsBowled: 30, wickets: 5, target: 100 })).toBeGreaterThanOrEqual(0.01);
  });
  it("the normal curve behaves", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);
  });
  it("a chase that succeeds ends at 100%, and rises", () => {
    const w = winSeries(m1)!;
    expect(w.chasing).toBe("Bravo");
    expect(w.points).toHaveLength(6);
    expect(w.points[0]!.p).toBeGreaterThan(0.1);
    expect(w.points[0]!.p).toBeLessThan(0.9);
    expect(w.points.at(-1)!.p).toBe(1);
    expect(w.points.at(-1)).toMatchObject({ needed: 0 });
    expect(w.points[3]!.p).toBeGreaterThan(w.points[0]!.p);
  });
  it("a chase that falls short ends at 0%", () => {
    const w = winSeries(m2)!;
    expect(w.points.at(-1)!.p).toBe(0);
    expect(w.points[6]!.p).toBeLessThan(w.points[0]!.p);
  });
  it("a tie ends at 50%; a match with no chase has no series", () => {
    const tie = state([
      start(1, { superOver: "never" }),
      { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ...Array.from({ length: 6 }, () => ball({ runs: 1 })),
      { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } }, ...Array.from({ length: 6 }, () => ball({ runs: 1 })),
      { type: "finish", payload: {} },
    ]);
    expect(winSeries(tie)!.points.at(-1)!.p).toBe(0.5);
    const one = state([start(1, { innings: 1 }), { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ...dots(6)]);
    expect(winSeries(one)).toBeNull();
  });
});

const L = (matchId: string, when: string, runs: number, out: boolean, wkts = 0, bowled = true): MatchLine => ({
  entryId: "e", side: 1, name: "P", result: "win", points: 0, pom: false, partnerships: [], field: { catches: 0, caughtBowled: 0, stumpings: 0, runOuts: 0 },
  bat: runs >= 0 ? [{ innings: 0, runs, balls: 10, fours: 0, sixes: 0, dots: 0, singles: 0, twos: 0, threes: 0, fives: 0, freeHitRuns: 0, out: out ? "bowled" : null, golden: false }] : [],
  bowl: bowled ? [{ innings: 1, balls: 6, runs: 6, wickets: wkts, maidens: 0, dots: 0, wides: 0, noballs: 0, freeHits: 0, fours: 0, sixes: 0, byType: { bowled: 0, caught: 0, caughtBowled: 0, lbw: 0, stumped: 0, hit_wicket: 0 }, hatTrick: false }] : [],
  matchId, when, ballsPerOver: 6, teamName: "Alpha", opponent: "Bravo", resultText: "", numberUsed: 1,
});

describe("1. form over time", () => {
  const lines = Array.from({ length: 12 }, (_, i) => L(`m${i}`, `2026-11-${String(i + 1).padStart(2, "0")}`, i * 2, i % 2 === 0, i % 3, true));
  it("the last ten matches in date order; runs or wickets; not outs flagged", () => {
    const f = formSeries([...lines].reverse(), "runs");
    expect(f).toHaveLength(10);
    expect(f[0]!.matchId).toBe("m2");
    expect(f.at(-1)).toMatchObject({ matchId: "m11", value: 22, notOut: true });
    expect(f.find((p) => p.matchId === "m4")!.notOut).toBe(false);   // out
    expect(formSeries(lines, "wickets").map((p) => p.value).slice(-3)).toEqual([0, 1, 2]);
  });
  it("matches where the player did not bat (or bowl) are left out of that chart", () => {
    const mixed = [L("a", "2026-11-01", 10, true, 0, false), L("b", "2026-11-02", -1, false, 2, true)];
    expect(formSeries(mixed, "runs").map((p) => p.matchId)).toEqual(["a"]);
    expect(formSeries(mixed, "wickets").map((p) => p.matchId)).toEqual(["b"]);
    expect(formSeries([], "runs")).toEqual([]);
  });
  it("says whether the player is improving: the last three against the ones before (needs six matches)", () => {
    const up = formSeries(Array.from({ length: 8 }, (_, i) => L(`m${i}`, `2026-11-0${i + 1}`, i < 5 ? 5 : 30, true)), "runs");
    expect(formSummary(up).direction).toBe("up");
    const down = formSeries(Array.from({ length: 8 }, (_, i) => L(`m${i}`, `2026-11-0${i + 1}`, i < 5 ? 40 : 5, true)), "runs");
    expect(formSummary(down).direction).toBe("down");
    const flat = formSeries(Array.from({ length: 8 }, (_, i) => L(`m${i}`, `2026-11-0${i + 1}`, 20, true)), "runs");
    expect(formSummary(flat)).toMatchObject({ direction: "steady", average: 20, best: 20 });
    expect(formSummary(formSeries(lines.slice(0, 3), "runs")).direction).toBeNull();
    expect(formSummary([])).toMatchObject({ average: null, direction: null });
  });
});

describe("2. compare two players", () => {
  const stats = computeMatchStats(m1).players;
  const line = (id: string): MatchLine => ({ ...stats.find((x) => x.entryId === id)!, matchId: "m1", when: "2026-11-01T10:00:00Z", ballsPerOver: 6, teamName: "x", opponent: "y", resultText: "", numberUsed: 1 });
  const rows = compareCareers(careerOf([line(B(1))]), careerOf([line(A(1))]));
  const r = (k: string) => rows.find((x) => x.key === k)!;
  it("every row has both numbers in words and the better side marked", () => {
    expect(r("runs")).toMatchObject({ a: 19, b: 6, fa: "19", fb: "6", better: "a" });
    expect(r("fours")).toMatchObject({ better: "b" });             // A1 hit a four, B1 none
    expect(r("sixes")).toMatchObject({ better: "a" });
    expect(rows.map((x) => x.key)).toHaveLength(18);
  });
  it("lower is better for economy, bowling average and bowling strike rate", () => {
    expect(r("economy")).toMatchObject({ better: "a" });           // 14 an over against 24
    expect(r("economy").fa).toBe("14.00");
  });
  it("a tie, or a missing number on either side, marks neither", () => {
    expect(r("played")).toMatchObject({ a: 1, b: 1, better: null });
    const none = compareCareers(careerOf([line(B(1))]), careerOf([line(A(4))]));
    expect(none.find((x) => x.key === "economy")).toMatchObject({ b: null, fb: "–", better: null });
  });
  it("rate stats from a small sample are flagged", () => {
    expect(r("bat_avg").lowSample).toBe(true);
    expect(r("runs").lowSample).toBe(false);
  });
});

describe("7. team form", () => {
  const h = (i: number, result: HistoryItem["result"], runsFor: number | null): HistoryItem => ({ matchId: `m${i}`, when: `2026-11-0${i}`, opponent: "Bravo", result, runsFor, runsAgainst: runsFor === null ? null : 10 });
  const history = [h(1, "win", 30), h(2, "loss", 20), h(3, "tie", 25), h(4, "win", 40), h(5, "win", 35), h(6, "loss", 12), h(7, "none", null)];
  it("the last five results, oldest first, with counts", () => {
    const f = teamForm(history);
    expect(f.strip.map((x) => x.result)).toEqual(["tie", "win", "win", "loss", "none"]);
    expect(f).toMatchObject({ wins: 2, losses: 1, ties: 1 });
    expect(teamForm(history.slice(0, 2)).strip).toHaveLength(2);
    expect(teamForm([])).toMatchObject({ strip: [], wins: 0 });
  });
  it("the team's own score over time, skipping matches with no score", () => {
    expect(scoresSeries(history).map((p) => p.value)).toEqual([30, 20, 25, 40, 35, 12]);
    expect(scoresSeries(history)[0]).toMatchObject({ against: 10, result: "win", opponent: "Bravo" });
  });
});
