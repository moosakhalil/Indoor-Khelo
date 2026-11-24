// @vitest-environment jsdom
// Phase B (UI redesign), Builder 4: the Matches list and the five Teams screens.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/matches", useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/actions4", () => ({ setAvailabilityAction: vi.fn(), deleteMatchAction: vi.fn(async () => undefined), postponeAction: vi.fn(async () => undefined), cancelAction: vi.fn(async () => undefined) }));
vi.mock("@/app/actions3", () => ({
  deleteTeamAction: vi.fn(async () => undefined),
  setSquadAction: vi.fn(),
  createTeamAction: vi.fn(async () => ({ fieldErrors: { name: "A team with this name already exists in this community." }, error: "Please fix the highlighted fields." })),
  updateTeamAction: vi.fn(async () => ({ message: "Saved." })),
}));
vi.mock("@/app/actionsB4", () => ({ removeFromSquadAction: vi.fn(async () => ({ ok: true })), setTeamRoleAction: vi.fn(async () => ({ ok: true })) }));

import { cancelAction, deleteMatchAction, postponeAction } from "@/app/actions4";
import { createTeamAction, deleteTeamAction } from "@/app/actions3";
import { removeFromSquadAction, setTeamRoleAction } from "@/app/actionsB4";
import MatchItemCard from "@/components/MatchItemCard";
import MatchList, { MatchesEmpty } from "@/components/MatchList";
import MatchRowMenu from "@/components/MatchRowMenu";
import MemberPicker from "@/components/MemberPicker";
import SquadEditor from "@/components/SquadEditor";
import { SnackbarProvider } from "@/components/Snackbar";
import TeamDangerZone from "@/components/TeamDangerZone";
import TeamEditor from "@/components/TeamEditor";
import { SquadCard, TeamTopActions } from "@/components/TeamPageBits";
import TeamsList from "@/components/TeamsList";
import { buildState } from "@/lib/engine/engine";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import {
  PLANNED_EXPLAIN, chipCounts, counts, filterMatches, groupMatches, menuFor, needsReply, plannedHeadline, toMatchItem, type MatchItem,
} from "@/lib/matchList";
import { DEFAULT_RULES, type MatchStatus } from "@/lib/matchRules";
import { liveSummary, pastSummary } from "@/lib/matchSummary";
import { deleteBlockedText, filterTeams, formKey, needsPlayersText, sortTeams, squadChanges, type TableRow, type TeamItem } from "@/lib/teamList";

const item = (over: Partial<MatchItem> = {}): MatchItem => ({
  id: "m1", status: "scheduled", side1: "Thunder Strikers", side2: "Royal Panthers", mine1: false, mine2: false, when: "Fri, 28 Nov, 8:00 pm", venue: "Clifton Arena", overs: 6,
  myAnswer: null, score: null, scoreSub: null, chase: null, result: null, thisWeek: false, isNew: false, at: 1000, ...over,
});
const wrap = (ui: React.ReactNode) => <SnackbarProvider>{ui}</SnackbarProvider>;

