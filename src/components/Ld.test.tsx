// @vitest-environment jsdom
// Phase F2: leaderboard, compare players, insights and player analytics (the new parts, drawn with dummy data).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import AnalyticsTabs from "@/components/AnalyticsTabs";
import ComparePicker from "@/components/ComparePicker";
import { CompareBoard, QuickPicks } from "@/components/CompareParts";
import { BowlCard, CompareButton, InsightsTabs, PairRows, RecordTiles, StreakBars } from "@/components/InsightsParts";
import { BoardList, FilterSheet, type BoardItem } from "@/components/LeaderboardClient";
import { ActiveFilters, GroupTabs, OrderChip, Podium, RankCardView, RuleNote, StatChips, lbHref } from "@/components/LeaderboardParts";
import { BoundariesCard, DuelCard, HowOutCard, PartnershipCard, RunSourcesPanel, formViews } from "@/components/PlayerAnalyticsParts";
import { compareCareers, formSeries, type DuelRow, type FormPoint, type RecordLine, type RunSources } from "@/lib/analytics";
import { STATS, buildBoard, careerOf } from "@/lib/career";
import { rankCard } from "@/lib/ldView";

afterEach(() => cleanup());
const stat = (k: string) => STATS.find((s) => s.key === k)!;
const empty = careerOf([]);

/* ---------------- leaderboard ---------------- */
const items = (n: number, meIndex = 2): BoardItem[] => Array.from({ length: n }, (_, i) => ({
  userId: `u${i + 1}`, name: `Player ${i + 1}`, number: i + 1, line: `#${i + 1} · Batter`, rank: i < 4 ? i + 1 : 5, tied: i >= 4, ranked: true, note: null, valueText: String(500 - i * 10),
}));
const FILTERS = { team: null, series: null, from: null, to: null };

describe("leaderboard links", () => {
  it("group tabs, stat chips and the order chip keep the filters", () => {
    const f = { team: "t1", series: "s1", from: "2026-11-01", to: null };
    const g = renderToStaticMarkup(<GroupTabs communityId="c1" group="batting" filters={f} />);
    expect(g).toContain('href="/c/c1/leaderboard?group=bowling&amp;team=t1&amp;series=s1&amp;from=2026-11-01"');
    expect(g).toContain('aria-current="page"');
    const s = renderToStaticMarkup(<StatChips communityId="c1" group="bowling" def={stat("economy")} filters={f} />);
    expect(s).toContain('href="/c/c1/leaderboard?stat=wickets&amp;team=t1&amp;series=s1&amp;from=2026-11-01"');
    expect(s).toContain("ld-chip on");
    expect(s).not.toContain("Runs");
    const o = renderToStaticMarkup(<OrderChip communityId="c1" def={stat("economy")} flip={false} filters={f} />);
    expect(o).toContain("Lowest first");
    expect(o).toContain("flip=1");
    const r = renderToStaticMarkup(<OrderChip communityId="c1" def={stat("economy")} flip filters={f} />);
    expect(r).toContain("Highest first");
    expect(r).toContain("Reversed order");
    expect(lbHref("c1", { stat: "runs" })).toBe("/c/c1/leaderboard?stat=runs");
  });
  it("each active filter is a chip that removes only itself", () => {
    const f = { team: "t1", series: "s1", from: "2026-11-01", to: "2026-11-23" };
    const html = renderToStaticMarkup(<ActiveFilters communityId="c1" def={stat("runs")} flip={false} filters={f} seriesName="Winter Cup 2026" teamName="Thunder" rangeText="1 Nov 2026 to 23 Nov 2026" />);
    expect(html).toContain("Series: Winter Cup 2026");
    expect(html).toContain("Remove filter Series: Winter Cup 2026");
    expect(html).toContain('href="/c/c1/leaderboard?stat=runs&amp;team=t1&amp;from=2026-11-01&amp;to=2026-11-23"');
    expect(html).toContain('href="/c/c1/leaderboard?stat=runs&amp;series=s1&amp;from=2026-11-01&amp;to=2026-11-23"');
    expect(html).toContain('href="/c/c1/leaderboard?stat=runs&amp;team=t1&amp;series=s1"');
    expect(renderToStaticMarkup(<ActiveFilters communityId="c1" def={stat("runs")} flip={false} filters={FILTERS} seriesName={null} teamName={null} rangeText={null} />)).toBe("");
  });
  it("the minimum rule is stated once, in a note", () => {
    expect(renderToStaticMarkup(<RuleNote def={stat("bat_avg")} />)).toContain("Needs at least 3 innings and 20 balls faced.");
    expect(renderToStaticMarkup(<RuleNote def={stat("runs")} />)).toBe("");
  });
});

