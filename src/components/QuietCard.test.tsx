import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/app/actions4", () => ({ setAvailabilityAction: vi.fn() }));

import { MatchCard } from "@/components/MatchBits";
import { SummaryTab } from "@/components/ReportParts";
import { buildState } from "@/lib/engine/engine";
import type { MatchRow } from "@/lib/matches";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import { DEFAULT_RULES } from "@/lib/matchRules";

const row = (over: Partial<MatchRow> = {}): MatchRow => ({
  id: "m1", community_id: "c1", status: "scheduled", scheduled_at: new Date("2026-11-28T14:00:00Z"), venue: "Hall", overs: 6, players_per_side: 6, rules: DEFAULT_RULES, umpire: "", notes: "",
  toss_winner_side: null, toss_decision: null, batting_first_side: null, rematch_of: null, last_reminder_at: null, created_by_name: "A", changed_by_name: "A", created_at: new Date(), updated_at: new Date(),
  side1_id: "s1", side1_name: "Alpha", side1_team: null, side2_id: "s2", side2_name: "Bravo", side2_team: null, in_count: 8, out_count: 2, member_count: 14, my_answer: null, ...over,
}) as MatchRow;

describe("the quieter reply line in the match list", () => {
  it("shows only your own reply, never the counts", () => {
    const none = renderToStaticMarkup(<MatchCard communityId="c1" m={row()} tz="UTC" />);
    expect(none).toContain("You have not replied");
    expect(none).not.toContain("8 in");
    expect(none).not.toContain("no reply");
    expect(renderToStaticMarkup(<MatchCard communityId="c1" m={row({ my_answer: "in" })} tz="UTC" />)).toContain("You: I’m in");
    expect(renderToStaticMarkup(<MatchCard communityId="c1" m={row({ my_answer: "out" })} tz="UTC" />)).toContain("You: Can’t make it");
  });
  it("a match that has started shows no reply line at all", () => {
    expect(renderToStaticMarkup(<MatchCard communityId="c1" m={row({ status: "completed" })} tz="UTC" />)).not.toContain("replied");
  });
});

describe("a player opened from a scorecard", () => {
  const A = (i: number) => `a${i}`;
  const B = (i: number) => `b${i}`;
  const players: PlayerEntry[] = [
    ...[1, 2].map((i) => ({ id: A(i), side: 1 as Side, name: `Alpha${i}`, number: i, kind: "member" as const, userId: `ua${i}` })),
    ...[1, 2].map((i) => ({ id: B(i), side: 2 as Side, name: `Bravo${i}`, number: i + 10, kind: "member" as const, userId: `ub${i}` })),
  ];
  const bodies: ScoreEventBody[] = [
    { type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs: 1, playersPerSide: 2, rules: { ...DEFAULT_RULES, lastBatterAlone: false }, players, toss: null, battingFirst: 1 } },
    { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
    ...[1, 1, 1, 1, 1, 1].map((r) => ({ type: "ball", payload: { runs: r } }) as ScoreEventBody),
  ];
  const built = buildState(bodies.map((b, i) => ({ ...b, id: `e${i}`, seq: i + 1 }) as ScoreEvent));
  if (!built.ok) throw new Error(built.error);
  it("player links carry the match, so the player page can show that match first", () => {
    const html = renderToStaticMarkup(<SummaryTab m={built.state} communityId="c1" matchId="m-123" scorers={[]} createdBy="X" />);
    expect(html).toContain("/c/c1/players/ua1?match=m-123");
  });
  it("without a match id the link is the plain player page", () => {
    const html = renderToStaticMarkup(<SummaryTab m={built.state} communityId="c1" scorers={[]} createdBy="X" />);
    expect(html).toContain("/c/c1/players/ua1\"");
    expect(html).not.toContain("?match=");
  });
});
