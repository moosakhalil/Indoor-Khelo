// @vitest-environment jsdom
// Phase F1 (UI redesign): the five Series screens (list, new, series page, add matches, edit).
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/series", useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock("@/app/actionsF1", () => ({
  createSeriesF1Action: vi.fn(async () => ({})),
  updateSeriesF1Action: vi.fn(async () => ({})),
  groupMatchesF1Action: vi.fn(async () => ({})),
  addMatchesF1Action: vi.fn(async () => ({})),
  seriesStatusQuietAction: vi.fn(async () => ({ ok: true })),
  removeMatchQuietAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/actionsSeries", () => ({ deleteSeriesAction: vi.fn(async () => undefined) }));

import { addMatchesF1Action, createSeriesF1Action, groupMatchesF1Action, removeMatchQuietAction, seriesStatusQuietAction, updateSeriesF1Action } from "@/app/actionsF1";
import { deleteSeriesAction } from "@/app/actionsSeries";
import AddMatches from "@/components/AddMatches";
import { SeriesForm } from "@/components/FormsSeries";
import NewSeries from "@/components/NewSeries";
import SeriesList, { SeriesEmpty } from "@/components/SeriesList";
import SeriesMatches, { type SeriesRow } from "@/components/SeriesMatches";
import SeriesToast from "@/components/SeriesToast";
import SeriesView, { SeriesSide, type SeriesViewData } from "@/components/SeriesView";
import { SnackbarProvider } from "@/components/Snackbar";
import { pointsTable, seriesStatus, tally, tallyLine, type SeriesMatch, type SeriesSide as Side } from "@/lib/series";
import {
  addCounts, addFilter, autoName, clampBestOf, duplicateRows, filterSeries, firstToText, lockedFlags, previewLine, progress, scoreWord, segmentCounts, seriesState,
  statusFilterMatch, teamsFromMatches, toastFor, withCount, type AvailItem, type FreeMatch, type SeriesCardItem,
} from "@/lib/seriesView";

const wrap = (ui: React.ReactNode) => <SnackbarProvider>{ui}</SnackbarProvider>;
beforeEach(() => { refresh.mockClear(); vi.mocked(deleteSeriesAction).mockClear(); vi.mocked(seriesStatusQuietAction).mockClear(); vi.mocked(removeMatchQuietAction).mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.mocked(createSeriesF1Action).mockReset(); vi.mocked(updateSeriesF1Action).mockReset(); vi.mocked(groupMatchesF1Action).mockReset(); vi.mocked(addMatchesF1Action).mockReset();
  vi.mocked(createSeriesF1Action).mockImplementation(async () => ({})); vi.mocked(updateSeriesF1Action).mockImplementation(async () => ({})); vi.mocked(groupMatchesF1Action).mockImplementation(async () => ({})); vi.mocked(addMatchesF1Action).mockImplementation(async () => ({})); });

/* ---------- data ---------- */
const TS: Side = { name: "Thunder Strikers", teamId: "t-ts" }, RP: Side = { name: "Royal Panthers", teamId: "t-rp" }, DF: Side = { name: "Desert Falcons", teamId: "t-df" }, BH: Side = { name: "Blue Hawks", teamId: "t-bh" };
let n = 0;
const sm = (s1: Side, s2: Side, win: 1 | 2 | null, kind: SeriesMatch["resultKind"] = "win", status = "completed"): SeriesMatch => ({ matchId: `m${++n}`, status, resultKind: status === "completed" ? kind : null, winnerPosition: win, side1: s1, side2: s2 });

function card(id: string, name: string, sides: Side[], ms: SeriesMatch[], open: boolean, format: "open" | "best_of" = "best_of", bestOf: number | null = 3, mine = ["t-ts"]): SeriesCardItem {
  const t = tally(sides, ms);
  const st = seriesStatus(format, bestOf, !open, t);
  return {
    id, name, open, format, bestOf, matchCount: ms.length,
    sides: t.rows.map((r) => { const s = sides.find((x) => x.name === r.name)!; return { name: r.name, teamId: s.teamId, mine: mine.includes(s.teamId!) }; }),
    wins: t.rows.length === 2 ? [t.rows[0]!.won, t.rows[1]!.won] : null, counted: t.counted, line: tallyLine(t), statusText: st.text, status: st,
  };
}
const four = [TS, RP, DF, BH];
const six = () => [
  card("s1", "Winter Cup 2026", four, [sm(TS, DF, 1), sm(TS, RP, 2, "tie"), sm(RP, BH, 1), sm(DF, BH, 1)], true, "open", null),
  card("s2", "Thunder v Panthers Rivalry", [TS, RP], [sm(TS, RP, 1), sm(RP, TS, 1), sm(TS, RP, 1, "win", "scheduled")], true),
  card("s3", "Desert Cup", [DF, BH], [sm(DF, BH, 1), sm(DF, BH, 1)], true),
  card("s4", "Autumn Decider", [TS, DF], [sm(TS, DF, 1), sm(DF, TS, 1), sm(TS, DF, null, "tie")], false),
  card("s5", "Summer Series", [RP, BH], [sm(RP, BH, 1), sm(BH, RP, 1), sm(RP, BH, 1), sm(RP, BH, 1)], false, "best_of", 5, []),
  card("s6", "Friday Showdown", [TS, RP], [], true),
];

/* ================================================================= pure rules ================================================================= */
describe("series state and score words", () => {
  const byId = Object.fromEntries(six().map((c) => [c.id, c]));
  const st = (id: string) => seriesState(byId[id]!.open, byId[id]!.status, byId[id]!.counted);
  it("each of the six states has its own word, never colour only", () => {
    expect(st("s1")).toMatchObject({ kind: "in_progress", label: "In progress" });
    expect(st("s2")).toMatchObject({ kind: "in_progress" });
    expect(st("s3")).toMatchObject({ kind: "won", label: "Winner: Desert Falcons" }); // won but still open
    expect(st("s4")).toMatchObject({ kind: "drawn", label: "Drawn", tone: "orange" });
    expect(st("s5")).toMatchObject({ kind: "won", label: "Winner: Royal Panthers" });
    expect(st("s6")).toMatchObject({ kind: "not_started", label: "Not started" });
  });
  it("a closed series with no finished match says so", () => {
    const c = card("x", "Empty", [TS, RP], [], false);
    expect(seriesState(c.open, c.status, c.counted)).toMatchObject({ kind: "closed_empty", label: "No finished matches" });
  });
  it("a level tournament has no winner and no leader named", () => {
    const c = byId.s1!;
    expect(c.statusText).toBe("level");
    expect(seriesState(true, c.status, c.counted).kind).toBe("in_progress");
  });
  it("LEVEL only when the wins are equal after a finished match, otherwise SERIES", () => {
    expect(scoreWord([1, 1], 2)).toBe("LEVEL");
    expect(scoreWord([0, 0], 0)).toBe("SERIES");
    expect(scoreWord([2, 0], 2)).toBe("SERIES");
  });
});

describe("progress marks, first-to text, previews", () => {
  it("best of 5 with four counted: five marks, four filled", () => {
    expect(progress("best_of", 5, 4)).toEqual({ total: 5, filled: 4, text: "4 of 5 matches played" });
    expect(progress("best_of", 3, 0).text).toBe("0 of 3 matches played");
    expect(progress("best_of", 1, 0).text).toBe("0 of 1 match played");
    expect(progress("best_of", 3, 4)).toMatchObject({ filled: 3, text: "4 matches played" });
    expect(progress("open", null, 6)).toEqual({ total: null, filled: 6, text: "6 matches played" });
  });
  it("first to N wins is more than half of the best-of number", () => {
    expect(firstToText(3)).toBe("first to 2 wins");
    expect(firstToText(5)).toBe("first to 3 wins");
    expect(firstToText(21)).toBe("first to 11 wins");
    expect(firstToText(1)).toBe("first to 1 win");
  });
  it("the stepper clamps to 1..21", () => {
    expect(clampBestOf(0)).toBe(1);
    expect(clampBestOf(22)).toBe(21);
    expect(clampBestOf(4)).toBe(4);
  });
  it("preview line", () => {
    expect(previewLine(0, "open", null)).toBe("Choose at least 2 teams · open-ended");
    expect(previewLine(1, "best_of", 3)).toBe("Choose at least 2 teams · best of 3");
    expect(previewLine(2, "best_of", 3)).toBe("2 teams · best of 3");
    expect(previewLine(4, "open", null)).toBe("4 teams · open-ended");
  });
});

