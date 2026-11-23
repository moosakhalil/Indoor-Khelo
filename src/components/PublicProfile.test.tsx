import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PublicProfileView from "@/components/PublicProfileView";
import { careerOf, type MatchLine } from "@/lib/career";

const base = { name: "Ali Raza", playing_role: "batter", batting_hand: "right", batting_position: "opener", bowling_style: "none" };
const line = (runs: number, out: boolean): MatchLine => ({
  entryId: "e1", side: 1, name: "Ali", result: "win", points: 20, pom: true, matchId: `m${runs}`, when: "2026-11-23T10:00:00Z", ballsPerOver: 6, teamName: "Secret Team", opponent: "Secret Opponents", resultText: "Secret Team won", numberUsed: 7,
  bat: [{ innings: 0, runs, balls: 10, fours: 1, sixes: 1, dots: 2, singles: 3, twos: 1, threes: 0, fives: 0, freeHitRuns: 0, out: out ? "bowled" : null, golden: false }],
  bowl: [], field: { catches: 1, caughtBowled: 0, stumpings: 0, runOuts: 0 }, partnerships: [],
});

describe("the public profile page", () => {
  it("shows the profile and career totals, and nothing about communities, teams, opponents, numbers or payments", () => {
    const html = renderToStaticMarkup(<PublicProfileView p={{ ...base, career: careerOf([line(34, true), line(12, false)]) }} />);
    expect(html).toContain("Ali Raza");
    expect(html).toContain("Opener");
    expect(html).toContain("Right");
    expect(html).toContain("Matches");
    expect(html).toContain("46");                       // 34 + 12 runs
    expect(html).toContain("Last 2 innings");
    expect(html).not.toContain("Secret");
    expect(html).not.toContain("#7");
    expect(html).not.toContain("href=");                // no links into the community from the shared profile itself
    expect(html.toLowerCase()).not.toContain("payment");
  });
  it("a player with no finished matches shows an honest empty state, not zeros", () => {
    const html = renderToStaticMarkup(<PublicProfileView p={{ ...base, career: careerOf([]) }} />);
    expect(html).toContain("No finished matches yet");
    expect(html).not.toContain("Strike rate");
  });
});
