// Player of the Series: pure rules (src/lib/seriesAward.ts). The database part is checked in seriesDb.test.ts.
import { describe, expect, it } from "vitest";
import { playerOfSeries, type AwardLine } from "@/lib/seriesAward";

const line = (o: Partial<AwardLine> & { userId: string; matchId: string; points: number }): AwardLine => ({
  name: o.userId.toUpperCase(), number: 7, opponent: "Bravo", runs: 0, wickets: 0, catches: 0, ...o,
});

describe("Player of the Series", () => {
  it("is null when there are no lines, or nobody earned a point", () => {
    expect(playerOfSeries([])).toBeNull();
    expect(playerOfSeries([line({ userId: "a", matchId: "m1", points: 0 }), line({ userId: "b", matchId: "m1", points: 0 })])).toBeNull();
  });

  it("adds each member's points over the matches and the highest total wins", () => {
    const r = playerOfSeries([
      line({ userId: "a", matchId: "m1", points: 40, runs: 30, wickets: 1 }),
      line({ userId: "b", matchId: "m1", points: 55, runs: 12, wickets: 3, catches: 1 }),
      line({ userId: "a", matchId: "m2", points: 38, runs: 25 }),
      line({ userId: "b", matchId: "m2", points: 10 }),
    ])!;
    expect(r.winners.map((w) => [w.userId, w.points, w.matches])).toEqual([["a", 78, 2]]);   // a: 40 + 38 beats b: 55 + 10
    expect(r.winners[0]!.runs).toBe(55);
    expect(r.winners[0]!.perMatch.map((m) => m.points)).toEqual([40, 38]);
    expect(r.others.map((o) => [o.userId, o.points])).toEqual([["b", 65]]);
    expect(r.matchesCounted).toBe(2);
  });

  it("equal totals share the award, and the winners never appear again in 'others'", () => {
    const r = playerOfSeries([
      line({ userId: "a", matchId: "m1", points: 30 }), line({ userId: "b", matchId: "m1", points: 30 }), line({ userId: "c", matchId: "m1", points: 12 }),
    ])!;
    expect(r.winners.map((w) => w.userId).sort()).toEqual(["a", "b"]);
    expect(r.others.map((o) => o.userId)).toEqual(["c"]);
  });

  it("shows at most three others, best first, ties by name", () => {
    const lines = ["a", "b", "c", "d", "e", "f"].map((u, i) => line({ userId: u, matchId: "m1", points: 60 - i * 5 }));
    const r = playerOfSeries(lines)!;
    expect(r.winners.map((w) => w.userId)).toEqual(["a"]);
    expect(r.others.map((o) => o.userId)).toEqual(["b", "c", "d"]);
    const tie = playerOfSeries([line({ userId: "z", matchId: "m1", points: 20, name: "Zed" }), line({ userId: "y", matchId: "m1", points: 20, name: "Amir" }), line({ userId: "x", matchId: "m1", points: 50 })])!;
    expect(tie.others.map((o) => o.name)).toEqual(["Amir", "Zed"]);
  });

  it("ignores a line with no member behind it, and takes the latest name and number", () => {
    const r = playerOfSeries([
      line({ userId: "", matchId: "m1", points: 999 }),
      line({ userId: "a", matchId: "m1", points: 20, name: "Ali R", number: 7 }),
      line({ userId: "a", matchId: "m2", points: 20, name: "Ali Raza", number: 9 }),
    ])!;
    expect(r.winners).toHaveLength(1);
    expect(r.winners[0]).toMatchObject({ userId: "a", points: 40, name: "Ali Raza", number: 9 });
  });

  it("counts a match once however many members played in it", () => {
    const r = playerOfSeries([line({ userId: "a", matchId: "m1", points: 5 }), line({ userId: "b", matchId: "m1", points: 4 }), line({ userId: "a", matchId: "m2", points: 5 })])!;
    expect(r.matchesCounted).toBe(2);
  });
});