describe("filter, search, counts", () => {
  const list = six();
  it("All 6, Open 4, Closed 2", () => {
    expect(segmentCounts(list)).toEqual({ all: 6, open: 4, closed: 2 });
    expect(filterSeries(list, "open", "")).toHaveLength(4);
    expect(filterSeries(list, "closed", "").map((s) => s.name)).toEqual(["Autumn Decider", "Summer Series"]);
  });
  it("search finds a series by its name or by a team in it, ignoring capitals", () => {
    expect(filterSeries(list, "all", "winter").map((s) => s.id)).toEqual(["s1"]);
    expect(filterSeries(list, "all", "BLUE hawks").map((s) => s.id)).toEqual(["s1", "s3", "s5"]);
    expect(filterSeries(list, "closed", "blue").map((s) => s.id)).toEqual(["s5"]);
    expect(filterSeries(list, "all", "zzz")).toEqual([]);
  });
});

describe("messages after an action", () => {
  it("saved, added, removed and status are short messages", () => {
    expect(toastFor({ saved: "1" }, true)).toEqual({ message: "Saved.", tone: "success" });
    expect(toastFor({ added: "1" }, true)?.message).toBe("1 match added.");
    expect(toastFor({ added: "2" }, true)?.message).toBe("2 matches added.");
    expect(toastFor({ removed: "1" }, true)?.message).toBe("Match removed from the series. The match itself is kept.");
    expect(toastFor({ status: "1" }, false)?.message).toBe("Series closed. Its record is kept.");
    expect(toastFor({ status: "1" }, true)?.message).toBe("Series reopened.");
    expect(toastFor({}, true)).toBeNull();
  });
});

describe("form helpers", () => {
  it("rows with the same name (without capitals) are marked", () => {
    const slots = [{ teamId: "t-ts", name: "Thunder Strikers", locked: false }, { teamId: null, name: "thunder strikers", locked: false }, { teamId: null, name: "X", locked: false }];
    expect([...duplicateRows(slots)].sort()).toEqual([0, 1]);
    expect(duplicateRows([{ teamId: null, name: "A", locked: false }, { teamId: null, name: "B", locked: false }]).size).toBe(0);
  });
  it("a team is locked when a match of the series has it as a side (by team, or by name for match-only teams)", () => {
    const sides: Side[] = [TS, RP, { name: "Walk-ins", teamId: null }, DF];
    const locked = lockedFlags(sides, [{ n1: "Thunder Strikers", t1: "t-ts", n2: "Royal Panthers", t2: "t-rp" }, { n1: "walk-ins", t1: null, n2: "Royal Panthers", t2: "t-rp" }]);
    expect(locked).toEqual([true, true, true, false]);
    expect(lockedFlags(sides, [])).toEqual([false, false, false, false]);
  });
});

describe("grouping matches", () => {
  const free: FreeMatch[] = [
    { id: "g1", side1: "Thunder Strikers", team1: "t-ts", side2: "Desert Falcons", team2: "t-df", when: "Sat", status: "completed", at: 3 },
    { id: "g3", side1: "Thunder Strikers", team1: "t-ts", side2: "Blue Hawks", team2: "t-bh", when: "Sat", status: "completed", at: 1 },
    { id: "g4", side1: "Desert Falcons", team1: "t-df", side2: "Royal Panthers", team2: "t-rp", when: "Fri", status: "scheduled", at: 4 },
    { id: "g5", side1: "Thunder Strikers", team1: "t-ts", side2: "Royal Panthers", team2: "t-rp", when: "No date yet", status: "draft", at: null },
  ];
  it("the teams are taken from the ticked matches, each once, earliest match first", () => {
    expect(teamsFromMatches([free[0]!, free[1]!]).map((t) => t.name)).toEqual(["Thunder Strikers", "Blue Hawks", "Desert Falcons"]);
    expect(teamsFromMatches([free[3]!, free[2]!]).map((t) => t.name)).toEqual(["Desert Falcons", "Royal Panthers", "Thunder Strikers"]);
  });
  it("automatic name: Alpha v Bravo for two teams, a typed name wins", () => {
    expect(autoName([{ name: "Alpha" }, { name: "Bravo" }], 2)).toBe("Alpha v Bravo");
    expect(autoName([{ name: "A" }, { name: "B" }, { name: "C" }], 2)).toBe("Series of 2 matches");
    expect(autoName([{ name: "A" }, { name: "B" }], 2, "  My cup ")).toBe("My cup");
    expect(autoName([], 0)).toBe("Series name");
  });
  it("status filter", () => {
    expect(statusFilterMatch("completed", "completed")).toBe(true);
    expect(statusFilterMatch("scheduled", "completed")).toBe(false);
    expect(statusFilterMatch("postponed", "other")).toBe(true);
    expect(statusFilterMatch("draft", "other")).toBe(false);
    expect(statusFilterMatch("live", "all")).toBe(true);
  });
  it("count on the button", () => {
    expect(withCount("Add to the series", 0)).toBe("Add to the series");
    expect(withCount("Add to the series", 2)).toBe("Add to the series (2)");
  });
  it("add page filters", () => {
    const items = [{ fits: true }, { fits: true }, { fits: true }, { fits: false }, { fits: false }];
    expect(addCounts(items)).toEqual({ all: 5, fit: 3, nofit: 2 });
    expect(addFilter(items, "fit")).toHaveLength(3);
    expect(addFilter(items, "nofit")).toHaveLength(2);
    expect(addFilter(items, "all")).toHaveLength(5);
  });
});

