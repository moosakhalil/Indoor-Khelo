// Phase F5 test and screenshot fixtures: hand-made match lines for a player with 14 matches (no database needed).
import { careerOf, type MatchLine } from "@/lib/career";
import type { BatLine, BowlLine } from "@/lib/stats";

const bat = (runs: number, balls: number, out: BatLine["out"], extra: Partial<BatLine> = {}): BatLine => ({
  innings: 1, runs, balls, fours: Math.floor(runs / 12), sixes: Math.floor(runs / 30), dots: Math.max(0, balls - runs), singles: Math.floor(runs / 2), twos: Math.floor(runs / 6), threes: 0, fives: 0, freeHitRuns: 0, out, golden: false, ...extra,
});
const bowl = (wickets: number, runs: number, balls: number, extra: Partial<BowlLine> = {}): BowlLine => ({
  innings: 1, balls, runs, wickets, maidens: 0, dots: Math.floor(balls / 3), wides: 1, noballs: 0, freeHits: 0, fours: 1, sixes: 0,
  byType: { bowled: Math.min(wickets, 1), caught: Math.max(0, wickets - 1), caughtBowled: 0, lbw: 0, stumped: 0, hit_wicket: 0 }, hatTrick: false, ...extra,
});

const OPP = ["Desert Falcons", "Blue Hawks", "Royal Panthers"];
export function fixtureLines(n = 14): MatchLine[] {
  return Array.from({ length: n }, (_, i): MatchLine => {
    const k = i + 1;
    const result = k % 5 === 0 ? "loss" : k % 7 === 0 ? "tie" : "win";
    const batted = k !== 3;
    return {
      entryId: `e${k}`, side: 1, name: "Ali Raza", result, pom: k % 5 === 1,
      bat: batted ? [bat(10 + ((k * 7) % 52), 8 + ((k * 3) % 24), k % 4 === 0 ? null : k % 3 === 0 ? "bowled" : "caught", k === 2 ? { runs: 0, balls: 1, out: "bowled", golden: true } : {})] : [],
      bowl: k % 2 === 0 ? [bowl(k % 4, 12 + k, 12)] : [],
      field: { catches: k % 3 === 0 ? 2 : 0, caughtBowled: k % 6 === 0 ? 1 : 0, stumpings: 0, runOuts: k % 4 === 0 ? 1 : 0 },
      partnerships: k === 4 ? [{ innings: 1, runs: 54, balls: 31, withId: "p2", withName: "Zain Malik" }] : [],
      points: 10 + k * 3,
      matchId: `m${k}`, when: new Date(Date.UTC(2026, 9, 1 + k * 3, 10)).toISOString(), ballsPerOver: 6, teamName: "Thunder Strikers",
      opponent: OPP[k % 3]!, resultText: "", numberUsed: k > 9 ? 12 : 7,
    };
  });
}

export const fixtureCareer = () => careerOf(fixtureLines());