describe("rank card and podium", () => {
  it("your rank first, in words, with your figure; tied is said", () => {
    const rows = buildBoard([{ userId: "a", name: "Ana", number: 7, career: { ...empty, batting: { ...empty.batting, runs: 50 } } }, { userId: "b", name: "Bo", number: 8, career: { ...empty, batting: { ...empty.batting, runs: 50 } } }], stat("runs"));
    const card = rankCard(rows[0], 2, stat("runs"), "50", empty, true);
    const html = renderToStaticMarkup(<RankCardView card={card} def={stat("runs")} number={7} name="Ana" />);
    expect(html).toContain("YOUR RANK · RUNS");
    expect(html).toContain("1st");
    expect(html).toContain("of 2, tied");
    expect(html).toContain("You are 1st of 2 (tied).");
  });
  it("not ranked yet: the reason and progress, no gold", () => {
    const html = renderToStaticMarkup(<RankCardView card={{ kind: "unranked", reason: "Needs at least 3 innings and 20 balls faced.", progress: "You have 2 innings and 14 balls so far." }} def={stat("bat_avg")} number={7} name="Ana" />);
    expect(html).toContain("Not ranked yet");
    expect(html).toContain("You have 2 innings and 14 balls so far.");
    expect(html).not.toContain("gold");
    expect(renderToStaticMarkup(<RankCardView card={null} def={stat("runs")} number={null} name="" />)).toBe("");
  });
  it("podium puts 1st in the middle and says 1st, 2nd, 3rd in words", () => {
    const rows = buildBoard([1, 2, 3].map((i) => ({ userId: `u${i}`, name: `P${i}`, number: i, career: { ...empty, batting: { ...empty.batting, runs: 100 - i } } })), stat("runs"));
    const html = renderToStaticMarkup(<Podium rows={rows} def={stat("runs")} valueOf={(r) => String(r.value)} communityId="c1" />);
    expect(html.indexOf("2ND")).toBeLessThan(html.indexOf("1ST"));
    expect(html.indexOf("1ST")).toBeLessThan(html.indexOf("3RD"));
    expect(html).toContain("/c/c1/players/u1");
    expect(renderToStaticMarkup(<Podium rows={[]} def={stat("runs")} valueOf={() => ""} communityId="c1" />)).toBe("");
  });
});

