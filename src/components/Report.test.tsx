// The report and statistics screens draw without errors and show the right things, using a real played match.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import PlayerStats from "@/components/PlayerStats";
import { BallsTab, ChangesTab, OversTab, PomCard, ScorecardTab, StatsTab, SummaryTab } from "@/components/ReportParts";
import { careerOf, type MatchLine } from "@/lib/career";
import { buildState } from "@/lib/engine/engine";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { computeMatchStats } from "@/lib/stats";

const A = (i: number) => `a${i}`;
const B = (i: number) => `b${i}`;
const players = (): PlayerEntry[] => [
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: A(i), side: 1 as Side, name: `Alpha${i}`, number: i, kind: "member" as const, userId: `ua${i}` })),
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: B(i), side: 2 as Side, name: `Bravo${i}`, number: i + 10, kind: "member" as const, userId: `ub${i}` })),
];
const ball = (p: object): ScoreEventBody => ({ type: "ball", payload: p } as ScoreEventBody);
const bodies: ScoreEventBody[] = [
  { type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs: 2, playersPerSide: 6, rules: DEFAULT_RULES, players: players(), toss: { winner: 1, decision: "bat" }, battingFirst: 1 } },
  { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
  ball({ runs: 4 }), ball({ runs: 1 }), ball({ runs: 6 }), ball({ extra: "wide" }), ball({ runs: 0 }), ball({ wicket: { type: "caught", fielder: B(2) } }),
  { type: "batter_in", payload: { player: A(3), end: "striker" } }, ball({ runs: 2 }),
  { type: "bowler", payload: { player: B(2) } }, ball({ runs: 1 }), ball({ runs: 4 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
  { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } },
  ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 1 }), ball({ runs: 1 }), { type: "finish", payload: {} },
];
const built = buildState(bodies.map((b, i) => ({ ...b, id: `e${i + 1}`, seq: i + 1, by: "Tester" }) as ScoreEvent));
if (!built.ok) throw new Error(built.error);
const m = built.state;

describe("match report screens", () => {
  it("summary shows the result, the scores, who scored, and the Player of the Match with its explanation", () => {
    const html = renderToStaticMarkup(<SummaryTab m={m} communityId="c1" scorers={[{ name: "Tester", balls: 24 }]} createdBy="Creator" />);
    expect(html).toContain("Bravo won by 6 wickets");
    expect(html).toContain("Created by");
    expect(html).toContain("Scored by");
    expect(html).toContain("Tester (24 balls)");
    expect(html).toContain("Player of the Match");
    expect(html).toContain("57 points");
    expect(html).toContain("Nobody picks the winner");
    expect(html).toContain("/c/c1/players/ub1");           // tap a player to open their stats
  });
  it("scorecard, ball by ball, over by over, match stats and changes all draw", () => {
    expect(renderToStaticMarkup(<ScorecardTab m={m} communityId="c1" />)).toContain("Partnerships");
    const balls = renderToStaticMarkup(<BallsTab m={m} communityId="c1" matchId="m1" />);
    expect(balls).toContain("0.1 Bravo1 to Alpha1: Four runs.");
    expect(balls).toContain("/c/c1/matches/m1/correct?ball=");
    expect(renderToStaticMarkup(<OversTab m={m} />)).toContain("Over 1");
    const stats = renderToStaticMarkup(<StatsTab m={m} communityId="c1" />);
    expect(stats).toContain("Best partnerships");
    expect(stats).toContain("Dot balls");
    expect(renderToStaticMarkup(<ChangesTab m={m} />)).toContain("Changes during the match");
  });
  it("an abandoned match says it has no Player of the Match", () => {
    const ab = buildState([...bodies.slice(0, 4), { type: "match_end", payload: { kind: "abandoned" } } as ScoreEventBody].map((b, i) => ({ ...b, id: `x${i}`, seq: i + 1 }) as ScoreEvent));
    if (!ab.ok) throw new Error(ab.error);
    expect(renderToStaticMarkup(<PomCard m={ab.state} communityId="c1" />)).toContain("no Player of the Match");
  });
});

describe("player statistics screens", () => {
  const stats = computeMatchStats(m).players;
  const line = (id: string): MatchLine => ({ ...stats.find((x) => x.entryId === id)!, matchId: "m1", when: "2026-11-23T10:00:00Z", ballsPerOver: 6, teamName: "Bravo", opponent: "Alpha", resultText: "", numberUsed: 11 });
  const c = careerOf([line(B(1)), line(B(1))]);
  const lines = [line(B(1)), line(B(1))];
  const draw = (tab: "overview" | "batting" | "bowling" | "fielding" | "matches", filter: "all" | "bat" | "bowl" = "all") =>
    renderToStaticMarkup(<PlayerStats c={c} lines={lines} tab={tab} base="/c/c1/players/u" linesFilter={filter} communityId="c1" />);
  it("overview: headline numbers, last innings bars, awards, recent matches", () => {
    const html = draw("overview");
    expect(html).toContain("Matches");
    expect(html).toContain("38");                        // 19 + 19 runs
    expect(html).toContain("Last 2 innings");
    expect(html).toContain("Player of the Match");
    expect(html).toContain("/c/c1/matches/m1/report");
  });
  it("every tab draws, with the definitions panel", () => {
    expect(draw("batting")).toContain("How the runs were scored");
    expect(draw("batting")).toContain("Golden ducks");
    expect(draw("bowling")).toContain("Wickets by type");
    expect(draw("bowling")).toContain("Hat-tricks");
    expect(draw("fielding")).toContain("only where the scorer named the fielder");
    const matches = draw("matches", "bat");
    expect(matches).toContain("Team record while this player played");
    expect(matches).toContain("wore #11");
    expect(matches).not.toContain("Bowl: ");
    expect(draw("overview")).toContain("What the numbers mean");
  });
});
