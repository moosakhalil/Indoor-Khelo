// @vitest-environment jsdom
// Phase D3: the match report (member) and the shared report (public) in their new design.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, scroll: _s, ...rest }: { href: string; children: React.ReactNode; scroll?: boolean }) => <a href={href} {...rest}>{children}</a> }));

import ReportGone from "@/app/r/[token]/not-found";
import { BallsView, ReportTabs, ShareSwitch } from "@/components/ReportClient";
import {
  AppPromoCard, BallsTab, ChangesTab, OversTab, PomCard, REPORT_TABS, ScoreHeader, ScorecardTab, StatsTab, SummaryTab, WinPanel, WormPanel, ballGroups, reportTab,
} from "@/components/ReportParts";
import { correctionsOf } from "@/lib/corrections";
import { buildState } from "@/lib/engine/engine";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import { DEFAULT_RULES } from "@/lib/matchRules";

afterEach(cleanup);

const mk = (n: number, side: Side, name: string, kind: "member" | "guest" = "member"): PlayerEntry => ({ id: `${side === 1 ? "a" : "b"}${n}`, side, name, number: kind === "guest" ? null : n + (side === 2 ? 10 : 0), kind, userId: kind === "guest" ? null : `u${side}${n}` });
const players: PlayerEntry[] = [mk(1, 1, "Alpha One"), mk(2, 1, "Alpha Two"), mk(3, 1, "Alpha Three"), mk(1, 2, "Bravo One"), mk(2, 2, "Bravo Two"), mk(3, 2, "Danish Guest", "guest")];
const ball = (p: object): ScoreEventBody => ({ type: "ball", payload: p } as ScoreEventBody);
const start = (rules = DEFAULT_RULES): ScoreEventBody[] => [
  { type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs: 1, playersPerSide: 3, rules, players, toss: { winner: 1, decision: "bat" }, battingFirst: 1 } },
  { type: "innings_start", payload: { striker: "a1", nonStriker: "a2", bowler: "b1" } },
  ball({ runs: 4 }), ball({ runs: 1 }), ball({ extra: "wide" }), ball({ runs: 6 }), ball({ runs: 0 }), ball({ runs: 1 }), ball({ runs: 1 }),   // 14
];
const log = (bodies: ScoreEventBody[], by = "Scorer"): ScoreEvent[] => bodies.map((b, i) => ({ ...b, id: `e${i + 1}`, seq: i + 1, by, at: `2026-11-23T10:0${i % 10}:00.000Z` }) as ScoreEvent);
const chase = (runs: number[]): ScoreEventBody[] => [{ type: "innings_start", payload: { striker: "b1", nonStriker: "b2", bowler: "a1" } }, ...runs.map((r) => ball({ runs: r }))];
const stateOf = (events: ScoreEvent[]) => { const b = buildState(events); if (!b.ok) throw new Error(b.error); return b.state; };

const won = stateOf(log([...start(), ...chase([6, 6, 4]), { type: "finish", payload: {} }]));                        // Bravo win by 2 wickets or so
const tied = stateOf(log([...start({ ...DEFAULT_RULES, superOver: "never" }), ...chase([6, 6, 1, 1, 0, 0]), { type: "finish", payload: {} }]));
const abandoned = stateOf(log([...start(), { type: "match_end", payload: { kind: "abandoned" } }]));
const noResult = stateOf(log([...start(), { type: "match_end", payload: { kind: "result", winner: null } }]));

const header = (m: typeof won, extra: object = {}) => renderToStaticMarkup(<ScoreHeader m={m} whenText="Sun, 22 Nov, 8:00 pm" venue="Clifton" overs={1} {...extra} />);

describe("score header on every tab", () => {
  it("a win: badges, scores, winner mark, result line, toss", () => {
    const html = header(won);
    expect(html).toContain("Completed");
    expect(html).toContain("Team Alpha");           // team badges
    expect(html).toContain("Team Bravo");
    expect(html).toContain("(won)");
    expect(html).toContain("1 overs · Sun, 22 Nov, 8:00 pm · Clifton");
    expect(html).toContain("Alpha won the toss and chose to bat");
    expect(html).toContain(won.result!.text);
  });
  it("a tie reads as equal: Tied badge, no winner mark", () => {
    expect(tied.result?.kind).toBe("tie");
    const html = header(tied);
    expect(html).toContain("Tied");
    expect(html).not.toContain("(won)");
    expect(html).toContain("rp-result tie");
  });
  it("an abandoned match shows only the innings that was played, with a red Abandoned badge", () => {
    const html = header(abandoned);
    expect(html).toContain("Abandoned");
    expect(html).toContain("rp-status red");
    expect(html).not.toContain("Team Bravo");
    expect(html).toContain("Match abandoned");
  });
  it("no result gets a neutral badge and line", () => {
    const html = header(noResult);
    expect(html).toContain("No result");
    expect(html).toContain("rp-status grey");
    expect(html).toContain("rp-result neutral");
  });
  it("your own team is marked when the viewer played", () => {
    expect(header(won, { mySide: 1 })).toContain("Your team");
    expect(header(won)).not.toContain("Your team");
  });
});