describe("board list", () => {
  it("shows the first ten and your own row, then every member on request", () => {
    render(<BoardList communityId="c1" rows={items(24)} meId="u15" hasData label="Runs leaderboard" />);
    expect(screen.getAllByRole("listitem").filter((li) => li.className.includes("ld-row")).length).toBe(11);   // ten and you
    expect(screen.getByText("YOU")).toBeTruthy();
    const more = screen.getByRole("button", { name: "Show the other 14 members" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(screen.getAllByRole("listitem").filter((li) => li.className.includes("ld-row")).length).toBe(24);
    expect(screen.getByRole("button", { name: "Show only the top 10" }).getAttribute("aria-expanded")).toBe("true");
  });
  it("a short list has no button; ties carry the word TIED and the equals sign", () => {
    render(<BoardList communityId="c1" rows={items(6)} meId="u1" hasData label="x" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByText("TIED").length).toBe(2);
    expect(screen.getAllByText("5=").length).toBe(2);
    expect(screen.getAllByLabelText("Rank 5, tied").length).toBe(2);
  });
  it("greyed members show a dash and the reason; no data shows dashes instead of everyone tied first", () => {
    const rows: BoardItem[] = [
      { userId: "a", name: "Ana", number: 1, line: "#1", rank: 1, tied: false, ranked: true, note: null, valueText: "47.36" },
      { userId: "b", name: "Bo", number: 2, line: "#2", rank: null, tied: false, ranked: false, note: "Needs at least 3 innings and 20 balls faced", valueText: "–" },
    ];
    const { container } = render(<BoardList communityId="c1" rows={rows} meId="a" hasData label="x" />);
    expect(container.querySelector(".ld-row.dim")?.textContent).toContain("Needs at least 3 innings and 20 balls faced");
    expect(screen.getByLabelText("Not ranked").textContent).toBe("–");
    cleanup();
    const none: BoardItem[] = items(3).map((r) => ({ ...r, rank: 1, tied: true, valueText: "0" }));
    render(<BoardList communityId="c1" rows={none} meId="u1" hasData={false} label="x" />);
    expect(screen.queryByText("TIED")).toBeNull();
    expect(screen.getAllByLabelText("Not ranked").length).toBe(3);
  });
});

describe("filters sheet", () => {
  const props = { communityId: "c1", stat: "runs", flip: false, teams: [{ id: "t1", name: "Thunder" }], series: [{ id: "s1", name: "Winter Cup 2026" }], current: FILTERS };
  it("opens as a dialog with series, team, from, to, Apply and Clear; closes on Escape", () => {
    render(<FilterSheet {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    const dlg = screen.getByRole("dialog");
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    const form = within(dlg).getByRole("form", { name: "Filter the leaderboard" }) as HTMLFormElement;
    expect(form.method).toBe("get");
    expect((form.querySelector('input[name="stat"]') as HTMLInputElement).value).toBe("runs");
    for (const n of ["series", "team", "from", "to"]) expect(form.querySelector(`[name="${n}"]`)).toBeTruthy();
    expect(within(dlg).getByRole("button", { name: "Apply" })).toBeTruthy();
    expect(within(dlg).getByRole("link", { name: "Clear filters" }).getAttribute("href")).toBe("/c/c1/leaderboard?stat=runs");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("the series filter only appears when series exist; the count badge says how many filters are on", () => {
    render(<FilterSheet {...props} series={[]} current={{ ...FILTERS, team: "t1", from: "2026-11-01" }} />);
    expect(screen.getByLabelText("2 filters on")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect(document.querySelector('[name="series"]')).toBeNull();
    expect((document.querySelector('[name="team"]') as HTMLSelectElement).value).toBe("t1");
  });
  it("keeps the reversed order when applying", () => {
    render(<FilterSheet {...props} flip />);
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect((document.querySelector('input[name="flip"]') as HTMLInputElement).value).toBe("1");
  });
});

/* ---------------- compare ---------------- */
const members = [
  { user_id: "u1", name: "Ali Raza", player_number: 7, playing_role: "batter" },
  { user_id: "u2", name: "Hamza Khan", player_number: 10, playing_role: "all_rounder" },
  { user_id: "u3", name: "Zain Malik", player_number: 3, playing_role: null },
];

describe("compare picker", () => {
  it("two empty cards and a disabled swap when nobody is chosen", () => {
    render(<ComparePicker communityId="c1" members={members} a={null} b={null} />);
    expect(screen.getAllByRole("button", { name: /Choose/ }).length).toBe(2);
    expect(screen.queryByRole("link", { name: "Swap the two players" })).toBeNull();
  });
  it("chosen cards show name and role, Change opens a searchable list of links, swap flips the sides", () => {
    render(<ComparePicker communityId="c1" members={members} a="u1" b="u2" />);
    expect(screen.getByText("#7 · Batter")).toBeTruthy();
    expect(screen.getByText("#10 · All-rounder")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Swap the two players" }).getAttribute("href")).toBe("/c/c1/compare?a=u2&b=u1");
    fireEvent.click(screen.getByRole("button", { name: /Change second player/ }));
    const dlg = screen.getByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Search members"), { target: { value: "zain" } });
    const link = within(dlg).getByRole("link", { name: /Zain Malik/ });
    expect(link.getAttribute("href")).toBe("/c/c1/compare?a=u1&b=u3");
    expect(within(dlg).queryByRole("link", { name: /Ali Raza/ })).toBeNull();
    fireEvent.change(within(dlg).getByLabelText("Search members"), { target: { value: "nobody" } });
    expect(within(dlg).getByText("No member has that name.")).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Close", hidden: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("the same player can be chosen twice (the page then says so) and a side can be cleared", () => {
    render(<ComparePicker communityId="c1" members={members} a="u1" b="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /Change second player/ }));
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByRole("link", { name: "Not chosen" }).getAttribute("href")).toBe("/c/c1/compare?a=u1");
  });
});

describe("compare result", () => {
  const rowsOf = (a: object, b: object) => compareCareers({ ...empty, ...a } as typeof empty, { ...empty, ...b } as typeof empty);
  const ca = { ...empty, matches: 5, batting: { ...empty.batting, runs: 412, innings: 5, balls: 200, average: 34.3, strikeRate: 138.2, dotPercent: 24.9 }, bowling: { ...empty.bowling, economy: 8.6, balls: 60, bpo: 6 } };
  const cb = { ...empty, matches: 6, batting: { ...empty.batting, runs: 521, innings: 6, balls: 300, average: 47.4, strikeRate: 131.8, dotPercent: 28.4 }, bowling: { ...empty.bowling, economy: 7.05, balls: 60, bpo: 6 } };
  it("the score up front, the better number gold with the word Better, lower-is-better said under the label", () => {
    const html = renderToStaticMarkup(<CompareBoard rows={compareCareers(ca, cb)} aName="Ali Raza" bName="Hamza Khan" aMatches={5} bMatches={6} />);
    expect(html).toContain("ROWS WON");
    expect(html).toContain("level");
    expect(html).toContain("Better");
    expect(html).toContain("ld-cv best");
    expect(html).toContain("lower is better");
    expect(html).toContain("Batting comparison");
    expect(html).toContain("Awards comparison");
    expect(html).toContain("is ahead in");
    expect(html).not.toContain("no finished matches yet");
  });
  it("a player with no matches: the note names them, small samples are tagged", () => {
    const html = renderToStaticMarkup(<CompareBoard rows={compareCareers(ca, empty)} aName="Ali Raza" bName="Moiz Abbasi" aMatches={5} bMatches={0} />);
    expect(html).toContain("Moiz Abbasi has no finished matches yet");
    expect(html).toContain("Small sample");
    expect(renderToStaticMarkup(<CompareBoard rows={rowsOf({}, {})} aName="A" bName="B" aMatches={0} bMatches={0} />)).toContain("A and B have no finished matches yet");
  });
  it("quick picks are links to a ready comparison", () => {
    const html = renderToStaticMarkup(<QuickPicks communityId="c1" picks={[{ a: "u1", b: "u2", aName: "Ali Raza", bName: "Hamza Khan", label: "Ali v Hamza" }]} />);
    expect(html).toContain('href="/c/c1/compare?a=u1&amp;b=u2"');
    expect(html).toContain("QUICK PICKS");
    expect(renderToStaticMarkup(<QuickPicks communityId="c1" picks={[]} />)).toBe("");
  });
});

/* ---------------- insights ---------------- */
const line = (title: string, o: Partial<RecordLine> = {}): RecordLine => ({ title, holder: "Hamza Khan", userId: "u2", figure: "96", detail: "off 48 balls against Desert Falcons", matchId: "m1", ...o });
describe("insights", () => {
  it("record tiles: the figure, the holder with a shirt, 'See the match'; a team record uses a team badge", () => {
    const html = renderToStaticMarkup(<RecordTiles communityId="c1" numberOf={(u) => (u === "u2" ? 10 : null)} lines={[line("Highest score"), line("Longest unbeaten run", { holder: "Thunder Strikers", userId: null, figure: "6 matches", detail: "wins and ties in a row", matchId: null })]} />);
    expect(html).toContain("HIGHEST SCORE");
    expect(html).toContain("Player number 10");
    expect(html).toContain("/c/c1/players/u2");
    expect(html).toContain("See the match");
    expect(html).toContain("/c/c1/matches/m1/report");
    expect(html).toContain("Team Thunder Strikers");
    expect(html.match(/See the match/g)!.length).toBe(1);
  });
  it("calm placeholders when there is nothing yet: dash, question mark, the reason, no link", () => {
    const html = renderToStaticMarkup(<RecordTiles communityId="c1" numberOf={() => null} lines={[line("Fastest fifty", { holder: null, userId: null, figure: "–", detail: "No fifty yet", matchId: null })]} />);
    expect(html).toContain("ld-tile calm");
    expect(html).toContain("Nobody yet");
    expect(html).toContain("No fifty yet");
    expect(html).toContain(">?<");
    expect(html).not.toContain("See the match");
  });
  it("unbeaten runs as ranked team badges with bars; fewer than two teams shows nothing", () => {
    const html = renderToStaticMarkup(<StreakBars streaks={[{ team: "Thunder Strikers", length: 6 }, { team: "Royal Panthers", length: 3 }]} />);
    expect(html).toContain("Unbeaten runs by team");
    expect(html).toContain('style="width:100%"');
    expect(html).toContain('style="width:50%"');
    expect(html).toContain("Guests are not in records.");
    expect(renderToStaticMarkup(<StreakBars streaks={[{ team: "A", length: 1 }]} />)).toBe("");
  });
  it("partnerships: two shirts, both names as links, big run total, balls and best, a Best match link; empty state says why", () => {
    const html = renderToStaticMarkup(<PairRows communityId="c1" numberOf={(u) => (u === "a" ? 7 : 3)} rows={[{ userIdA: "a", nameA: "Ali Raza", userIdB: "b", nameB: "Zain Malik", runs: 214, balls: 160, partnerships: 9, best: 58, bestMatchId: "m9" }]} />);
    expect(html).toContain("Ali Raza");
    expect(html).toContain("9 partnerships · 160 balls · best 58");
    expect(html).toContain(">214<");
    expect(html).toContain("/c/c1/matches/m9/report");
    expect(html).toContain("Best match");
    expect(renderToStaticMarkup(<PairRows communityId="c1" numberOf={() => null} rows={[]} />)).toContain("No partnerships between members yet.");
  });
  it("bowling by over: best economy in gold, unranked rows dimmed with the reason, empty line kept", () => {
    const rows = [
      { userId: "a", name: "Bilal", balls: 48, runs: 41, wickets: 9, economy: 5.13, ranked: true },
      { userId: "b", name: "Kamran", balls: 6, runs: 5, wickets: 1, economy: 5, ranked: false },
    ];
    const html = renderToStaticMarkup(<BowlCard rows={rows} title="At the start (overs 1 and 2)" communityId="c1" numberOf={() => 5} />);
    expect(html).toContain('class="best">5.13');
    expect(html).toContain("needs 12 balls to be ranked");
    expect(html).toContain('class="dim"');
    expect(renderToStaticMarkup(<BowlCard rows={[]} title="At the end" communityId="c1" numberOf={() => null} />)).toContain("No bowling by members yet.");
  });
  it("Compare players is its own button and the tabs have no fourth chip", () => {
    expect(renderToStaticMarkup(<CompareButton communityId="c1" />)).toContain('href="/c/c1/compare"');
    const html = renderToStaticMarkup(<InsightsTabs communityId="c1" tab="partnerships" tabs={[["records", "Records"], ["partnerships", "Partnerships"], ["bowling", "Bowling by over"]]} />);
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain("Compare");
  });
});

/* ---------------- player analytics ---------------- */
const pts = (...v: number[]): FormPoint[] => v.map((value, i) => ({ matchId: `m${i}`, when: `2026-11-${10 + i}`, value, notOut: false, opponent: "X" }));
const tabsFor = (runs: FormPoint[], wickets: FormPoint[], initialTab: "form" | "runs" | "duels" = "form", initialMetric: "runs" | "wickets" = "runs") => (
  <AnalyticsTabs initialTab={initialTab} initialMetric={initialMetric} form={formViews(runs, wickets)} runs={<p>RUNS PANEL</p>} duels={<p>DUELS PANEL</p>} />
);

describe("player analytics form card", () => {
  it("improving: badge, four number tiles, legend in words and the sentence the page always had", () => {
    const p = pts(10, 12, 9, 11, 40, 38, 33, 45, 30, 36);
    p[7]!.notOut = true;
    const { container } = render(tabsFor(p, []));
    expect(screen.getByText("Form, last 10 matches")).toBeTruthy();
    expect(container.querySelector(".ld-trend.up")?.textContent).toContain("Improving");
    const tiles = within(container.querySelector(".ld-tiles2") as HTMLElement);
    for (const t of ["Average", "Best", "Last 3 matches", "Before that"]) expect(tiles.getByText(t)).toBeTruthy();
    expect(tiles.getByText("45*")).toBeTruthy();
    expect(screen.getByLabelText("What the colours mean").textContent).toContain("Out for a duck (dashed)");
    expect(container.textContent).toContain("Improving: the last three matches average 37.0 against 21.9 before.");
    expect(container.querySelector("svg[role=img]")?.getAttribute("aria-label")).toContain("Runs in the last 10 matches, oldest first");
  });
  it("down lately with ducks named in the legend; the dashed duck bar is drawn", () => {
    const { container } = render(tabsFor(pts(30, 25, 28, 20, 21, 25, 0, 0, 9), []));
    expect(container.querySelector(".ld-trend.down")?.textContent).toContain("Down lately");
    expect(container.innerHTML).toContain('stroke-dasharray="3 2"');
    expect(container.textContent).toContain("Down lately: the last three matches average 3.0 against 24.8 before.");
  });
  it("fewer than six matches: an orange 'Needs 6 matches' badge, dashes in the two trend tiles, the old sentence", () => {
    const { container } = render(tabsFor(pts(12, 27, 5), []));
    expect(container.querySelector(".ld-trend.need")?.textContent).toContain("Needs 6 matches");
    expect(screen.getByText("Last 3 matches").previousSibling?.textContent).toBe("–");
    expect(screen.getByText("Before that").previousSibling?.textContent).toBe("–");
    expect(container.textContent).toContain("Play six matches to see whether the trend is up or down.");
  });
  it("the Runs / Wickets switch is a two-state control (no reload); wickets draw green bars and their own title", () => {
    const { container } = render(tabsFor(pts(10, 20), pts(1, 2, 0)));
    const runs = screen.getByRole("button", { name: "Runs" }), wk = screen.getByRole("button", { name: "Wickets" });
    expect(runs.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(wk);
    expect(wk.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Form, last 3 matches")).toBeTruthy();
    expect(container.innerHTML).toContain("Wickets in the last 3 matches");
    expect(container.innerHTML).toContain("var(--green)");
    expect(screen.getByLabelText("What the colours mean").textContent).toContain("Wickets taken");
  });
  it("no innings yet / no bowling yet: a dashed empty card with the reason", () => {
    const { container } = render(tabsFor([], []));
    expect(screen.getByText("No innings yet")).toBeTruthy();
    expect(container.textContent).toContain("The chart fills in after finished matches.");
    fireEvent.click(screen.getByRole("button", { name: "Wickets" }));
    expect(screen.getByText("No bowling yet")).toBeTruthy();
  });
  it("formSeries feeds the cards unchanged: only matches where the player batted are in the runs chart", () => {
    expect(formViews(formSeries([], "runs"), formSeries([], "wickets")).runs.title).toBe("Form");
  });
});

describe("player analytics tabs", () => {
  it("three tabs without a reload: only the chosen panel is visible; arrow keys move between tabs", () => {
    const { container } = render(tabsFor(pts(5), [], "form"));
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Form", "Run sources", "Duels"]);
    expect(container.querySelector(".ld-p-runs")?.hasAttribute("hidden")).toBe(true);
    fireEvent.click(tabs[1]!);
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector(".ld-p-runs")?.hasAttribute("hidden")).toBe(false);
    expect(container.querySelector(".ld-p-form")?.hasAttribute("hidden")).toBe(true);
    fireEvent.keyDown(tabs[1]!, { key: "ArrowRight" });
    expect(tabs[2]!.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector(".ld-p-duels")?.hasAttribute("hidden")).toBe(false);
  });
  it("opens on the tab from the address (?tab=duels&metric=wickets)", () => {
    render(tabsFor(pts(5), pts(2), "duels", "wickets"));
    expect(screen.getAllByRole("tab")[2]!.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "Wickets", hidden: true }).getAttribute("aria-pressed")).toBe("true");
  });
});

const sources = (o: Partial<RunSources> = {}): RunSources => ({ runs: 412, balls: 298, singles: 113, running: 91, fours: 124, sixes: 84, other: 0, share: { singles: 27.4, running: 22.1, fours: 30.1, sixes: 20.4, other: 0 }, extrasWhileOnStrike: 17, ...o });
describe("player analytics: where the runs come from and the three new cards", () => {
  it("big number, stacked bar, four-column legend, extras kept apart", () => {
    const html = renderToStaticMarkup(<RunSourcesPanel s={sources()} />);
    expect(html).toContain(">412<");
    expect(html).toContain("runs off");
    expect(html).toContain("Fours 30 percent");
    for (const h of ["Source", "Runs", "Share"]) expect(html).toContain(`>${h}<`);
    expect(html).toContain("Running (2, 3, 5)");
    expect(html).toContain("kept apart: <b>17</b>");
    expect(html).not.toContain("Other</th>");
  });
  it("no runs yet: an empty card that says when it fills in", () => {
    const html = renderToStaticMarkup(<RunSourcesPanel s={sources({ runs: 0, balls: 0 })} />);
    expect(html).toContain("No runs off the bat yet");
    expect(html).toContain("after the first innings");
  });
  it("boundaries and dots, how out and best partnership come from the career numbers", () => {
    const c = { ...empty, batting: { ...empty.batting, innings: 10, balls: 298, runs: 412, fours: 31, sixes: 14, dots: 98, boundaryPercent: 50.5, ballsPerBoundary: 6.6, dotPercent: 32.9, strikeRate: 138.3, howOut: { not_out: 3, caught: 5, bowled: 2 }, bestPartnership: { innings: 1, runs: 54, balls: 31, withId: "x", withName: "Zain Malik" } } };
    const b = renderToStaticMarkup(<BoundariesCard c={c} />);
    for (const t of ["50.5%", "6.6", "32.9%", "138.3", "31 fours, 14 sixes", "98 dot balls in 298 balls"]) expect(b).toContain(t);
    expect(b).toContain("New");
    const h = renderToStaticMarkup(<HowOutCard c={c} />);
    expect(h).toContain("Run out");
    expect(h).toContain("Retired out");
    expect(h).toContain('style="width:100%"');
    const p = renderToStaticMarkup(<PartnershipCard c={c} name="Ali Raza" number={7} />);
    expect(p).toContain(">54<");
    expect(p).toContain("runs in 31 balls");
    expect(p).toContain("Zain Malik");
    expect(renderToStaticMarkup(<BoundariesCard c={empty} />)).toContain("–");
    expect(renderToStaticMarkup(<HowOutCard c={empty} />)).toContain("No innings yet");
    expect(renderToStaticMarkup(<PartnershipCard c={empty} name="A" number={1} />)).toContain("No partnership yet");
  });
});

const duel = (o: Partial<DuelRow> = {}): DuelRow => ({ opponentUserId: "u2", name: "Hamza Khan", balls: 38, runs: 49, dismissals: 2, dots: 10, strikeRate: 128.9, ...o });
describe("player analytics: batter v bowler", () => {
  it("opponent with a shirt and a link; strike rate over 140 is gold and named in the header", () => {
    const html = renderToStaticMarkup(<DuelCard kind="bat" communityId="c1" title="Ali Raza batting against…" numberOf={() => 10} rows={[duel(), duel({ opponentUserId: "u3", name: "Hassan Raza", strikeRate: 151.9 })]} />);
    expect(html).toContain("Ali Raza batting against…");
    expect(html).toContain("/c/c1/players/u2");
    expect(html).toContain("Player number 10");
    expect(html).toContain("over 140 is gold");
    expect(html).toContain('class="best">151.9');
    expect(html).toContain(">128.9<");
    expect(html).toContain("Members only.");
  });
  it("bowling to: Wkts and Dots columns, no gold", () => {
    const html = renderToStaticMarkup(<DuelCard kind="bowl" communityId="c1" title="x" numberOf={() => null} rows={[duel()]} />);
    expect(html).toContain(">Wkts<");
    expect(html).toContain(">Dots<");
    expect(html).not.toContain('class="best"');
  });
  it("each table has its own empty state with the real sentence", () => {
    expect(renderToStaticMarkup(<DuelCard kind="bat" communityId="c1" title="x" numberOf={() => null} rows={[]} />)).toContain("No balls faced against members yet.");
    expect(renderToStaticMarkup(<DuelCard kind="bowl" communityId="c1" title="x" numberOf={() => null} rows={[]} />)).toContain("No balls bowled to members yet.");
  });
});
