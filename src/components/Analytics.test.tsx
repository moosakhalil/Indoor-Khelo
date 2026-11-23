// The analytics charts and tables draw without errors, say what they show in words, and work with no community (public report).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import { BowlOverTable, CompareTable, DuelTable, FormChart, FormStrip, PairsList, RecordsList, RunSourcesCard, TeamScoresChart, WinChart, WinTab, WormChart, WormTab } from "@/components/AnalyticsParts";
import {
  batterVsBowler, bowlingByOver, communityRecords, compareCareers, formSeries, partnershipPairs, runSources, scoresSeries, teamForm, type HistoryItem, type StateRow,
} from "@/lib/analytics";
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
  { type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs: 2, playersPerSide: 6, rules: DEFAULT_RULES, players: players(), toss: null, battingFirst: 1 } },
  { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
  ball({ runs: 4 }), ball({ runs: 1 }), ball({ runs: 6 }), ball({ extra: "wide" }), ball({ runs: 0 }), ball({ wicket: { type: "caught", fielder: B(2) } }),
  { type: "batter_in", payload: { player: A(3), end: "striker" } }, ball({ runs: 2 }),
  { type: "bowler", payload: { player: B(2) } }, ball({ runs: 1 }), ball({ runs: 4 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
  { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } },
  ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 1 }), ball({ runs: 1 }), { type: "finish", payload: {} },
];
const built = buildState(bodies.map((b, i) => ({ ...b, id: `e${i + 1}`, seq: i + 1 }) as ScoreEvent));
if (!built.ok) throw new Error(built.error);
const m = built.state;
const rows: StateRow[] = [{ matchId: "m1", when: "2026-11-01T10:00:00Z", sides: ["Alpha", "Bravo"], teamIds: [null, null], state: m }];
const stats = computeMatchStats(m).players;
const line = (id: string): MatchLine => ({ ...stats.find((x) => x.entryId === id)!, matchId: "m1", when: "2026-11-01T10:00:00Z", ballsPerOver: 6, teamName: "Bravo", opponent: "Alpha", resultText: "", numberUsed: 11 });

describe("charts say what they show", () => {
  it("form chart: bars with values, an average line, and a plain-words label; the empty case explains itself", () => {
    const pts = formSeries([line(B(1)), { ...line(B(1)), matchId: "m2", when: "2026-11-02T10:00:00Z" }], "runs");
    const html = renderToStaticMarkup(<FormChart points={pts} metric="runs" />);
    expect(html).toContain('role="img"');
    expect(html).toContain("Runs in the last 2 matches, oldest first: 19 not out, 19 not out");
    expect(html).toContain("average 19.0");
    expect(html).toContain("Play six matches to see whether the trend");
    expect(renderToStaticMarkup(<FormChart points={[]} metric="wickets" />)).toContain("No bowling yet");
    expect(renderToStaticMarkup(<FormChart points={formSeries([line(B(1))], "wickets")} metric="wickets" />)).toContain("Wickets in the last 1 matches");
  });
  it("team form strip: a letter and a word for every result; scores chart needs two matches", () => {
    const h = (i: number, r: HistoryItem["result"], f: number | null): HistoryItem => ({ matchId: `m${i}`, when: null, opponent: "Bravo", result: r, runsFor: f, runsAgainst: f === null ? null : 9 });
    const hist = [h(1, "win", 30), h(2, "loss", 20), h(3, "tie", 25)];
    const strip = renderToStaticMarkup(<FormStrip strip={teamForm(hist).strip} />);
    expect(strip).toContain("Last 3 results, oldest first: Won, Lost, Tied");
    expect(strip).toContain(">W<");
    expect(renderToStaticMarkup(<FormStrip strip={[]} />)).toContain("No finished matches yet");
    const chart = renderToStaticMarkup(<TeamScoresChart series={scoresSeries(hist)} />);
    expect(chart).toContain("30 (Won v Bravo)");
    expect(renderToStaticMarkup(<TeamScoresChart series={scoresSeries(hist.slice(0, 1))} />)).toContain("at least two finished matches");
  });
  it("match worm: both innings, wickets marked, a legend that does not rely on colour", () => {
    const html = renderToStaticMarkup(<WormChart m={m} />);
    expect(html).toContain("Match worm: runs ball by ball. Alpha 19, Bravo 20. Red dots mark wickets.");
    expect(html).toContain("(solid line)");
    expect(html).toContain("(dashed line)");
    expect(html).toContain("<circle");           // the wicket
    expect(html).toContain("<polyline");
    expect(renderToStaticMarkup(<WormTab m={m} />)).toContain("Where the lines cross");
  });
  it("win chance: the chasing side, start and end, and the plain note that it is only an estimate", () => {
    const html = renderToStaticMarkup(<WinChart m={m} />);
    expect(html).toContain("Bravo&#x27;s chance of winning the chase");
    expect(html).toContain("and ends at 100%");
    expect(html).toContain("rough estimate, not a prediction");
    expect(renderToStaticMarkup(<WinTab m={m} />)).toContain("Bravo");
    const none = buildState([{ ...bodies[0]!, id: "x1", seq: 1 } as ScoreEvent]);
    if (none.ok) expect(renderToStaticMarkup(<WinChart m={none.state} />)).toContain("no chase");
  });
});