/* ================================================================= Series list ================================================================= */
describe("Series list", () => {
  it("every state is a card with both badges, the series score big, the state in words and the Open or Closed chip", () => {
    render(wrap(<SeriesList communityId="c1" items={six()} />));
    expect(screen.getAllByRole("article")).toHaveLength(6);
    const rival = screen.getByRole("link", { name: "Thunder v Panthers Rivalry" }).closest("article")!;
    expect(within(rival).getByLabelText("Thunder Strikers 1, Royal Panthers 1")).toBeTruthy();
    expect(rival.textContent).toContain("LEVEL");
    expect(rival.textContent).toContain("In progress");
    expect(rival.textContent).toContain("Open");
    const drawn = screen.getByRole("link", { name: "Autumn Decider" }).closest("article")!;
    expect(drawn.textContent).toContain("Closed");
    expect(drawn.textContent).toContain("Drawn");
    const won = screen.getByRole("link", { name: "Summer Series" }).closest("article")!;
    expect(won.textContent).toContain("Winner: Royal Panthers");
    expect(won.textContent).toContain("Closed");
    expect(screen.getByRole("link", { name: "Friday Showdown" }).closest("article")!.textContent).toContain("Not started");
  });
  it("a tournament shows the badge stack and the points line, not a two-team score", () => {
    render(wrap(<SeriesList communityId="c1" items={six()} />));
    const cup = screen.getByRole("link", { name: "Winter Cup 2026" }).closest("article")!;
    expect(within(cup).getAllByRole("img").length).toBe(4);
    expect(cup.textContent).toContain("Points:");
    expect(cup.textContent).toContain("open-ended");
  });
  it("your team has a gold ring and the words 'your team' for a screen reader", () => {
    render(wrap(<SeriesList communityId="c1" items={six()} />));
    const rival = screen.getByRole("link", { name: "Thunder v Panthers Rivalry" }).closest("article")!;
    expect(within(rival).getAllByLabelText("Team Thunder Strikers, your team").length).toBeGreaterThan(0);
    expect(rival.querySelector(".sr-mine")).toBeTruthy();
    const summer = screen.getByRole("link", { name: "Summer Series" }).closest("article")!;
    expect(summer.querySelector(".sr-mine")).toBeNull();
  });
  it("All / Open / Closed with counts, and search by name or team", () => {
    render(wrap(<SeriesList communityId="c1" items={six()} />));
    const seg = screen.getByRole("group", { name: "Show series" });
    expect(seg.textContent).toContain("All 6");
    expect(seg.textContent).toContain("Open 4");
    expect(seg.textContent).toContain("Closed 2");
    fireEvent.click(within(seg).getByRole("button", { name: /Closed/ }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    fireEvent.click(within(seg).getByRole("button", { name: /All/ }));
    fireEvent.change(screen.getByLabelText("Search series or teams"), { target: { value: "winter" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Search series or teams"), { target: { value: "nothing like this" } });
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getByText("No series match")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all series" }));
    expect(screen.getAllByRole("article")).toHaveLength(6);
  });
  it("the card menu has Edit, Add matches, Close (or Reopen) and Delete", () => {
    render(wrap(<SeriesList communityId="c1" items={six()} />));
    const rival = screen.getByRole("link", { name: "Thunder v Panthers Rivalry" }).closest("article")!;
    fireEvent.click(within(rival).getByRole("button", { name: "Actions for Thunder v Panthers Rivalry" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Edit series" }).getAttribute("href")).toBe("/c/c1/series/s2/edit");
    expect(within(menu).getByRole("menuitem", { name: "Add matches" }).getAttribute("href")).toBe("/c/c1/series/s2/add");
    expect(within(menu).getByRole("menuitem", { name: "Close the series" })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Delete series…" })).toBeTruthy();
    cleanup();
    render(wrap(<SeriesList communityId="c1" items={six()} />));
    const closed = screen.getByRole("link", { name: "Autumn Decider" }).closest("article")!;
    fireEvent.click(within(closed).getByRole("button", { name: "Actions for Autumn Decider" }));
    expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Reopen the series" })).toBeTruthy();
  });
  it("Close from the menu closes without leaving the page and says so", async () => {
    render(wrap(<SeriesList communityId="c1" items={six()} />));
    const rival = screen.getByRole("link", { name: "Thunder v Panthers Rivalry" }).closest("article")!;
    fireEvent.click(within(rival).getByRole("button", { name: "Actions for Thunder v Panthers Rivalry" }));
    await act(async () => { fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Close the series" })); });
    const fd = vi.mocked(seriesStatusQuietAction).mock.calls[0]![0] as FormData;
    expect([fd.get("communityId"), fd.get("seriesId"), fd.get("to")]).toEqual(["c1", "s2", "closed"]);
    expect(screen.getByText("Series closed. Its record is kept.")).toBeTruthy();
  });
  it("Delete asks for the whole series name and says the matches are kept", async () => {
    render(wrap(<SeriesList communityId="c1" items={six()} />));
    const rival = screen.getByRole("link", { name: "Thunder v Panthers Rivalry" }).closest("article")!;
    fireEvent.click(within(rival).getByRole("button", { name: "Actions for Thunder v Panthers Rivalry" }));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Delete series…" }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("Deletes the series only. Every match in it (3) is kept, with all its stats.");
    const del = within(dlg).getByRole("button", { name: "Delete series" }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    fireEvent.change(within(dlg).getByRole("textbox"), { target: { value: "Thunder v Panthers" } }); // a part of the name is not enough
    expect(del.disabled).toBe(true);
    fireEvent.change(within(dlg).getByRole("textbox"), { target: { value: "Thunder v Panthers Rivalry" } });
    expect(del.disabled).toBe(false);
    await act(async () => { fireEvent.click(del); });
    const fd = vi.mocked(deleteSeriesAction).mock.calls[0]![0] as FormData;
    expect([fd.get("communityId"), fd.get("seriesId")]).toEqual(["c1", "s2"]);
  });
  it("no series yet: both ways in and the 'optional' sentence", () => {
    render(<SeriesEmpty communityId="c1" />);
    expect(screen.getByText("No series yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start a series/ }).getAttribute("href")).toBe("/c/c1/series/new");
    expect(screen.getByRole("link", { name: /Group matches I already played/ }).getAttribute("href")).toBe("/c/c1/series/new?tab=group");
    expect(document.body.textContent).toContain("It is optional: you never need one to play a match.");
  });
});

/* ================================================================= New series and Edit series (the form) ================================================================= */
const teams = [{ id: "t-ts", name: "Thunder Strikers" }, { id: "t-rp", name: "Royal Panthers" }, { id: "t-df", name: "Desert Falcons" }, { id: "t-bh", name: "Blue Hawks" }];
const free: FreeMatch[] = [
  { id: "g1", side1: "Thunder Strikers", team1: "t-ts", side2: "Desert Falcons", team2: "t-df", when: "Sat, 22 Nov, 8:00 pm", status: "completed", at: 3 },
  { id: "g2", side1: "Royal Panthers", team1: "t-rp", side2: "Blue Hawks", team2: "t-bh", when: "Sat, 15 Nov, 8:00 pm", status: "completed", at: 2 },
  { id: "g3", side1: "Thunder Strikers", team1: "t-ts", side2: "Blue Hawks", team2: "t-bh", when: "Sat, 8 Nov, 8:00 pm", status: "completed", at: 1 },
  { id: "g4", side1: "Desert Falcons", team1: "t-df", side2: "Royal Panthers", team2: "t-rp", when: "Fri, 28 Nov, 8:00 pm", status: "scheduled", at: 4 },
  { id: "g5", side1: "Thunder Strikers", team1: "t-ts", side2: "Royal Panthers", team2: "t-rp", when: "No date yet", status: "draft", at: null },
];
const pvStart = () => screen.getAllByLabelText("Preview")[0]!;
const pvGroup = () => screen.getAllByLabelText("Preview")[1]!;
const addTeam = (id: string) => {
  fireEvent.click(screen.getAllByRole("button", { name: /^Add team \d$/ })[0]!);
  fireEvent.change(screen.getByLabelText(/choose a team/i), { target: { value: id } });
};

describe("New series: Start a series", () => {
  it("blank: four empty rows with Add, open-ended format, a preview that says to choose 2 teams, and the real hints", () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    expect(screen.getAllByRole("button", { name: /^Add team \d$/ })).toHaveLength(4);
    expect(screen.getByText("Teams (at least 2, up to 6 here)")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Open-ended" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("No fixed number of matches. Ranked on points.")).toBeTruthy();
    expect(screen.getByText("You can change the format later, for example from best of 3 to best of 5, and keep playing.")).toBeTruthy();
    const pv = pvStart();
    expect(pv.textContent).toContain("Series name");
    expect(pv.textContent).toContain("Choose at least 2 teams · open-ended");
    expect(screen.getByRole("button", { name: "Create series" })).toBeTruthy();
    expect(screen.getByText("0/60")).toBeTruthy();
  });
  it("two tabs; both stay mounted so typing survives a visit to the other tab", () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Start a series", "Group matches I have"]);
    fireEvent.change(screen.getByLabelText("Series name"), { target: { value: "Winter Cup" } });
    fireEvent.click(tabs[1]!);
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(tabs[0]!);
    expect((screen.getByLabelText("Series name") as HTMLInputElement).value).toBe("Winter Cup");
  });
  it("a chosen team becomes a badge row with a remove button; the preview follows", () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    addTeam("t-ts"); addTeam("t-rp");
    expect(screen.getAllByText("Team of this community")).toHaveLength(2);
    const pv = pvStart();
    expect(pv.textContent).toContain("2 teams · open-ended");
    expect(within(pv).getAllByRole("img")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove Royal Panthers" }));
    expect(screen.getAllByText("Team of this community")).toHaveLength(1);
    expect(pv.textContent).toContain("Choose at least 2 teams");
  });
  it("a team already in the series is not offered again; a match-only name is tagged", () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    addTeam("t-ts");
    fireEvent.click(screen.getAllByRole("button", { name: /^Add team \d$/ })[0]!);
    const options = within(screen.getByLabelText(/choose a team/i)).getAllByRole("option").map((o) => o.textContent);
    expect(options).not.toContain("Thunder Strikers");
    expect(options).toContain("Royal Panthers");
    fireEvent.change(screen.getByLabelText(/match-only name/i), { target: { value: "Walk-ins" } });
    fireEvent.click(screen.getByRole("button", { name: "Add team" }));
    expect(screen.getByText("Match-only team")).toBeTruthy();
  });
  it("best of: a stepper that cannot go outside 1 to 21, with the 'first to N wins' line", () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    fireEvent.click(screen.getByRole("radio", { name: "Best of a number" }));
    const box = screen.getByLabelText("Best of (1 to 21)") as HTMLInputElement;
    expect(box.value).toBe("3");
    expect(screen.getByText(/first to 2 wins/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "More matches" }));
    fireEvent.click(screen.getByRole("button", { name: "More matches" }));
    expect(box.value).toBe("5");
    expect(screen.getByText(/first to 3 wins/)).toBeTruthy();
    fireEvent.change(box, { target: { value: "21" } });
    expect((screen.getByRole("button", { name: "More matches" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: "1" } });
    expect((screen.getByRole("button", { name: "Fewer matches" }) as HTMLButtonElement).disabled).toBe(true);
    expect(pvStart().textContent).toContain("best of 1");
  });
  it("every validation message shows beside its field at once, and nothing is sent to the server", async () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    fireEvent.change(screen.getByLabelText("Series name"), { target: { value: "A" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Add team \d$/ })[0]!);
    fireEvent.change(screen.getByLabelText(/match-only name/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Add team" }));
    fireEvent.click(screen.getByRole("radio", { name: "Best of a number" }));
    fireEvent.change(screen.getByLabelText("Best of (1 to 21)"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Starts (optional)"), { target: { value: "2026-11-30" } });
    fireEvent.change(screen.getByLabelText("Ends (optional)"), { target: { value: "2026-11-01" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create series" })); });
    const text = document.body.textContent!;
    expect(text).toContain("Please fix the highlighted fields.");
    expect(text).toContain("Give the series a name (at least 2 letters).");
    expect(text).toContain("A team name needs at least 2 letters.");
    expect(text).toContain("Best of must be a whole number from 1 to 21.");
    expect(text).toContain("The end date cannot be before the start date.");
    expect(createSeriesF1Action).not.toHaveBeenCalled();
    // fixing the name clears its message and keeps everything else
    fireEvent.change(screen.getByLabelText("Series name"), { target: { value: "Winter Cup" } });
    expect(document.body.textContent).not.toContain("Give the series a name");
    expect(document.body.textContent).toContain("A team name needs at least 2 letters.");
  });
  it("fewer than two teams: 'Choose at least 2 teams.'", async () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    fireEvent.change(screen.getByLabelText("Series name"), { target: { value: "Winter Cup" } });
    addTeam("t-ts");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create series" })); });
    expect(document.body.textContent).toContain("Choose at least 2 teams.");
  });
  it("a valid form posts the same field names as before", async () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    fireEvent.change(screen.getByLabelText("Series name"), { target: { value: "Winter Cup 2026" } });
    addTeam("t-ts"); addTeam("t-rp");
    fireEvent.click(screen.getByRole("radio", { name: "Best of a number" }));
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Prize: a trophy" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create series" })); });
    expect(createSeriesF1Action).toHaveBeenCalledTimes(1);
    const fd = vi.mocked(createSeriesF1Action).mock.calls[0]![1] as FormData;
    expect(Object.fromEntries(Array.from(fd.entries()).map(([k, v]) => [k, String(v)]))).toMatchObject({
      communityId: "c1", name: "Winter Cup 2026", side0Team: "t-ts", side0Name: "", side1Team: "t-rp", side1Name: "", format: "best_of", bestOf: "3", notes: "Prize: a trophy", startsOn: "", endsOn: "",
    });
  });
  it("a typed match-only team is posted as a name with no team id", async () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    fireEvent.change(screen.getByLabelText("Series name"), { target: { value: "Street match" } });
    addTeam("t-ts");
    fireEvent.click(screen.getAllByRole("button", { name: /^Add team \d$/ })[0]!);
    fireEvent.change(screen.getByLabelText(/match-only name/i), { target: { value: "Walk-ins" } });
    fireEvent.keyDown(screen.getByLabelText(/match-only name/i), { key: "Enter" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create series" })); });
    const fd = vi.mocked(createSeriesF1Action).mock.calls[0]![1] as FormData;
    expect([fd.get("side1Team"), fd.get("side1Name")]).toEqual(["", "Walk-ins"]);
  });
  it("server error 'name already used': the message sits at the name, and nothing typed is lost", async () => {
    vi.mocked(createSeriesF1Action).mockImplementation(async () => ({ fieldErrors: { name: "A series with this name already exists in this community." }, error: "Please fix the highlighted fields." }));
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    fireEvent.change(screen.getByLabelText("Series name"), { target: { value: "Winter Cup 2026" } });
    addTeam("t-ts"); addTeam("t-rp");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create series" })); });
    expect(document.body.textContent).toContain("A series with this name already exists in this community.");
    expect(document.body.textContent).toContain("Please fix the highlighted fields.");
    expect((screen.getByLabelText("Series name") as HTMLInputElement).value).toBe("Winter Cup 2026");
    expect(screen.getAllByText("Team of this community")).toHaveLength(2);
    expect(screen.getByLabelText("Series name").getAttribute("aria-invalid")).toBe("true");
  });
  it("saving: the button is disabled and reads 'Saving…' (no second tap)", async () => {
    let release: (v: object) => void = () => {};
    vi.mocked(createSeriesF1Action).mockImplementation(() => new Promise((r) => { release = r; }));
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    fireEvent.change(screen.getByLabelText("Series name"), { target: { value: "Winter Cup 2026" } });
    addTeam("t-ts"); addTeam("t-rp");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create series" })); });
    const b = screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    await act(async () => { release({}); });
  });
  it("Cancel goes back to the list", () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} />));
    expect(screen.getAllByRole("link", { name: "Cancel" })[0]!.getAttribute("href")).toBe("/c/c1/series");
  });
});

describe("New series: Group matches I have", () => {
  const open = () => render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} initialTab="group" />));
  const boxes = () => screen.getAllByRole("checkbox") as HTMLInputElement[];
  it("rows show both badges, the date and a state chip; the button counts what is ticked and is off at zero", () => {
    open();
    expect(screen.getByText("5 free matches")).toBeTruthy();
    const row = screen.getByLabelText("Select Thunder Strikers v Desert Falcons").closest("label")!;
    expect(within(row).getAllByRole("img")).toHaveLength(2);
    expect(row.textContent).toContain("Sat, 22 Nov, 8:00 pm");
    expect(row.textContent).toContain("Completed");
    const go = screen.getByRole("button", { name: "Group into a series" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(boxes()[0]!); fireEvent.click(boxes()[2]!);
    expect(screen.getByRole("button", { name: "Group into a series (2)" })).toBeTruthy();
  });
  it("the preview shows the badges of every team found in the ticked matches and the automatic name", () => {
    open();
    fireEvent.click(boxes()[0]!); // TS v DF
    const pv = pvGroup();
    expect(pv.textContent).toContain("Thunder Strikers v Desert Falcons");
    expect(pv.textContent).toContain("2 teams · 1 match");
    fireEvent.click(boxes()[2]!); // TS v BH: three teams
    expect(within(pv).getAllByRole("img")).toHaveLength(3);
    expect(pv.textContent).toContain("Series of 2 matches");
    expect(pv.textContent).toContain("3 teams · 2 matches");
    fireEvent.change(screen.getByLabelText("Series name (optional)"), { target: { value: "Autumn mix" } });
    expect(pv.textContent).toContain("Autumn mix");
  });
  it("posts the ticked matches and the optional name; the message from the server comes back above the list and the ticks stay", async () => {
    vi.mocked(groupMatchesF1Action).mockImplementation(async () => ({ error: "A match can be in only one series. One of the matches you chose is already in another series." }));
    open();
    fireEvent.click(boxes()[1]!); fireEvent.click(boxes()[3]!);
    fireEvent.change(screen.getByLabelText("Series name (optional)"), { target: { value: "Mix" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Group into a series (2)" })); });
    const fd = vi.mocked(groupMatchesF1Action).mock.calls[0]![1] as FormData;
    expect(fd.getAll("match")).toEqual(["g2", "g4"]);
    expect([fd.get("communityId"), fd.get("name")]).toEqual(["c1", "Mix"]);
    expect(screen.getByRole("alert").textContent).toContain("A match can be in only one series. One of the matches you chose is already in another series.");
    expect(boxes()[1]!.checked).toBe(true);
    expect(boxes()[3]!.checked).toBe(true);
    expect(screen.getByRole("button", { name: "Group into a series (2)" })).toBeTruthy();
  });
  it("a ticked match hidden by the status filter is still sent", async () => {
    open();
    fireEvent.click(boxes()[0]!); // completed
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "scheduled" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Group into a series (1)" })); });
    const fd = vi.mocked(groupMatchesF1Action).mock.calls[0]![1] as FormData;
    expect(fd.getAll("match")).toEqual(["g1"]);
  });
  it("an old-style address with ?e= still shows its message above the list", () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={free} initialTab="group" groupError="Choose at least one match." />));
    expect(screen.getByRole("alert").textContent).toContain("Choose at least one match.");
  });
  it("no free match: says why and offers New match", () => {
    render(wrap(<NewSeries communityId="c1" teams={teams} matches={[]} initialTab="group" />));
    expect(screen.getByText("No matches are free to group")).toBeTruthy();
    expect(document.body.textContent).toContain("Every match is already in a series or was cancelled or abandoned.");
    expect(screen.getByRole("link", { name: /New match/ }).getAttribute("href")).toBe("/c/c1/matches/new");
    expect((screen.getByRole("button", { name: "Group into a series" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Edit series", () => {
  const edit = (sides: { teamId: string | null; name: string; locked?: boolean }[], over: Partial<{ format: "open" | "best_of"; bestOf: number | null; name: string }> = {}) =>
    render(wrap(<SeriesForm mode="edit" communityId="c1" seriesId="s2" teams={teams} defaults={{ name: over.name ?? "Thunder v Panthers Rivalry", format: over.format ?? "best_of", bestOf: over.bestOf === undefined ? 3 : over.bestOf, startsOn: "2026-11-01", endsOn: "2026-11-30", notes: "Winner takes the trophy.", sides }} />));
  const locked2 = [{ teamId: "t-rp", name: "Royal Panthers", locked: true }, { teamId: "t-ts", name: "Thunder Strikers", locked: true }];

  it("starts filled in; teams with matches show LOCKED and no remove button; the rule is written out", () => {
    edit(locked2);
    expect((screen.getByLabelText("Series name") as HTMLInputElement).value).toBe("Thunder v Panthers Rivalry");
    expect(screen.getAllByText("Locked")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
    expect(screen.getAllByText(/^Team of this community · has matches in this series/)).toHaveLength(2);
    expect(document.body.textContent).toContain("A team that already has matches in this series cannot be taken out");
    expect(document.body.textContent).toContain("Changing the format never changes the record.");
    expect((screen.getByLabelText("Best of (1 to 21)") as HTMLInputElement).value).toBe("3");
    expect(screen.getByText(/first to 2 wins/)).toBeTruthy();
    expect((screen.getByLabelText("Notes (optional)") as HTMLTextAreaElement).value).toBe("Winner takes the trophy.");
    expect(screen.getByText("26/60")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
  });
  it("a team without matches can still be removed; a locked one never", () => {
    edit([...locked2, { teamId: "t-df", name: "Desert Falcons", locked: false }]);
    expect(screen.getAllByText("Locked")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Remove Desert Falcons" })).toBeTruthy();
  });
  it("best of 3 to best of 5 is two taps", () => {
    edit(locked2);
    fireEvent.click(screen.getByRole("button", { name: "More matches" }));
    fireEvent.click(screen.getByRole("button", { name: "More matches" }));
    expect((screen.getByLabelText("Best of (1 to 21)") as HTMLInputElement).value).toBe("5");
    expect(screen.getByText(/first to 3 wins/)).toBeTruthy();
    expect(pvStart().textContent).toContain("2 teams · best of 5");
  });
  it("a tournament (open-ended, four teams, all locked): adding a fifth team is allowed", async () => {
    edit(four.map((s) => ({ teamId: s.teamId, name: s.name, locked: true })), { format: "open", bestOf: null, name: "Winter Cup 2026" });
    expect(screen.getAllByText("Locked")).toHaveLength(4);
    expect(screen.getByRole("radio", { name: "Open-ended" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getAllByRole("button", { name: /^Add team \d$/ })[0]!);
    fireEvent.change(screen.getByLabelText(/match-only name/i), { target: { value: "Walk-ins" } });
    fireEvent.click(screen.getByRole("button", { name: "Add team" }));
    expect(pvStart().textContent).toContain("5 teams · open-ended");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes" })); });
    const fd = vi.mocked(updateSeriesF1Action).mock.calls[0]![1] as FormData;
    expect([fd.get("seriesId"), fd.get("side4Team"), fd.get("side4Name"), fd.get("side0Team")]).toEqual(["s2", "", "Walk-ins", "t-ts"]);
  });
  it("server says a team with matches cannot be taken out: the reason shows at the team, which stays on screen", async () => {
    const reason = "Royal Panthers is not a team of this series. It already has matches in this series, so it cannot be taken out.";
    vi.mocked(updateSeriesF1Action).mockImplementation(async () => ({ fieldErrors: { sides: reason }, error: "Please fix the highlighted fields." }));
    edit(locked2);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes" })); });
    expect(document.body.textContent).toContain(reason);
    expect(document.body.textContent).toContain("Please fix the highlighted fields.");
    const rp = screen.getByText("Royal Panthers").closest(".sr-slot")!;
    expect(rp.className).toContain("bad");
    expect(screen.getAllByText("Locked")).toHaveLength(2);
  });
  it("Cancel goes back to the series page", () => {
    edit(locked2);
    expect(screen.getAllByRole("link", { name: "Cancel" })[0]!.getAttribute("href")).toBe("/c/c1/series/s2");
  });
  it("a series made by grouping matches with 7 teams keeps all of them in the form", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ teamId: null, name: `Team ${i + 1}x`, locked: true }));
    edit(seven, { format: "open", bestOf: null });
    expect(screen.getAllByText("Locked")).toHaveLength(7);
  });
});

/* ================================================================= Series page ================================================================= */
const row = (id: string, n1: string, n2: string, status: string, res: string | null, mine1 = false): SeriesRow => ({ id, href: `/c/c1/matches/${id}`, n1, n2, mine1, mine2: false, when: "Sat, 22 Nov, 8:00 pm", overs: 6, venue: "Clifton Arena", status, resultText: res, reportHref: status === "completed" ? `/c/c1/matches/${id}/report` : null });
function view(over: Partial<SeriesViewData> & { sides: Side[]; ms: SeriesMatch[]; format?: "open" | "best_of"; bestOf?: number | null; mine?: string[] }): SeriesViewData {
  const open = over.open ?? true;
  const t = tally(over.sides, over.ms);
  const bestOf = over.bestOf === undefined ? 3 : over.bestOf;
  const format = over.format ?? "best_of";
  const st = seriesStatus(format, bestOf, !open, t);
  const mine = over.mine ?? ["t-ts"];
  const sides = t.rows.map((r) => { const s = over.sides.find((x) => x.name === r.name)!; return { name: r.name, teamId: s.teamId, mine: mine.includes(s.teamId!) }; });
  const { sides: _s, ms, format: _f, bestOf: _b, mine: _m, ...rest } = over; void _s; void _f; void _b; void _m;
  return {
    id: "s2", name: "Thunder v Panthers Rivalry", open, matchCount: ms.length,
    hero: { open, sides, wins: t.rows.length === 2 ? [t.rows[0]!.won, t.rows[1]!.won] : null, counted: t.counted, format, bestOf, status: st, state: seriesState(open, st, t.counted), matchCount: ms.length, abandoned: 0, dates: null },
    latestId: ms.length ? "m1" : null, clinchedWinner: st.clinched ? st.winner : null, drawn: st.drawn,
    showTable: t.rows.length > 2 || t.counted > 0,
    table: pointsTable(t).map((r) => ({ name: r.name, mine: mine.includes(over.sides.find((x) => x.name === r.name)!.teamId!), played: r.played, won: r.won, lost: r.lost, tied: r.tied, points: r.points })),
    fixtures: [row("m3", "Thunder Strikers", "Royal Panthers", "scheduled", null, true)],
    results: [row("m2", "Royal Panthers", "Thunder Strikers", "completed", "Thunder Strikers won by 3 wickets"), row("m1", "Thunder Strikers", "Royal Panthers", "completed", "Royal Panthers won by 6 runs", true)],
    notes: "Winner takes the trophy at the end of the month.", createdBy: "Ali Raza", changedBy: "Ali Raza", changedAt: "Sat, 22 Nov, 9:10 pm", created: false, error: null, ...rest,
  };
}
const page = (d: SeriesViewData) => render(wrap(<SeriesView communityId="c1" d={d} />));
const hero = () => screen.getByLabelText("Series score");

describe("Series page", () => {
  it("best of 3, level 1–1, one match to play: both badges, the score, the status in words, progress marks, one big gold action", () => {
    page(view({ sides: [TS, RP], ms: [sm(TS, RP, 1), sm(RP, TS, 1), sm(TS, RP, 1, "win", "scheduled")] }));
    const h = hero();
    expect(within(h).getAllByRole("img")).toHaveLength(2);
    expect(within(h).getByLabelText("Series score 1 to 1")).toBeTruthy();
    expect(h.textContent).toContain("LEVEL");
    expect(h.textContent).toContain("Best of 3: level at 1–1");
    expect(h.textContent).toContain("In progress");
    expect(h.textContent).toContain("2 of 3 matches played");
    expect(h.querySelectorAll(".sr-marks span.on")).toHaveLength(2);
    expect(h.querySelectorAll(".sr-marks span")).toHaveLength(3);
    const play = screen.getByRole("link", { name: "Play another match in this series" });
    expect(play.className).toContain("gold");
    expect(play.getAttribute("href")).toBe("/c/c1/matches/m1/rematch");
  });
  it("Add matches and Edit series are secondary links", () => {
    page(view({ sides: [TS, RP], ms: [sm(TS, RP, 1)] }));
    expect(screen.getAllByRole("link", { name: /Add matches/ })[0]!.getAttribute("href")).toBe("/c/c1/series/s2/add");
    expect(screen.getByRole("link", { name: /Edit series/ }).getAttribute("href")).toBe("/c/c1/series/s2/edit");
  });
  it("not started: its own state, the real banner sentence, no points table, empty fixtures and results with clear actions", () => {
    page(view({ sides: [TS, RP], ms: [], fixtures: [], results: [], name: "Friday Showdown" }));
    expect(hero().textContent).toContain("Not started");
    expect(hero().textContent).toContain("no finished matches yet");
    expect(hero().textContent).toContain("0 of 3 matches played");
    expect(document.body.textContent).toContain("Add a match to the series, then you can play another one with one tap.");
    expect(screen.queryByLabelText("Points table")).toBeNull();
    expect(screen.queryByRole("link", { name: "Play another match in this series" })).toBeNull();
    expect(screen.getByText("Nothing to play right now")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Add or schedule a match/ }).getAttribute("href")).toBe("/c/c1/series/s2/add");
    expect(screen.getByText("No finished matches yet")).toBeTruthy();
  });
  it("clinched 2–0 but still open: gold hero, the real sentence, and a banner that offers to close the series", async () => {
    page(view({ sides: [DF, BH], ms: [sm(DF, BH, 1), sm(DF, BH, 1)], fixtures: [], mine: ["t-df"] }));
    expect(hero().className).toContain("won");
    expect(hero().textContent).toContain("Winner: Desert Falcons");
    expect(hero().textContent).toContain("Desert Falcons won the series 2–0 (best of 3). It is still open, so more matches can be played.");
    const banner = screen.getByText("Desert Falcons has clinched it").closest(".sr-callout")!;
    await act(async () => { fireEvent.click(within(banner as HTMLElement).getByRole("button", { name: "Close series" })); });
    const fd = vi.mocked(seriesStatusQuietAction).mock.calls[0]![0] as FormData;
    expect([fd.get("seriesId"), fd.get("to")]).toEqual(["s2", "closed"]);
  });
  it("closed and level: Drawn in words, a LEVEL label, a banner that says there is no tie-break and no manual winner, and Reopen", async () => {
    page(view({ sides: [TS, DF], ms: [sm(TS, DF, 1), sm(DF, TS, 1), sm(TS, DF, null, "tie")], open: false, fixtures: [], name: "Autumn Decider" }));
    expect(hero().textContent).toContain("Drawn 1–1 (1 tied)");
    expect(hero().textContent).toContain("LEVEL");
    expect(hero().textContent).toContain("Closed");
    expect(hero().className).not.toContain("won");
    const banner = screen.getByText("A drawn series stays drawn").closest(".sr-callout")!;
    expect(banner.textContent).toContain("There is no tie-break and no manual winner.");
    expect(screen.queryByText(/clinched/)).toBeNull();
    await act(async () => { fireEvent.click(within(banner as HTMLElement).getByRole("button", { name: "Reopen" })); });
    expect((vi.mocked(seriesStatusQuietAction).mock.calls[0]![0] as FormData).get("to")).toBe("open");
    expect(screen.queryByRole("link", { name: "Play another match in this series" })).toBeNull();
  });
  it("best of 5 won 3–1 and closed: winner hero, 'Reopen the series' instead of Close, four results", () => {
    page(view({ sides: [RP, BH], ms: [sm(RP, BH, 1), sm(BH, RP, 1), sm(RP, BH, 1), sm(RP, BH, 1)], open: false, bestOf: 5, fixtures: [], mine: [] }));
    expect(hero().className).toContain("won");
    expect(hero().textContent).toContain("Royal Panthers won the series 3–1 (best of 5)");
    expect(hero().textContent).toContain("4 of 5 matches played");
    expect(hero().querySelectorAll(".sr-marks span.on")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Reopen the series" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Close the series" })).toBeNull();
    expect(screen.queryByText(/clinched/)).toBeNull();
  });
  it("four-team tournament: badge stack, points table with rank, badges and bold points; two teams level on points share the rank; your team is ringed", () => {
    page(view({ sides: four, ms: [sm(TS, DF, 1), sm(TS, RP, 2, "tie"), sm(RP, BH, 1), sm(DF, BH, 1)], format: "open", bestOf: null }));
    expect(hero().textContent).toContain("level");
    expect(hero().textContent).toContain("4 teams · 4 matches");
    expect(within(hero()).getAllByRole("img")).toHaveLength(4);
    const table = screen.getAllByLabelText("Points table")[0]!;
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    const cell = (r: HTMLElement, i: number) => r.querySelectorAll("td")[i]!.textContent;
    // win 2 points, tie 1 each: Royal Panthers 3 (1 win 1 tie... ), Thunder Strikers 3 — the two on equal points and wins share a rank
    const byName = Object.fromEntries(rows.map((r) => [r.querySelector("b")!.textContent!, r]));
    expect(cell(byName["Royal Panthers"]!, 6)).toBe("3");
    expect(cell(byName["Thunder Strikers"]!, 6)).toBe("3");
    expect(cell(byName["Royal Panthers"]!, 0)).toBe(cell(byName["Thunder Strikers"]!, 0));
    expect(byName["Thunder Strikers"]!.className).toContain("me");
    expect(byName["Royal Panthers"]!.className).not.toContain("me");
    expect(byName["Thunder Strikers"]!.querySelector(".sr-mine")).toBeTruthy();
    expect(table.closest("section")!.textContent).toContain("A win is 2 points, a tie or no result 1 point each. A level series is shown as drawn: the app never forces a winner.");
  });
  it("the points table is hidden for a two-team series until a match is counted", () => {
    page(view({ sides: [TS, RP], ms: [sm(TS, RP, 1, "win", "scheduled")], fixtures: [], results: [] }));
    expect(screen.queryAllByLabelText("Points table")).toHaveLength(0);
  });
  it("after creating: a banner with the next step; with an error: a red banner with the same wording", () => {
    page(view({ sides: [TS, RP], ms: [sm(TS, RP, 1)], created: true }));
    expect(screen.getByText("Series created.").closest(".banner")!.textContent).toContain("Add matches, or play the first one.");
    cleanup();
    page(view({ sides: [TS, RP], ms: [sm(TS, RP, 1)], error: "That cannot be done in the series' current state." }));
    expect(screen.getByRole("alert").textContent).toContain("That cannot be done in the series' current state.");
  });
  it("the side column (points table, leaderboard link, notes, close, delete, added by) exists once for the panel and once below the results", () => {
    page(view({ sides: [TS, RP], ms: [sm(TS, RP, 1), sm(RP, TS, 1)] }));
    expect(screen.getAllByRole("link", { name: /Series leaderboard/ })[0]!.getAttribute("href")).toBe("/c/c1/leaderboard?series=s2");
    expect(document.body.textContent).toContain("Winner takes the trophy at the end of the month.");
    expect(document.body.textContent).toContain("Added by Ali Raza · Changed by Ali Raza (Sat, 22 Nov, 9:10 pm)");
    expect(document.body.textContent).toContain("Finished with this series?");
    expect(document.body.textContent).toContain("Closing keeps the record. You can reopen it any time and keep playing.");
    cleanup();
    render(wrap(<div className="sr-panel"><SeriesSide communityId="c1" d={view({ sides: [TS, RP], ms: [sm(TS, RP, 1)] })} /></div>));
    expect(screen.getByText("Delete series")).toBeTruthy();
  });
  it("Delete series asks for the whole name and says the matches are kept", async () => {
    page(view({ sides: [TS, RP], ms: [sm(TS, RP, 1), sm(RP, TS, 1)] }));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete series…" })[0]!);
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("Delete Thunder v Panthers Rivalry?");
    expect(dlg.textContent).toContain("Deletes the series only. Every match in it (2) is kept, with all its stats.");
    expect((within(dlg).getByRole("button", { name: "Delete series" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dlg).getByRole("textbox"), { target: { value: "Thunder v Panthers Rivalry" } });
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Delete series" })); });
    expect(deleteSeriesAction).toHaveBeenCalledTimes(1);
  });
});

describe("Fixtures and results rows", () => {
  const fx = [row("m3", "Thunder Strikers", "Royal Panthers", "scheduled", null, true)];
  const rs = [row("m2", "Royal Panthers", "Thunder Strikers", "completed", "Thunder Strikers won by 3 wickets"), row("m1", "Thunder Strikers", "Royal Panthers", "completed", "Royal Panthers won by 6 runs", true)];
  it("each row has both badges, the state chip, the result sentence and a menu; a finished match opens its report", () => {
    render(wrap(<SeriesMatches communityId="c1" seriesId="s2" fixtures={fx} results={rs} />));
    expect(screen.getByRole("heading", { name: /Fixtures/ }).textContent).toContain("1");
    expect(screen.getByRole("heading", { name: /Results/ }).textContent).toContain("2");
    const first = screen.getAllByRole("article")[1]!;
    expect(within(first).getAllByRole("img")).toHaveLength(2);
    expect(first.textContent).toContain("Thunder Strikers won by 3 wickets");
    expect(first.textContent).toContain("Completed");
    expect(within(first).getByRole("link", { name: "Royal Panthers v Thunder Strikers" }).getAttribute("href")).toBe("/c/c1/matches/m2/report");
    const sched = screen.getAllByRole("article")[0]!;
    expect(within(sched).getByRole("link").getAttribute("href")).toBe("/c/c1/matches/m3");
    expect(sched.textContent).toContain("Scheduled");
  });
  it("the menu has Remove from series, and no inline 'Yes, remove' form is left", () => {
    render(wrap(<SeriesMatches communityId="c1" seriesId="s2" fixtures={fx} results={rs} />));
    fireEvent.click(screen.getAllByRole("button", { name: "Actions for Thunder Strikers v Royal Panthers" })[0]!);
    expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Remove from series" })).toBeTruthy();
    expect(screen.queryByText("Yes, remove")).toBeNull();
  });
  it("Remove hides the row at once and offers Undo; nothing is removed until the wait is over; Undo brings the row back and removes nothing", async () => {
    vi.useFakeTimers();
    render(wrap(<SeriesMatches communityId="c1" seriesId="s2" fixtures={fx} results={rs} />));
    fireEvent.click(screen.getAllByRole("button", { name: "Actions for Thunder Strikers v Royal Panthers" })[0]!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove from series" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("Match removed from the series. The match itself is kept.")).toBeTruthy();
    expect(removeMatchQuietAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(removeMatchQuietAction).not.toHaveBeenCalled();
  });
  it("without Undo the match is removed from the series after the wait (the match itself is kept by the server)", async () => {
    vi.useFakeTimers();
    render(wrap(<SeriesMatches communityId="c1" seriesId="s2" fixtures={fx} results={rs} />));
    fireEvent.click(screen.getByRole("button", { name: "Actions for Royal Panthers v Thunder Strikers" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove from series" }));
    await act(async () => { vi.advanceTimersByTime(7000); });
    expect(removeMatchQuietAction).toHaveBeenCalledTimes(1);
    const fd = vi.mocked(removeMatchQuietAction).mock.calls[0]![0] as FormData;
    expect([fd.get("communityId"), fd.get("seriesId"), fd.get("matchId")]).toEqual(["c1", "s2", "m2"]);
    expect(refresh).toHaveBeenCalled();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
  it("if the server refuses, the row comes back with the message", async () => {
    vi.useFakeTimers();
    vi.mocked(removeMatchQuietAction).mockImplementationOnce(async () => ({ ok: false, error: "That match is not in this series." }));
    render(wrap(<SeriesMatches communityId="c1" seriesId="s2" fixtures={fx} results={rs} />));
    fireEvent.click(screen.getByRole("button", { name: "Actions for Royal Panthers v Thunder Strikers" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove from series" }));
    await act(async () => { vi.advanceTimersByTime(7000); });
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("That match is not in this series.")).toBeTruthy();
  });
});

describe("messages after an action", () => {
  it("added, saved, removed and closed are said once as a snackbar", () => {
    render(wrap(<SeriesToast added="2" open />));
    expect(screen.getByText("2 matches added.")).toBeTruthy();
    cleanup();
    render(wrap(<SeriesToast saved="1" open />));
    expect(screen.getByText("Saved.")).toBeTruthy();
    cleanup();
    render(wrap(<SeriesToast status="1" open={false} />));
    expect(screen.getByText("Series closed. Its record is kept.")).toBeTruthy();
  });
});

/* ================================================================= Add matches ================================================================= */
const series = { id: "s2", name: "Thunder v Panthers Rivalry", open: true, matchCount: 3, sides: [{ name: "Royal Panthers", mine: false }, { name: "Thunder Strikers", mine: true }] };
const avail: AvailItem[] = [
  { id: "a1", side1: "Thunder Strikers", team1: "t-ts", side2: "Royal Panthers", team2: "t-rp", when: "Sat, 29 Nov, 8:00 pm", status: "scheduled", fits: true, reason: null },
  { id: "a2", side1: "Royal Panthers", team1: "t-rp", side2: "Thunder Strikers", team2: "t-ts", when: "Sat, 6 Dec, 8:00 pm", status: "draft", fits: true, reason: null },
  { id: "a3", side1: "Thunder Strikers", team1: "t-ts", side2: "Royal Panthers", team2: "t-rp", when: "Sat, 1 Nov, 8:00 pm", status: "completed", fits: true, reason: null },
  { id: "a4", side1: "Desert Falcons", team1: "t-df", side2: "Royal Panthers", team2: "t-rp", when: "Fri, 14 Nov, 8:00 pm", status: "completed", fits: false, reason: "Desert Falcons is not a team of this series. Add the team to the series first." },
  { id: "a5", side1: "Desert Falcons", team1: "t-df", side2: "Blue Hawks", team2: "t-bh", when: "Sat, 8 Nov, 8:00 pm", status: "completed", fits: false, reason: "Desert Falcons and Blue Hawks are not a team of this series. Add the team to the series first." },
];

describe("Add matches to a series", () => {
  it("open series: three fit and two do not; rows have both badges, the date and a state chip; the others show a lock, the real reason and a link to fix it", () => {
    render(wrap(<AddMatches communityId="c1" series={series} items={avail} />));
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getAllByLabelText("Select Thunder Strikers v Royal Panthers")).toHaveLength(2);
    const label = screen.getAllByText("Scheduled")[0]!.closest("label")!;
    expect(within(label).getAllByRole("img")).toHaveLength(2);
    expect(label.textContent).toContain("Sat, 29 Nov, 8:00 pm");
    const reason = screen.getByText("Desert Falcons is not a team of this series. Add the team to the series first.");
    expect(reason.closest(".sr-pick")!.className).toContain("locked");
    const fix = within(reason.closest(".sr-pick") as HTMLElement).getByRole("link", { name: "Add the team to the series" });
    expect(fix.getAttribute("href")).toBe("/c/c1/series/s2/edit");
    expect(document.body.textContent).toContain("Both teams must be teams of this series (Royal Panthers, Thunder Strikers). A match can be in one series only.");
  });
  it("All / Can be added / Cannot be added with counts", () => {
    render(wrap(<AddMatches communityId="c1" series={series} items={avail} />));
    const bar = screen.getByRole("group", { name: "Show matches" });
    expect(bar.textContent).toContain("All 5");
    expect(bar.textContent).toContain("Can be added 3");
    expect(bar.textContent).toContain("Cannot be added 2");
    fireEvent.click(within(bar).getByRole("button", { name: /Cannot be added/ }));
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Add the team to the series" })).toHaveLength(2);
    fireEvent.click(within(bar).getByRole("button", { name: /Can be added/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });
  it("the button is off until something is ticked, then counts: 'Add to the series (2)'; the summary shows In the series and Selected", async () => {
    render(wrap(<AddMatches communityId="c1" series={series} items={avail} />));
    expect((screen.getByRole("button", { name: "Add to the series" }) as HTMLButtonElement).disabled).toBe(true);
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]!); fireEvent.click(boxes[2]!);
    const go = screen.getByRole("button", { name: "Add to the series (2)" }) as HTMLButtonElement;
    expect(go.disabled).toBe(false);
    const sum = screen.getByLabelText("This series");
    expect(sum.textContent).toContain("3In the series");
    expect(sum.textContent).toContain("2Selected");
    await act(async () => { fireEvent.click(go); });
    const fd = vi.mocked(addMatchesF1Action).mock.calls[0]![1] as FormData;
    expect(fd.getAll("match")).toEqual(["a1", "a3"]);
    expect([fd.get("communityId"), fd.get("seriesId")]).toEqual(["c1", "s2"]);
  });
  it("a server error shows above the list and the ticked matches stay ticked", async () => {
    vi.mocked(addMatchesF1Action).mockImplementation(async () => ({ error: "A match can be in only one series. One of these is already in another series." }));
    render(wrap(<AddMatches communityId="c1" series={series} items={avail} />));
    fireEvent.click(screen.getAllByRole("checkbox")[1]!);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Add to the series (1)" })); });
    expect(screen.getByRole("alert").textContent).toContain("A match can be in only one series. One of these is already in another series.");
    expect((screen.getAllByRole("checkbox")[1] as HTMLInputElement).checked).toBe(true);
  });
  it("a ticked match hidden by a filter is still sent", async () => {
    render(wrap(<AddMatches communityId="c1" series={series} items={avail} />));
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Cannot be added/ }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Add to the series (1)" })); });
    expect((vi.mocked(addMatchesF1Action).mock.calls[0]![1] as FormData).getAll("match")).toEqual(["a1"]);
  });
  it("closed series: the real sentence, a Reopen button right here, and the add button stays off", async () => {
    render(wrap(<AddMatches communityId="c1" series={{ ...series, open: false, name: "Autumn Decider" }} items={avail} />));
    expect(document.body.textContent).toContain("This series is closed. Reopen it to add matches.");
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    expect((screen.getByRole("button", { name: "Add to the series (1)" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reopen" })); });
    const fd = vi.mocked(seriesStatusQuietAction).mock.calls[0]![0] as FormData;
    expect([fd.get("seriesId"), fd.get("to")]).toEqual(["s2", "open"]);
    expect(screen.getByText("Series reopened.")).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });
  it("no free matches: next steps instead of one grey sentence", () => {
    render(wrap(<AddMatches communityId="c1" series={series} items={[]} />));
    expect(screen.getByText("No free matches")).toBeTruthy();
    expect(document.body.textContent).toContain("Create a match first, or use “Play another match in this series” on the series page.");
    expect(screen.getByRole("link", { name: /New match/ }).getAttribute("href")).toBe("/c/c1/matches/new");
    expect(screen.getByRole("link", { name: "Back to series" }).getAttribute("href")).toBe("/c/c1/series/s2");
    expect((screen.getByRole("button", { name: "Add to the series" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("an old-style address with ?e= shows its message above the list", () => {
    render(wrap(<AddMatches communityId="c1" series={series} items={avail} initialError="Choose at least one match." />));
    expect(screen.getByRole("alert").textContent).toContain("Choose at least one match.");
  });
});