beforeEach(() => { push.mockClear(); refresh.mockClear(); vi.mocked(deleteMatchAction).mockClear(); vi.mocked(deleteTeamAction).mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ------------------------------------------------------------------ pure rules ------------------------------------------------------------------ */
describe("matches list rules", () => {
  const all: MatchItem[] = [
    item({ id: "a", status: "live", at: 5 }),
    item({ id: "b", status: "paused", at: 6 }),
    item({ id: "c", status: "scheduled", at: 30, myAnswer: null, thisWeek: true }),
    item({ id: "d", status: "scheduled", at: 20, myAnswer: "in", side1: "Desert Falcons", venue: "Hall 2" }),
    item({ id: "e", status: "draft", at: null }),
    item({ id: "f", status: "postponed", at: 10, mine1: true }),
    item({ id: "g", status: "completed", at: 100 }),
    item({ id: "h", status: "abandoned", at: 200 }),
    item({ id: "i", status: "cancelled", at: 150 }),
  ];
  it("puts Live and Paused in Live, Draft/Scheduled/Postponed in Upcoming, Completed/Abandoned/Cancelled in Past", () => {
    expect(counts(all)).toEqual({ all: 9, live: 2, upcoming: 4, past: 3 });
    const g = groupMatches(all);
    expect(g.map((x) => x.key)).toEqual(["live", "upcoming", "past"]);
    expect(g[1]!.items.map((m) => m.id)).toEqual(["f", "d", "c", "e"]);   // soonest first, no date last
    expect(g[2]!.items.map((m) => m.id)).toEqual(["h", "i", "g"]);       // newest first
  });
  it("new matches from Plan several come first under Upcoming", () => {
    const g = groupMatches([...all, item({ id: "n", status: "scheduled", at: 999999, isNew: true })]);
    expect(g[1]!.items[0]!.id).toBe("n");
  });
  it("Needs my reply means no reply yet on a draft, scheduled or postponed match", () => {
    expect(all.filter(needsReply).map((m) => m.id)).toEqual(["c", "e", "f"]);
    expect(filterMatches(all, { segment: "all", query: "", chips: ["reply"] })).toHaveLength(3);
    expect(chipCounts(all)).toEqual({ reply: 3, mine: 1, drafts: 1, week: 1 });
  });
  it("search looks at team names and the venue, and the filters combine", () => {
    expect(filterMatches(all, { segment: "all", query: "falcons", chips: [] }).map((m) => m.id)).toEqual(["d"]);
    expect(filterMatches(all, { segment: "all", query: "hall", chips: [] }).map((m) => m.id)).toEqual(["d"]);
    expect(filterMatches(all, { segment: "upcoming", query: "", chips: ["mine"] }).map((m) => m.id)).toEqual(["f"]);
    expect(filterMatches(all, { segment: "all", query: "zzz", chips: [] })).toEqual([]);
  });
  it("keeps the singular and plural wording of the planned banner", () => {
    expect(plannedHeadline(1)).toBe("1 match planned");
    expect(plannedHeadline(3)).toBe("3 matches planned");
    expect(PLANNED_EXPLAIN).toBe("Each one is separate, with its own replies and lineup.");
  });
  it("the menu offers only what the match page can do, in the same states", () => {
    const keys = (s: MatchStatus) => menuFor(s).map((a) => a.key);
    expect(keys("scheduled")).toEqual(["open", "lineup", "edit", "rematch", "postpone", "cancel", "delete"]);
    expect(keys("draft")).toEqual(["open", "lineup", "edit", "rematch", "postpone", "cancel", "delete"]);
    expect(keys("postponed")).toEqual(["open", "lineup", "edit", "rematch", "cancel", "delete"]);
    expect(keys("cancelled")).toEqual(["open", "rematch", "delete"]);
    expect(keys("live")).toEqual(["open", "rematch"]);
    expect(keys("completed")).toEqual(["open", "rematch"]);
    expect(keys("abandoned")).toEqual(["open", "rematch"]);
  });
  it("turns a database row into plain data and marks my teams", () => {
    const row = { id: "x", status: "scheduled" as const, scheduled_at: new Date("2026-11-28T14:00:00Z"), venue: "V", overs: 4, side1_name: "A", side1_team: "t1", side2_name: "B", side2_team: null, my_answer: "out" as const };
    const m = toMatchItem(row, "UTC", { myTeams: new Set(["t1"]), now: new Date("2026-11-25T00:00:00Z") });
    expect(m).toMatchObject({ mine1: true, mine2: false, myAnswer: "out", thisWeek: true });
    expect(toMatchItem(row, "UTC", { now: new Date("2026-12-25T00:00:00Z") }).thisWeek).toBe(false);
  });
});

describe("what a card says about the score", () => {
  const A = (i: number) => `a${i}`, B = (i: number) => `b${i}`;
  const players: PlayerEntry[] = [
    ...[1, 2].map((i) => ({ id: A(i), side: 1 as Side, name: `Alpha${i}`, number: i, kind: "member" as const, userId: `ua${i}` })),
    ...[1, 2].map((i) => ({ id: B(i), side: 2 as Side, name: `Bravo${i}`, number: i + 10, kind: "member" as const, userId: `ub${i}` })),
  ];
  const run = (bodies: ScoreEventBody[]) => {
    const built = buildState(bodies.map((b, i) => ({ ...b, id: `e${i}`, seq: i + 1 }) as ScoreEvent));
    if (!built.ok) throw new Error(built.error);
    return built.state;
  };
  const start: ScoreEventBody[] = [
    { type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs: 2, playersPerSide: 2, rules: { ...DEFAULT_RULES, lastBatterAlone: false }, players, toss: null, battingFirst: 1 } },
    { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
  ];
  it("a live first innings shows the score and the overs, with no chase line", () => {
    const s = liveSummary(run([...start, ...[1, 4, 0].map((r) => ({ type: "ball", payload: { runs: r } }) as ScoreEventBody)]));
    expect(s).toEqual({ score: "5/0", scoreSub: "0.3 ov", chase: null, result: null });
  });
  it("a finished match shows the innings totals and the saved result", () => {
    expect(pastSummary([{ innings: 1, batting: 1, runs: 68, wickets: 6, balls: 36, superOver: false }, { innings: 0, batting: 2, runs: 72, wickets: 4, balls: 36, superOver: false }, { innings: 2, batting: 1, runs: 9, wickets: 0, balls: 6, superOver: true }], "Thunder Strikers won by 6 runs"))
      .toEqual({ score: "72/4 · 68/6", scoreSub: null, chase: null, result: "Thunder Strikers won by 6 runs" });
    expect(pastSummary(null, "  ")).toEqual({ score: null, scoreSub: null, chase: null, result: null });
  });
});

describe("team rules", () => {
  it("warns when a squad is too small, and says how many more are needed", () => {
    expect(needsPlayersText(0)).toBe("Needs 2 more players to play. A match needs at least 2 players on each side.");
    expect(needsPlayersText(1)).toBe("Needs 1 more player to play. A match needs at least 2 players on each side.");
    expect(needsPlayersText(2)).toBeNull();
  });
  it("explains a blocked delete with the singular and plural wording", () => {
    expect(deleteBlockedText(14)).toBe("This team has 14 matches, so it cannot be deleted. Its matches keep their record. You can still edit the team or change its squad.");
    expect(deleteBlockedText(1)).toContain("has 1 match, so it cannot be deleted");
  });
  it("searches, sorts and compares squads", () => {
    const t = (name: string, won: number): TeamItem => ({ id: name, name, captain: null, vice: null, squad: 5, mine: false, matches: 0, played: won, won, lost: 0, tied: 0, form: [] });
    const list = [t("Royal Panthers", 8), t("Blue Hawks", 3), t("Thunder Strikers", 9)];
    expect(filterTeams(list, " blue ").map((x) => x.name)).toEqual(["Blue Hawks"]);
    expect(sortTeams(list, "az").map((x) => x.name)).toEqual(["Blue Hawks", "Royal Panthers", "Thunder Strikers"]);
    expect(sortTeams(list, "record").map((x) => x.name)).toEqual(["Thunder Strikers", "Royal Panthers", "Blue Hawks"]);
    expect(squadChanges(["a", "b", "c"], ["b", "c", "d"])).toEqual({ added: ["d"], removed: ["a"] });
    expect(formKey({ result: "win", opponent: "Hawks" })).toBe("W = won v Hawks");
  });
});

/* ------------------------------------------------------------------ matches list ------------------------------------------------------------------ */
describe("match card", () => {
  it("shows both team badges, the status, when, venue and overs", () => {
    const html = renderToStaticMarkup(<MatchItemCard communityId="c1" m={item({ mine1: true })} />);
    expect(html).toContain("Team Thunder Strikers, your team");
    expect(html).toContain("Team Royal Panthers");
    expect(html).toContain("Scheduled");
    expect(html).toContain("Fri, 28 Nov, 8:00 pm · Clifton Arena · 6 overs");
    expect(html).toContain('href="/c/c1/matches/m1"');
  });
  it("is quiet: only your own reply, never the counts, and buttons only when you have not replied", () => {
    const none = renderToStaticMarkup(<MatchItemCard communityId="c1" m={item()} />);
    expect(none).toContain("You have not replied");
    expect(none).toContain(">I’m in<");
    expect(none).toContain(">Can’t make it<");
    expect(none).not.toMatch(/\d+ in|can’t ·|no reply/);
    const yes = renderToStaticMarkup(<MatchItemCard communityId="c1" m={item({ myAnswer: "in" })} />);
    expect(yes).toContain("You: I’m in");
    expect(yes).toContain("Change");
    expect(renderToStaticMarkup(<MatchItemCard communityId="c1" m={item({ myAnswer: "out" })} />)).toContain("You: Can’t make it");
    const started = renderToStaticMarkup(<MatchItemCard communityId="c1" m={item({ status: "completed" })} />);
    expect(started).not.toContain("replied");
    expect(started).not.toContain("You:");
  });
  it("a live card shows the score, the overs and the chase line; a past card shows the result", () => {
    const live = renderToStaticMarkup(<MatchItemCard communityId="c1" m={item({ status: "live", score: "47/2", scoreSub: "4.2 ov", chase: "Panthers need 12 from 10" })} />);
    expect(live).toContain("47/2");
    expect(live).toContain("4.2 ov");
    expect(live).toContain("Panthers need 12 from 10");
    const past = renderToStaticMarkup(<MatchItemCard communityId="c1" m={item({ status: "completed", score: "72/4 · 68/6", result: "Thunder Strikers won by 6 runs" })} />);
    expect(past).toContain("72/4 · 68/6");
    expect(past).toContain("Thunder Strikers won by 6 runs");
  });
  it("a draft says nobody is told until a date is set", () => {
    expect(renderToStaticMarkup(<MatchItemCard communityId="c1" m={item({ status: "draft", at: null, when: "No date yet" })} />)).toContain("Nobody is told until you set a date.");
  });
});

describe("matches list screen", () => {
  const sample = [
    item({ id: "1", status: "live", score: "47/2", scoreSub: "4.2 ov" }),
    item({ id: "2", status: "scheduled", side1: "Desert Falcons", side2: "Blue Hawks", venue: "Hall 2" }),
    item({ id: "3", status: "scheduled", side1: "Royal Panthers", side2: "Night Riders", myAnswer: "in" }),
    item({ id: "4", status: "postponed", side1: "Blue Hawks", side2: "Night Riders" }),
    item({ id: "5", status: "completed", side1: "Thunder Strikers", side2: "Desert Falcons", result: "Strikers won" }),
  ];
  it("segments show counts and narrow the list", () => {
    render(wrap(<MatchList communityId="c1" items={sample} />));
    expect(screen.getByRole("button", { name: /^All\s*5/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Upcoming\s*3/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Past/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Strikers won")).toBeTruthy();
  });
  it("Needs my reply turns the list into the unanswered matches", () => {
    render(wrap(<MatchList communityId="c1" items={sample} />));
    const chip = screen.getByRole("button", { name: /Needs my reply/ });
    expect(chip.textContent).toContain("2");
    fireEvent.click(chip);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("Showing 2 matches you have not answered.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^I’m in for/ })).toHaveLength(2);
  });
  it("Needs my reply with everything answered says so", () => {
    render(wrap(<MatchList communityId="c1" items={[item({ myAnswer: "in" })]} />));
    fireEvent.click(screen.getByRole("button", { name: /Needs my reply/ }));
    expect(screen.getByText("Nothing is waiting for your reply")).toBeTruthy();
  });
  it("search with no result says so and one tap clears it", () => {
    render(wrap(<MatchList communityId="c1" items={sample} />));
    fireEvent.change(screen.getByLabelText("Search matches by team or venue"), { target: { value: "zebras" } });
    expect(screen.getByText("No match for “zebras”")).toBeTruthy();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Clear the search" }));
    expect(screen.getAllByRole("article")).toHaveLength(5);
  });
  it("starts with a search from the address (See its matches link)", () => {
    render(wrap(<MatchList communityId="c1" items={sample} initialQuery="falcons" />));
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
  it("first-time state has the illustrated card with both real actions and the offline line", () => {
    render(wrap(<MatchList communityId="c1" items={[]} />));
    expect(screen.getByText("No matches yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: /New match/ }).getAttribute("href")).toBe("/c/c1/matches/new");
    expect(screen.getByRole("link", { name: /Plan several/ }).getAttribute("href")).toBe("/c/c1/matches/several");
    expect(screen.getByText(/Playing without signal/)).toBeTruthy();
    expect(renderToStaticMarkup(<MatchesEmpty communityId="c1" />)).toContain("Create one match, or plan several at once");
  });
  it("after a delete, a short message appears and there is no Undo", () => {
    render(wrap(<MatchList communityId="c1" items={sample} deleted />));
    expect(screen.getByText("Match deleted.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
});

describe("match row menu", () => {
  it("scheduled: open, pick lineups, edit, rematch, postpone, cancel and delete", () => {
    render(wrap(<MatchRowMenu communityId="c1" matchId="m1" status="scheduled" side1="Alpha" side2="Bravo" />));
    fireEvent.click(screen.getByRole("button", { name: "Actions for Alpha v Bravo" }));
    const labels = screen.getAllByRole("menuitem").map((e) => e.textContent);
    expect(labels).toEqual(["Open match", "Pick lineups", "Edit match", "Rematch", "Postpone…", "Cancel match…", "Delete match…"]);
    expect(screen.getByRole("menuitem", { name: "Pick lineups" }).getAttribute("href")).toBe("/c/c1/matches/m1/lineup");
    expect(screen.getByRole("menuitem", { name: "Edit match" }).getAttribute("href")).toBe("/c/c1/matches/m1/edit");
    expect(screen.getByRole("menuitem", { name: "Rematch" }).getAttribute("href")).toBe("/c/c1/matches/m1/rematch");
  });
  it("live and finished: only Open match and Rematch", () => {
    render(wrap(<MatchRowMenu communityId="c1" matchId="m1" status="live" side1="Alpha" side2="Bravo" />));
    fireEvent.click(screen.getByRole("button", { name: /Actions for/ }));
    expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["Open match", "Rematch"]);
  });
  it("delete asks for the match name and only then calls the existing delete action", async () => {
    render(wrap(<MatchRowMenu communityId="c1" matchId="m1" status="scheduled" side1="Alpha" side2="Bravo" />));
    fireEvent.click(screen.getByRole("button", { name: /Actions for/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete match…" }));
    const dlg = screen.getByRole("alertdialog");
    const confirm = within(dlg).getByRole("button", { name: "Delete match" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dlg).getByRole("textbox"), { target: { value: "Alpha v Bravo" } });
    expect(confirm.disabled).toBe(false);
    await act(async () => { fireEvent.click(confirm); });
    expect(deleteMatchAction).toHaveBeenCalledTimes(1);
    const fd = vi.mocked(deleteMatchAction).mock.calls[0]![0] as FormData;
    expect(fd.get("communityId")).toBe("c1");
    expect(fd.get("matchId")).toBe("m1");
  });
  it("postpone and cancel ask first, then call their existing actions", async () => {
    render(wrap(<MatchRowMenu communityId="c1" matchId="m1" status="scheduled" side1="Alpha" side2="Bravo" />));
    fireEvent.click(screen.getByRole("button", { name: /Actions for/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Postpone…" }));
    expect(postponeAction).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Postpone match" })); });
    expect(postponeAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Actions for/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancel match…" }));
    await act(async () => { fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel match" })); });
    expect(cancelAction).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ teams list ------------------------------------------------------------------ */
const team = (over: Partial<TeamItem> = {}): TeamItem => ({
  id: "t1", name: "Thunder Strikers", captain: "Ali Raza", vice: "Zain Malik", squad: 7, mine: true, matches: 14, played: 14, won: 9, lost: 4, tied: 1,
  form: [{ result: "win", opponent: "Hawks" }, { result: "tie", opponent: "Falcons" }, { result: "loss", opponent: "Panthers" }], ...over,
});
const table: TableRow[] = [{ id: "t1", name: "Thunder Strikers", rank: 1, played: 14, won: 9, lost: 4, tied: 1, winPercent: 64, totalRuns: 986, mine: true }];

describe("teams list", () => {
  it("shows a badge on every team, marks your team, the record and the form guide with letters", () => {
    render(wrap(<TeamsList communityId="c1" teams={[team(), team({ id: "t2", name: "Night Riders", mine: false, squad: 2, matches: 0, played: 0, won: 0, lost: 0, tied: 0, form: [], captain: null, vice: null })]} table={table} />));
    expect(screen.getByLabelText("Team Thunder Strikers, your team")).toBeTruthy();
    expect(screen.getByLabelText("Team Night Riders")).toBeTruthy();
    expect(screen.getByText("Your team")).toBeTruthy();
    expect(screen.getByText("9 won")).toBeTruthy();
    expect(screen.getByText("No matches yet")).toBeTruthy();
    expect(screen.getByText("No captain yet")).toBeTruthy();
    expect(screen.getByRole("list", { name: /Last 3 results, oldest first: Won, Tied, Lost/ })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Team table" })).toBeTruthy();
  });
  it("a team with fewer than 2 players says it cannot play yet, right on the card", () => {
    render(wrap(<TeamsList communityId="c1" teams={[team({ squad: 1, mine: false })]} table={[]} />));
    expect(screen.getByText(/Needs 2\+ players to play/)).toBeTruthy();
  });
  it("with no finished match the table is a placeholder, not missing", () => {
    render(wrap(<TeamsList communityId="c1" teams={[team({ played: 0, matches: 0 })]} table={[]} />));
    expect(screen.getByText(/The table appears after the first finished match/)).toBeTruthy();
  });
  it("search narrows the cards and a miss gives a clear message", () => {
    render(wrap(<TeamsList communityId="c1" teams={[team(), team({ id: "t2", name: "Blue Hawks", mine: false })]} table={table} />));
    fireEvent.change(screen.getByLabelText("Search teams"), { target: { value: "hawk" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Search teams"), { target: { value: "zzz" } });
    expect(screen.getByText("No team for “zzz”")).toBeTruthy();
  });
  it("first-time state: one clear action and the Explore shortcuts", () => {
    render(wrap(<TeamsList communityId="c1" teams={[]} table={[]} />));
    expect(screen.getByText("Make your first team")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Create a team/ }).getAttribute("href")).toBe("/c/c1/teams/new");
    expect(screen.getByText("Explore")).toBeTruthy();
    for (const p of ["members", "series", "leaderboard", "insights", "compare"]) expect(document.querySelector(`a[href="/c/c1/${p}"]`)).toBeTruthy();
  });
  it("the card menu has Edit team, Edit squad and Delete", () => {
    render(wrap(<TeamsList communityId="c1" teams={[team({ matches: 0 })]} table={table} />));
    fireEvent.click(screen.getByRole("button", { name: "Actions for Thunder Strikers" }));
    expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["Edit team", "Edit squad", "Delete team…"]);
    expect(screen.getByRole("menuitem", { name: "Edit team" }).getAttribute("href")).toBe("/c/c1/teams/t1/edit");
    expect(screen.getByRole("menuitem", { name: "Edit squad" }).getAttribute("href")).toBe("/c/c1/teams/t1/squad");
  });
  it("delete on a team with matches explains why and deletes nothing", () => {
    render(wrap(<TeamsList communityId="c1" teams={[team()]} table={table} />));
    fireEvent.click(screen.getByRole("button", { name: "Actions for Thunder Strikers" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete team \(has 14 matches, not allowed\)/ }));
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText(/This team has 14 matches, so it cannot be deleted/)).toBeTruthy();
    expect(within(dlg).queryByRole("textbox")).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: "Edit squad instead" }));
    expect(push).toHaveBeenCalledWith("/c/c1/teams/t1/squad");
    expect(deleteTeamAction).not.toHaveBeenCalled();
  });
  it("delete on a team without matches needs the team name typed", async () => {
    render(wrap(<TeamsList communityId="c1" teams={[team({ matches: 0, played: 0 })]} table={[]} />));
    fireEvent.click(screen.getByRole("button", { name: "Actions for Thunder Strikers" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete team…" }));
    const dlg = screen.getByRole("alertdialog");
    const go = within(dlg).getByRole("button", { name: "Delete team" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(within(dlg).getByRole("textbox"), { target: { value: "Thunder Strikers" } });
    await act(async () => { fireEvent.click(go); });
    const fd = vi.mocked(deleteTeamAction).mock.calls[0]![0] as FormData;
    expect([fd.get("communityId"), fd.get("teamId")]).toEqual(["c1", "t1"]);
  });
});

/* ------------------------------------------------------------------ new / edit team ------------------------------------------------------------------ */
const people = [
  { user_id: "u1", name: "Hamza Khan", player_number: 10 },
  { user_id: "u2", name: "Bilal Ahmed", player_number: 18 },
  { user_id: "u3", name: "Ali Raza", player_number: 7 },
];

describe("team editor", () => {
  it("create: step 1 of 2, counters, the badge preview follows the name, and the old button text", () => {
    render(wrap(<TeamEditor mode="create" communityId="c1" members={people} />));
    expect(screen.getByRole("group", { name: /Step 1 of 2/ })).toBeTruthy();
    expect(screen.getByText("0/40")).toBeTruthy();
    expect(screen.getByText("0/200")).toBeTruthy();
    expect(screen.getByLabelText("No name yet")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "Gulshan Giants" } });
    expect(screen.getByText("14/40")).toBeTruthy();
    const preview = screen.getByLabelText("Preview of the team");
    expect(within(preview).getByLabelText("Team Gulshan Giants").textContent).toBe("GG");
    expect(screen.getByRole("button", { name: "Next: choose the squad" })).toBeTruthy();
    expect(screen.getByText("Names are unique in this community.")).toBeTruthy();
  });
  it("captain and vice-captain pickers show shirts, search, and fill the preview with C and VC", () => {
    const { container } = render(wrap(<TeamEditor mode="create" communityId="c1" members={people} />));
    fireEvent.click(screen.getAllByRole("button", { name: /Not chosen/ })[0]!);
    fireEvent.change(screen.getByLabelText("Search members for Captain"), { target: { value: "ham" } });
    expect(screen.queryByRole("option", { name: /Bilal/ })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /Hamza Khan/ }));
    expect((container.querySelector('input[name="captainId"]') as HTMLInputElement).value).toBe("u1");
    const preview = screen.getByLabelText("Preview of the team");
    expect(within(preview).getByText("Hamza Khan")).toBeTruthy();
    expect(within(preview).getByText("C")).toBeTruthy();
  });
  it("the same person as captain and vice-captain is flagged at once with the real wording", () => {
    render(wrap(<TeamEditor mode="create" communityId="c1" members={people} team={{ name: "X Team", description: "", captain_id: "u1", vice_captain_id: "u1" }} />));
    expect(screen.getByRole("alert").textContent).toContain("The captain and vice-captain must be two different people.");
  });
  it("a server error sits with its field, and what was typed is kept", async () => {
    render(wrap(<TeamEditor mode="create" communityId="c1" members={people} />));
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "Thunder Strikers" } });
    await act(async () => { fireEvent.submit(screen.getByLabelText("Team name").closest("form")!); });
    expect(createTeamAction).toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("A team with this name already exists in this community.");
    expect((screen.getByLabelText("Team name") as HTMLInputElement).value).toBe("Thunder Strikers");
  });
  it("edit: keeps every field, says Save team, and the saved message is a snackbar", async () => {
    render(wrap(<TeamEditor mode="edit" communityId="c1" teamId="t1" members={people} team={{ name: "Night Riders", description: "Late games", captain_id: "u3", vice_captain_id: null }} />));
    expect((screen.getByLabelText("Team name") as HTMLInputElement).value).toBe("Night Riders");
    expect((screen.getByLabelText("Description (optional)") as HTMLInputElement).value).toBe("Late games");
    expect(screen.queryByRole("group", { name: /Step/ })).toBeNull();
    await act(async () => { fireEvent.submit(screen.getByLabelText("Team name").closest("form")!); });
    expect(screen.getByText("Saved.")).toBeTruthy();
  });
  it("member picker: Escape closes, and 'Not chosen' clears", () => {
    const onChange = vi.fn();
    render(<MemberPicker label="Captain" name="captainId" value="u1" onChange={onChange} members={people} />);
    fireEvent.click(screen.getByRole("button", { name: /Hamza Khan/ }));
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Hamza Khan/ }));
    fireEvent.click(screen.getByRole("option", { name: "Not chosen" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("delete card on the edit page", () => {
  it("team with matches: locked, the real sentence, two useful buttons, dimmed delete", () => {
    render(wrap(<TeamDangerZone communityId="c1" teamId="t1" name="Thunder Strikers" matchCount={14} />));
    expect(screen.getByText("Locked")).toBeTruthy();
    expect(screen.getByText("This team has 14 matches, so it cannot be deleted. Its matches keep their record. You can still edit the team or change its squad.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See its 14 matches" }).getAttribute("href")).toBe("/c/c1/matches?q=Thunder%20Strikers");
    expect(screen.getByRole("link", { name: "Edit squad" }).getAttribute("href")).toBe("/c/c1/teams/t1/squad");
    expect((screen.getByRole("button", { name: "Delete Thunder Strikers (not allowed)" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("exactly 1 match uses the singular", () => {
    render(wrap(<TeamDangerZone communityId="c1" teamId="t1" name="Night Riders" matchCount={1} />));
    expect(screen.getByText(/has 1 match, so it cannot be deleted/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "See its 1 match" })).toBeTruthy();
  });
  it("no matches: typed name, outcome-labelled button, tick when exact", async () => {
    render(wrap(<TeamDangerZone communityId="c1" teamId="t2" name="Night Riders" matchCount={0} />));
    fireEvent.click(screen.getByRole("button", { name: /Delete Night Riders…/ }));
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText(/Removes Night Riders and its squad for good/)).toBeTruthy();
    const go = within(dlg).getByRole("button", { name: "Delete team" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(within(dlg).getByRole("textbox"), { target: { value: "night riders" } });
    expect(go.disabled).toBe(false);
    await act(async () => { fireEvent.click(go); });
    expect(deleteTeamAction).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ team page ------------------------------------------------------------------ */
const rows = [
  { user_id: "u3", name: "Ali Raza", player_number: 7, role: "Batter" },
  { user_id: "u1", name: "Zain Malik", player_number: 3, role: "Batter" },
  { user_id: "u2", name: "Bilal Ahmed", player_number: 18, role: "Bowler" },
];

describe("team page squad card", () => {
  it("shows the count, tags C, VC and YOU, and the roles on every row", () => {
    render(wrap(<SquadCard communityId="c1" teamId="t1" teamName="Thunder Strikers" rows={rows} captainId="u3" viceId="u1" me="u3" />));
    expect(screen.getByRole("heading", { name: /Squad\s*3 players/ })).toBeTruthy();
    expect(screen.getByTitle("Captain").textContent).toBe("C");
    expect(screen.getByTitle("Vice-captain").textContent).toBe("VC");
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit squad" }).getAttribute("href")).toBe("/c/c1/teams/t1/squad");
  });
  it("one player: orange banner 'Needs 1 more player to play'", () => {
    render(wrap(<SquadCard communityId="c1" teamId="t1" teamName="X" rows={rows.slice(0, 1)} captainId={null} viceId={null} me="zz" />));
    expect(screen.getByText("Needs 1 more player to play. A match needs at least 2 players on each side.")).toBeTruthy();
  });
  it("empty squad: 'No players yet.' with an Add players button", () => {
    render(wrap(<SquadCard communityId="c1" teamId="t1" teamName="X" rows={[]} captainId={null} viceId={null} me="zz" />));
    expect(screen.getByText("No players yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Add players/ }).getAttribute("href")).toBe("/c/c1/teams/t1/squad");
  });
  it("the row menu has open player, make captain, make vice-captain and remove", async () => {
    render(wrap(<SquadCard communityId="c1" teamId="t1" teamName="Thunder Strikers" rows={rows} captainId="u3" viceId="u1" me="u3" />));
    fireEvent.click(screen.getByRole("button", { name: "Actions for Bilal Ahmed in Thunder Strikers" }));
    expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["Open player", "Make captain", "Make vice-captain", "Remove from squad"]);
    expect(screen.getByRole("menuitem", { name: "Open player" }).getAttribute("href")).toBe("/c/c1/players/u2");
    await act(async () => { fireEvent.click(screen.getByRole("menuitem", { name: "Make vice-captain" })); });
    expect(setTeamRoleAction).toHaveBeenCalledWith("c1", "t1", "u2", "vice");
    expect(screen.getByText("Bilal Ahmed is now vice-captain.")).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });
  it("removing a player is undoable: the row goes, an Undo snackbar says the role went too, and the real removal waits", async () => {
    vi.useFakeTimers();
    vi.mocked(removeFromSquadAction).mockClear();
    render(wrap(<SquadCard communityId="c1" teamId="t1" teamName="Thunder Strikers" rows={rows} captainId="u3" viceId="u1" me="u3" />));
    fireEvent.click(screen.getByRole("button", { name: "Actions for Zain Malik in Thunder Strikers" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove from squad" }));
    expect(screen.queryByText("Zain Malik")).toBeNull();
    expect(screen.getByText("Zain Malik removed from the squad. The vice-captain role went with the squad place.")).toBeTruthy();
    expect(removeFromSquadAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Zain Malik")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(removeFromSquadAction).not.toHaveBeenCalled();
    // and without Undo the removal is made after the wait
    fireEvent.click(screen.getByRole("button", { name: "Actions for Bilal Ahmed in Thunder Strikers" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove from squad" }));
    await act(async () => { vi.advanceTimersByTime(7000); });
    expect(removeFromSquadAction).toHaveBeenCalledWith("c1", "t1", "u2");
  });
  it("top bar: a labelled Edit link and a menu with Edit team, Edit squad and Delete", () => {
    render(wrap(<TeamTopActions communityId="c1" teamId="t1" name="Thunder Strikers" matchCount={14} />));
    expect(screen.getByRole("link", { name: /Edit/ }).getAttribute("href")).toBe("/c/c1/teams/t1/edit");
    fireEvent.click(screen.getByRole("button", { name: "Actions for Thunder Strikers" }));
    expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["Edit team", "Edit squad", "Delete team (has 14 matches, not allowed)"]);
  });
});

/* ------------------------------------------------------------------ edit squad ------------------------------------------------------------------ */
const members = [
  { user_id: "u3", name: "Ali Raza", player_number: 7, playing_role: "batter" },
  { user_id: "u1", name: "Hamza Khan", player_number: 10, playing_role: "all_rounder" },
  { user_id: "u2", name: "Bilal Ahmed", player_number: 18, playing_role: "bowler" },
  { user_id: "u4", name: "Usman Tariq", player_number: 45, playing_role: "wicket_keeper" },
];
const squadProps = { communityId: "c1", teamId: "t1", teamName: "Thunder Strikers", members, me: "u3", cancelHref: "/c/c1/teams/t1" };
const sent = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLInputElement>('input[name="member"]')).map((i) => i.value);

describe("edit squad", () => {
  it("sends one 'member' per ticked person (what the old page sent) and shows the count on Save", () => {
    const { container } = render(wrap(<SquadEditor {...squadProps} captainId="u1" viceId="u2" initial={["u1", "u2"]} isNew={false} />));
    expect(sent(container)).toEqual(["u1", "u2"]);
    expect(screen.getByRole("button", { name: "Save squad (2)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Usman Tariq" }));
    expect(sent(container)).toEqual(["u1", "u2", "u4"]);
    expect(screen.getByRole("button", { name: "Save squad (3)" })).toBeTruthy();
    expect(container.querySelector('input[name="communityId"]')).toBeTruthy();
    expect(container.querySelector('input[name="teamId"]')).toBeTruthy();
  });
  it("straight after creating the team: step 2 of 2, captain and vice already ticked, ready tile", () => {
    render(wrap(<SquadEditor {...squadProps} captainId="u1" viceId="u2" initial={["u1", "u2"]} isNew />));
    expect(screen.getByRole("group", { name: /Step 2 of 2/ })).toBeTruthy();
    expect(screen.getByText("Team created.")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText("Can play a match")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Hamza Khan, captain" }) as HTMLInputElement).checked).toBe(true);
  });
  it("unticking the captain warns before Save, names the person, and counts the change", () => {
    render(wrap(<SquadEditor {...squadProps} captainId="u3" viceId={null} initial={["u3", "u1", "u2"]} isNew={false} />));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ali Raza, captain" }));
    const warn = screen.getByRole("alert");
    expect(warn.textContent).toContain("Ali Raza is the captain.");
    expect(warn.textContent).toContain("also removes the captain role");
    expect(screen.getByText("1 removed")).toBeTruthy();
  });
  it("search narrows the list, and Select all and Clear apply to the matches only", () => {
    const { container } = render(wrap(<SquadEditor {...squadProps} captainId={null} viceId={null} initial={["u2"]} isNew={false} />));
    fireEvent.change(screen.getByLabelText("Search members"), { target: { value: "an" } });   // Hamza Khan, Usman Tariq
    expect(screen.queryByText("Ali Raza")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(sent(container).sort()).toEqual(["u1", "u2", "u4"]);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(sent(container)).toEqual(["u2"]);   // Bilal was not in the search, so he stays
  });
  it("filters: In squad, Not in squad and playing role", () => {
    render(wrap(<SquadEditor {...squadProps} captainId={null} viceId={null} initial={["u2", "u4"]} isNew={false} />));
    fireEvent.click(screen.getByRole("button", { name: /^In squad/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /^Not in squad/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /^All\s*\d/ }));
    fireEvent.click(screen.getByRole("button", { name: "Bowler" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });
  it("nobody selected: 'Not yet', needs 2+ players, and Save squad (0)", () => {
    render(wrap(<SquadEditor {...squadProps} captainId={null} viceId={null} initial={[]} isNew={false} />));
    expect(screen.getByText("Not yet")).toBeTruthy();
    expect(screen.getByText("Needs 2+ players")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save squad (0)" })).toBeTruthy();
  });
  it("Leave squad on my own row unticks me with an Undo that says the captain role goes too", () => {
    vi.useFakeTimers();
    const { container } = render(wrap(<SquadEditor {...squadProps} captainId="u3" viceId={null} initial={["u3", "u1"]} isNew={false} />));
    fireEvent.click(screen.getByRole("button", { name: "Leave squad" }));
    expect(sent(container)).toEqual(["u1"]);
    expect(screen.getByText(/You are no longer captain, because the captain role goes with the squad place\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Leave squad" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(sent(container).sort()).toEqual(["u1", "u3"]);
  });
  it("Cancel goes back to the team", () => {
    render(wrap(<SquadEditor {...squadProps} captainId={null} viceId={null} initial={[]} isNew={false} />));
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/c/c1/teams/t1");
  });
});