describe("tables", () => {
  it("compare: the better number carries the word 'better'; ties and small samples are said", () => {
    const html = renderToStaticMarkup(<CompareTable rows={compareCareers(careerOf([line(B(1))]), careerOf([line(A(1))]))} aName="Bravo1" bName="Alpha1" />);
    expect(html).toContain("Bravo1 is ahead in");
    expect(html).toContain("better");
    expect(html).toContain("small sample");
    expect(html).toContain("Batting comparison");
    expect(html).toContain("Bowling comparison");
  });
  it("batter v bowler and bowler v batters", () => {
    const bat = renderToStaticMarkup(<DuelTable rows={batterVsBowler(rows, "ua2")} kind="bat" communityId="c1" />);
    expect(bat).toContain("Batter against each bowler");
    expect(bat).toContain("/c/c1/players/ub1");
    expect(bat).toContain("200.0");
    expect(renderToStaticMarkup(<DuelTable rows={[]} kind="bowl" communityId="c1" />)).toContain("No balls bowled to members yet");
  });
  it("where the runs come from: shares in words and numbers, extras kept apart", () => {
    const html = renderToStaticMarkup(<RunSourcesCard s={runSources(rows, "ua1")} />);
    expect(html).toContain("6 runs off 3 balls");
    expect(html).toContain("Fours 67 percent");
    expect(html).toContain("kept apart");
    expect(renderToStaticMarkup(<RunSourcesCard s={runSources(rows, "nobody")} />)).toContain("No runs off the bat yet");
  });
  it("partnership pairs, community records, bowling by over", () => {
    expect(renderToStaticMarkup(<PairsList rows={partnershipPairs(rows)} communityId="c1" />)).toContain("Bravo1");
    expect(renderToStaticMarkup(<PairsList rows={[]} communityId="c1" />)).toContain("No partnerships between members yet");
    const rec = renderToStaticMarkup(<RecordsList lines={communityRecords(rows).lines} communityId="c1" />);
    expect(rec).toContain("Highest score");
    expect(rec).toContain("19*");
    expect(rec).toContain("No fifty yet");
    expect(rec).toContain("/c/c1/matches/m1/report");
    const bo = renderToStaticMarkup(<BowlOverTable rows={bowlingByOver(rows).start} title="At the start" communityId="c1" />);
    expect(bo).toContain("needs 12 balls to be ranked");
    expect(renderToStaticMarkup(<BowlOverTable rows={[]} title="At the end" communityId="c1" />)).toContain("No bowling by members yet");
  });
});