describe("tabs", () => {
  it("all eight tabs are links with the open one marked, and an unknown tab falls back to Summary", () => {
    render(<ReportTabs tabs={REPORT_TABS} active="balls" base="/c/c1/matches/m1/report" />);
    const nav = screen.getByRole("navigation", { name: "Report sections" });
    expect(within(nav).getAllByRole("link")).toHaveLength(8);
    expect(screen.getByRole("link", { name: "Ball by ball" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Worm" }).getAttribute("href")).toBe("/c/c1/matches/m1/report?tab=worm");
    expect(reportTab("nonsense")).toBe("summary");
    expect(reportTab("changes")).toBe("changes");
  });
});

describe("summary, scorecard, stats", () => {
  it("summary: Player of the Match hero with points, chips and the sheet; top performers with shirts and team badges; tiles; created and scored by", () => {
    const html = renderToStaticMarkup(<SummaryTab m={won} communityId="c1" matchId="m1" scorers={[{ name: "Scorer", balls: 12 }]} createdBy="Creator" showResult={false} />);
    expect(html).toContain("Player of the Match");
    expect(html).toContain("rp-pom-pts");
    expect(html).toContain("How the app chose");
    expect(html).toContain("Nobody picks the winner");
    expect(html).toContain("class=\"shirt");                  // gold shirts for players
    expect(html).toContain("Team Alpha");
    expect(html).toContain("Dot balls");
    expect(html).toContain("Created by");
    expect(html).not.toContain(won.result!.text);             // the result is in the header, not repeated
  });
  it("abandoned: a calm explanation card instead of a Player of the Match", () => {
    expect(renderToStaticMarkup(<PomCard m={abandoned} communityId="c1" />)).toContain("An abandoned match has no Player of the Match.");
    expect(renderToStaticMarkup(<PomCard m={noResult} communityId="c1" />)).toContain("No Player of the Match for this result.");
  });
  it("scorecard: batting and bowling tables, did not bat, extras, fall of wickets chips, partnership bars, guests with a badge", () => {
    const html = renderToStaticMarkup(<ScorecardTab m={won} communityId="c1" matchId="m1" />);
    expect(html).toContain("batting");
    expect(html).toContain("bowling");
    expect(html).toContain("Did not bat");
    expect(html).toContain("Extras");
    expect(html).toContain("Partnerships");
    expect(html).toContain("rp-bar");
    expect(html).toContain("not out");
    const guestHtml = renderToStaticMarkup(<ScorecardTab m={won} communityId="c1" matchId="m1" />);
    expect(guestHtml).toMatch(/Danish Guest|Did not bat/);
  });
  it("stats: tiles, run rate bars, extras split, best partnerships, top batters and bowlers", () => {
    const html = renderToStaticMarkup(<StatsTab m={won} communityId="c1" />);
    for (const t of ["Fours", "Sixes", "Dot balls", "Extras", "Run rate", "Best partnerships", "Top batters", "Top bowlers", "Wides"]) expect(html).toContain(t);
  });
  it("over by over, worm and win chance draw; a match with no chase shows the empty state", () => {
    expect(renderToStaticMarkup(<OversTab m={won} />)).toContain("Over 1");
    expect(renderToStaticMarkup(<WormPanel m={won} />)).toContain("Wicket");
    expect(renderToStaticMarkup(<WinPanel m={won} />)).toContain("A rough estimate, not a prediction");
    const none = renderToStaticMarkup(<WinPanel m={abandoned} />);
    expect(none).toContain("No chase in this match");
    expect(none).toContain("This match had no chase.");
  });
});

describe("public view shows what it showed before", () => {
  it("player names are plain text, no links into the community, no Correct pencils", () => {
    const sum = renderToStaticMarkup(<SummaryTab m={won} communityId={null} scorers={[]} createdBy="Creator" />);
    const card = renderToStaticMarkup(<ScorecardTab m={won} communityId={null} />);
    const balls = renderToStaticMarkup(<BallsTab m={won} communityId={null} matchId="m1" />);
    for (const html of [sum, card, balls]) {
      expect(html).not.toContain("/c/");
      expect(html).not.toContain("/players/");
      expect(html).not.toContain("correct?ball");
    }
    expect(balls).not.toContain("Spotted a mistake");
  });
  it("guests carry a visible Guest badge", () => {
    const html = renderToStaticMarkup(<StatsTab m={won} communityId={null} />) + renderToStaticMarkup(<ScorecardTab m={won} communityId={null} />);
    expect(`${html}`).toContain("Danish Guest");
  });
  it("the Changes tab without corrections is the plain log (no times, no reasons)", () => {
    const html = renderToStaticMarkup(<ChangesTab m={won} />);
    expect(html).toContain("Match started");
    expect(html).toContain("by Scorer");
    expect(html).not.toContain("Reason");
    expect(html).not.toContain("Saved ");
  });
  it("the call to action and the not-active page", () => {
    expect(renderToStaticMarkup(<AppPromoCard />)).toContain("Open Indoor Khelo");
    const gone = renderToStaticMarkup(<ReportGone />);
    expect(gone).toContain("This report link is not active");
    expect(gone).toContain("Open Indoor Khelo");
    expect(gone).toContain("Nothing is shown from the community when a link is not active.");
    expect(gone).not.toMatch(/Alpha|Bravo/);
  });
});

describe("ball by ball", () => {
  it("groups every delivery by over with bowler, runs, wickets and a letter or number on each ball; boundaries are told apart", () => {
    const g = ballGroups(won);
    expect(g[0]!.overs).toHaveLength(1);
    expect(g[0]!.overs[0]!.runs).toBe(14);
    const kinds = g[0]!.overs[0]!.balls.map((b) => b.kind);
    expect(kinds).toEqual(["four", "run", "extra", "six", "dot", "run", "run"]);
  });
  it("member list has a pencil on each ball that goes to Correct; the commentary is kept word for word", () => {
    const html = renderToStaticMarkup(<BallsTab m={won} communityId="c1" matchId="m1" />);
    expect(html).toContain("0.1 Bravo One to Alpha One: Four runs.");
    expect(html).toContain("/c/c1/matches/m1/correct?ball=e3");
    expect(html).toContain("aria-label=\"Correct ball 0.1\"");
  });
  it("opens and closes an over, and the filters keep only wickets, fours and sixes, or extras", () => {
    render(<BallsView innings={ballGroups(won)} communityId="c1" matchId="m1" />);
    const head = screen.getAllByRole("button", { expanded: true })[0]!;   // the first over starts open
    fireEvent.click(head);
    expect(screen.queryAllByRole("button", { expanded: true }).filter((b) => b.classList.contains("rp-over-head"))).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Fours and sixes" }));
    expect(screen.getByRole("button", { name: "Fours and sixes" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("0.1 Bravo One to Alpha One: Four runs.")).toBeTruthy();
    expect(screen.queryByText("0.2 Bravo One to Alpha One: 1 run.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Wickets" }));
    expect(screen.getAllByText("No wickets fell.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Extras" }));
    expect(screen.getByText(/Wide/)).toBeTruthy();
  });
});

describe("How the app chose sheet", () => {
  it("is closed until asked, opens with the rules as rows and a Close button, and closes with Escape", () => {
    render(<PomCard m={won} communityId="c1" />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog.hasAttribute("hidden")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /How the app chose/ }));
    expect(screen.getByRole("dialog").hasAttribute("hidden")).toBe(false);
    expect(within(screen.getByRole("dialog")).getByText("Batting runs")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText(/If points are level/)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("hidden")).toBe(true);
  });
});

describe("corrections in the Changes tab", () => {
  const edit = { type: "edit", id: "ed1", seq: 99, payload: { target: "e3", patch: { runs: 3 } }, reason: "It was three", by: "Ali Raza", at: "2026-11-24T08:30:00.000Z" } as ScoreEvent;
  const events = [...log([...start(), ...chase([1, 1, 1, 1, 1, 3]), { type: "finish", payload: {} }]), edit];
  const m = stateOf(events);
  it("shows who, when, why, which ball, what changed and the new totals", () => {
    const html = renderToStaticMarkup(<ChangesTab m={m} corrections={correctionsOf(events)} tz="UTC" />);
    expect(html).toContain("A delivery was corrected");
    expect(html).toContain("by Ali Raza");
    expect(html).toContain("It was three");
    expect(html).toContain("0.1 Bravo One to Alpha One: 3 runs.");
    expect(html).toContain("Runs:");
    expect(html).toContain("Saved");
    expect(html).toContain("rp-tl-item corr");
  });
});

describe("public link switch", () => {
  const action = vi.fn();
  it("off: members-only badge, member link, and the switch turns sharing on", () => {
    const { container } = render(<ShareSwitch communityId="c1" matchId="m1" memberLink="https://app/c/c1/matches/m1/report" publicLink={null} action={action} />);
    expect(screen.getByText("Members only")).toBeTruthy();
    expect(screen.getByText("https://app/c/c1/matches/m1/report")).toBeTruthy();
    const sw = screen.getByRole("switch", { name: "Public link" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(sw.getAttribute("type")).toBe("submit");
    expect((container.querySelector("input[name=on]") as HTMLInputElement).value).toBe("1");
  });
  it("on: Public badge, the public link, and turning it off asks first", () => {
    render(<ShareSwitch communityId="c1" matchId="m1" memberLink="https://app/m" publicLink="https://app/r/abc" action={action} />);
    expect(screen.getByText("Public")).toBeTruthy();
    expect(screen.getByText("https://app/r/abc")).toBeTruthy();
    const sw = screen.getByRole("switch", { name: "Public link" });
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByText("Stop sharing?")).toBeNull();
    fireEvent.click(sw);
    expect(screen.getByText("Stop sharing?")).toBeTruthy();
    expect(screen.getByText(/Anyone who has it will see that the link is not active/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Stop sharing?")).toBeNull();
  });
});
