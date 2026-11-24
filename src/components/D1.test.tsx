// @vitest-environment jsdom
// Phase D (UI redesign), Builder D1: Match details and the toss card.
// The page itself needs the database and a signed-in member, so its parts are tested here with plain data: the hero, the score bug,
// "Are you coming?", the lineups with the link sheet, the toss, the banners, the primary button and the manage actions.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/matches", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const h = vi.hoisted(() => ({
  toss: vi.fn<(prev: unknown, fd: FormData) => Promise<{ error?: string }>>(async () => ({})),
  link: vi.fn(), unlink: vi.fn(), cancel: vi.fn(), postpone: vi.fn(), del: vi.fn(), avail: vi.fn(), remind: vi.fn(),
  flip: vi.fn<() => "heads" | "tails">(() => "heads"),
}));
vi.mock("@/app/actions4", () => ({
  tossAction: (p: unknown, fd: FormData) => h.toss(p, fd),
  linkGuestAction: h.link, unlinkGuestAction: h.unlink, cancelAction: h.cancel, postponeAction: h.postpone, deleteMatchAction: h.del,
  setAvailabilityAction: h.avail, remindAction: h.remind,
}));
vi.mock("@/lib/coin", async (orig) => ({ ...(await orig<typeof import("@/lib/coin")>()), flipCoin: () => h.flip() }));

import MatchBug, { creaseLine } from "@/components/MatchBug";
import MatchHero, { type HeroMatch } from "@/components/MatchHero";
import MatchToss from "@/components/MatchToss";
import MdAvailability, { type ReplyPerson } from "@/components/MdAvailability";
import MdLineups, { type LineupSide, type Linkable } from "@/components/MdLineups";
import { MdLinkCard, MdManageCard, MdPrimary, MdRules, MdStatusNotice, MdTopNotices } from "@/components/MdParts";
import MdSide, { MD_PANEL, MdPanelSlot } from "@/components/MdSide";
import MdTopRight from "@/components/MdTopRight";
import { SnackbarProvider } from "@/components/Snackbar";
import { buildState } from "@/lib/engine/engine";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import { DEFAULT_RULES } from "@/lib/matchRules";
import {
  afterActionLink, battingFirstOf, createdBanners, lineupGap, pickedPercent, pickedText, primaryAction, replyBar, statusBadge, tossProblem, tossStep, tossSummary,
} from "@/lib/md";

beforeEach(() => { h.toss.mockReset(); h.toss.mockImplementation(async () => ({})); h.flip.mockReset(); h.flip.mockImplementation(() => "heads"); });
afterEach(() => { cleanup(); vi.useRealTimers(); delete (window as { matchMedia?: unknown }).matchMedia; });

const BASE = "/c/c1/matches/m1";

/* ---------------- plain rules ---------------- */
describe("rules behind the page (lib/md.ts)", () => {
  it("every status has a badge; live is red, paused orange, abandoned red (not green), completed green", () => {
    expect(statusBadge("live")).toEqual({ label: "Live", tone: "red" });
    expect(statusBadge("paused").tone).toBe("orange");
    expect(statusBadge("abandoned").tone).toBe("red");
    expect(statusBadge("completed").tone).toBe("green");
    for (const s of ["draft", "scheduled", "live", "paused", "completed", "postponed", "cancelled", "abandoned"] as const) expect(statusBadge(s).label.length).toBeGreaterThan(2);
  });
  it("one primary action per status, with the same wording as before", () => {
    const o = { iHoldTheLock: false, scorerName: null };
    expect(primaryAction(BASE, "scheduled", o)).toMatchObject({ kind: "score", label: "Start scoring", href: `${BASE}/score` });
    expect(primaryAction(BASE, "draft", o)?.label).toBe("Start scoring");
    expect(primaryAction(BASE, "live", { iHoldTheLock: false, scorerName: "Usman Tariq" })).toMatchObject({ kind: "watch", label: "Watch live or take over", hint: "Scoring now: Usman Tariq" });
    expect(primaryAction(BASE, "paused", { iHoldTheLock: true, scorerName: "Me" })).toMatchObject({ kind: "pad", label: "Open the scoring pad" });
    expect(primaryAction(BASE, "completed", o)).toMatchObject({ kind: "report", label: "Match report", href: `${BASE}/report` });
    expect(primaryAction(BASE, "abandoned", o)?.kind).toBe("report");
    expect(primaryAction(BASE, "cancelled", o)).toBeNull();
    expect(primaryAction(BASE, "postponed", o)).toBeNull();
  });
  it("lineup gap: only a draft or scheduled match with a side under 2 players", () => {
    expect(lineupGap("scheduled", [1, 6])).toMatch(/at least 2 players/);
    expect(lineupGap("draft", [0, 0])).toMatch(/at least 2 players/);
    expect(lineupGap("scheduled", [2, 2])).toBeNull();
    expect(lineupGap("postponed", [0, 0])).toBeNull();
    expect(lineupGap("live", [0, 0])).toBeNull();
  });
  it("progress and the reply bar", () => {
    expect(pickedText(4, 6)).toBe("4 of 6 picked");
    expect(pickedPercent(3, 6)).toBe(50);
    expect(pickedPercent(9, 6)).toBe(100);
    expect(pickedPercent(0, 0)).toBe(0);
    expect(replyBar(9, 3, 12)).toEqual({ inPct: 38, outPct: 13, nonePct: 49 });
    expect(replyBar(0, 0, 0)).toEqual({ inPct: 0, outPct: 0, nonePct: 100 });
  });
  it("green lines after create, edit and rematch, and the series notes", () => {
    expect(createdBanners({ created: "1" }, BASE, true)[0]).toMatchObject({ tone: "green", text: "Match created. Everyone in the community was told and can reply." });
    expect(createdBanners({ saved: "1" }, BASE, true)[0]!.text).toBe("Changes saved.");
    const r = createdBanners({ rematch: "1", series: "s1" }, BASE, true);
    expect(r[0]!.text).toBe("Rematch created. Lineups were copied: change them below if you need to. It is part of the series.");
    expect(r[0]!.links.map((l) => l.label)).toEqual(["Review lineups", "Edit"]);
    expect(createdBanners({ rematch: "1" }, BASE, true)[0]!.text).not.toContain("series");
    const n = createdBanners({ rematch: "1", seriesnote: "1" }, BASE, true);
    expect(n).toHaveLength(2);
    expect(n[1]).toMatchObject({ tone: "mute" });
    expect(createdBanners({}, BASE, true)).toEqual([]);
  });
  it("after postpone or cancel the page offers the Matches list", () => {
    expect(afterActionLink("postponed", "c1")).toEqual({ href: "/c/c1/matches", label: "View in Matches" });
    expect(afterActionLink("cancelled", "c1")?.href).toBe("/c/c1/matches");
    expect(afterActionLink("reminded", "c1")).toBeNull();
  });
  it("toss summary, who bats first, and the server messages mapped to fields", () => {
    expect(tossSummary({ winner: 2, decision: "bowl", battingFirst: 1 }, ["Desert Falcons", "Blue Hawks"])).toEqual({ line: "Blue Hawks won the toss and chose to bowl.", batting: "Desert Falcons bats first.", battingSide: 1 });
    expect(tossSummary({ winner: null, decision: null, battingFirst: null }, ["A", "B"])).toBeNull();
    expect(battingFirstOf(1, "bat")).toBe(1);
    expect(battingFirstOf(1, "bowl")).toBe(2);
    expect(battingFirstOf(2, "bowl")).toBe(1);
    expect(tossProblem("Choose which team won the toss.")).toMatchObject({ field: "winner", locked: false });
    expect(tossProblem("Choose what the toss winner decided: bat or bowl.")).toMatchObject({ field: "decision" });
    expect(tossProblem("This match has already started, so the toss can no longer be changed here.")).toMatchObject({ locked: true });
    expect(tossProblem("That match could not be found.")).toMatchObject({ field: null, locked: false });
    expect(tossProblem(undefined)).toBeNull();
    expect(tossStep({ call: false, phase: "ready" })).toBe(0);
    expect(tossStep({ call: true, phase: "ready" })).toBe(2);
    expect(tossStep({ call: true, phase: "flipping" })).toBe(2);
    expect(tossStep({ call: true, phase: "result" })).toBe(3);
  });
});

/* ---------------- hero ---------------- */
const hero = (over: Partial<HeroMatch> = {}): HeroMatch => ({
  status: "scheduled", scheduled_at: new Date("2026-11-28T15:00:00Z"), venue: "Clifton Indoor Arena", overs: 8, players_per_side: 6, umpire: "Mr. Anwar", notes: "Bring your own bat.",
  side1_name: "Desert Falcons", side2_name: "Blue Hawks", created_by_name: "Ali Raza", changed_by_name: "Hamza Khan", updated_at: new Date("2026-11-24T13:12:00Z"), rematch_of: null, ...over,
});

describe("hero", () => {
  it("both teams get badges, the own team a gold ring and a label; four fact tiles; notes and who made it", () => {
    const html = renderToStaticMarkup(<MatchHero communityId="c1" matchId="m1" m={hero()} tz="Asia/Karachi" series={null} mine={[true, false]} />);
    expect(html).toContain('aria-label="Team Desert Falcons"');
    expect(html).toContain('aria-label="Team Blue Hawks"');
    expect(html).toContain("md-own");
    expect(html.match(/md-own/g)).toHaveLength(1);
    expect(html).toContain("Your team");
    expect(html).toContain("Sat 28 Nov, 8:00 pm");
    expect(html).toContain("Clifton Indoor Arena");
    expect(html).toContain("8 overs a side");
    expect(html).toContain("Players per side");
    expect(html).toContain("Mr. Anwar");
    expect(html).toContain("Bring your own bat.");
    expect(html).toContain("Created by");
    expect(html).toContain("Scheduled");
    expect(html).not.toContain("shirt");     // teams are badges, never shirts
  });
  it("a draft shows 'No date yet' with Set date, and 'Not set' for an empty venue; no umpire or notes tile when empty", () => {
    const html = renderToStaticMarkup(<MatchHero communityId="c1" matchId="m1" m={hero({ status: "draft", scheduled_at: null, venue: "", umpire: "", notes: "" })} tz="UTC" series={null} mine={[false, false]} />);
    expect(html).toContain("No date yet");
    expect(html).toContain(`${BASE}/edit`);
    expect(html).toContain("Set date");
    expect(html).toContain("Not set");
    expect(html).not.toContain("Umpire");
    expect(html).not.toContain("Notes");
    expect(html).not.toContain("Your team");
  });
  it("no Set date on a cancelled match without a date; series chip links to the series; rematch link", () => {
    expect(renderToStaticMarkup(<MatchHero communityId="c1" matchId="m1" m={hero({ status: "cancelled", scheduled_at: null })} tz="UTC" series={null} mine={[false, false]} />)).not.toContain("Set date");
    const html = renderToStaticMarkup(<MatchHero communityId="c1" matchId="m1" m={hero({ rematch_of: "m0" })} tz="UTC" series={{ id: "s1", name: "Winter Cup 2026" }} mine={[false, false]} />);
    expect(html).toContain("/c/c1/series/s1");
    expect(html).toContain("Winter Cup 2026");
    expect(html).toContain("/c/c1/matches/m0");
    expect(html).toContain("Rematch of an earlier match");
  });
});

/* ---------------- score bug ---------------- */
const A = (i: number) => `a${i}`;
const B = (i: number) => `b${i}`;
const players: PlayerEntry[] = [
  ...[1, 2].map((i) => ({ id: A(i), side: 1 as Side, name: `Alpha${i}`, number: i, kind: "member" as const, userId: `ua${i}` })),
  ...[1, 2].map((i) => ({ id: B(i), side: 2 as Side, name: `Bravo${i}`, number: i + 10, kind: "member" as const, userId: `ub${i}` })),
];
const ball = (r: number) => ({ type: "ball", payload: { runs: r } }) as ScoreEventBody;
const stateOf = (extra: ScoreEventBody[]) => {
  const bodies: ScoreEventBody[] = [
    { type: "match_start", payload: { sides: ["Thunder Strikers", "Royal Panthers"], overs: 1, playersPerSide: 2, rules: { ...DEFAULT_RULES, lastBatterAlone: false }, players, toss: null, battingFirst: 1 } },
    { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
    ...[1, 1, 1, 1, 1, 1].map(ball),
    ...extra,
  ];
  const built = buildState(bodies.map((b, i) => ({ ...b, id: `e${i}`, seq: i + 1 }) as ScoreEvent));
  if (!built.ok) throw new Error(built.error);
  return built.state;
};
const chaseStart = { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } } as ScoreEventBody;

describe("score bug: batters and bowler line on a live match (decided 2026-11-24)", () => {
  it("a live or paused match shows who is batting (striker starred) and who is bowling; a finished match does not", () => {
    const live = stateOf([chaseStart, ball(1)]);
    const html = renderToStaticMarkup(<MatchBug state={live} status="live" sub="1 overs" />);
    expect(html).toContain("md-crease");
    expect(html).toContain("Batting");
    expect(html).toContain("Bowling");
    expect(html).toContain("*");
    const c = creaseLine(live);
    expect(c).not.toBeNull();
    expect(c!.batting).toMatch(/\d+\*? \(\d+\)/);
    expect(c!.bowling).toMatch(/\d+-\d+ \(\d+\.\d+\)/);
    expect(renderToStaticMarkup(<MatchBug state={live} status="completed" sub="1 overs" />)).not.toContain("md-crease");
  });
  it("nothing is drawn before the match has started", () => {
    expect(creaseLine(stateOf([]))).toBeNull();
  });
});

describe("score bug", () => {
  it("live: red Live badge, both badges, the batting side marked, a chase line", () => {
    const html = renderToStaticMarkup(<MatchBug state={stateOf([chaseStart, ball(1)])} status="live" sub="1 overs · Clifton" />);
    expect(html).toContain("Live");
    expect(html).toContain("md-dot");
    expect(html).toContain('aria-label="Team Thunder Strikers"');
    expect(html).toContain('aria-label="Team Royal Panthers"');
    expect(html).toContain("6/0");
    expect(html).toContain("Royal Panthers need 6 from 5 balls");
    expect(html).toContain("batting");
    expect(html).toContain("Innings 2");
  });
  it("finished: the winner is marked and the result line shows", () => {
    const state = stateOf([chaseStart, ...[2, 2, 2, 2].map(ball), { type: "match_end", payload: { kind: "result", winner: 2 } } as ScoreEventBody]);
    expect(state.result?.kind).toBe("win");
    const html = renderToStaticMarkup(<MatchBug state={state} status="completed" sub="1 overs" />);
    expect(html).toContain("Completed");
    expect(html).toContain("(winner)");
    expect(html).toContain(state.result!.text);
    expect(html).not.toContain("md-dot");
  });
  it("abandoned: a red badge and a neutral line, never the green result style; the partial score stays", () => {
    const state = stateOf([{ type: "match_end", payload: { kind: "abandoned" } } as ScoreEventBody]);
    const html = renderToStaticMarkup(<MatchBug state={state} status="abandoned" sub="1 overs" />);
    expect(html).toContain("md-badge red");
    expect(html).toContain("Match abandoned");
    expect(html).toContain('class="md-result neutral"');
    expect(html).not.toContain("(winner)");
    expect(html).toContain("6/0");
  });
  it("paused: orange badge and 'Match paused'", () => {
    const html = renderToStaticMarkup(<MatchBug state={stateOf([])} status="paused" sub="1 overs" />);
    expect(html).toContain("md-badge orange");
    expect(html).toContain("Match paused");
  });
});

/* ---------------- are you coming ---------------- */
const names = ["Shahzaib Khan", "Adnan Siddiqui", "Kamran Baig", "Rizwan Aslam", "Yasir Farooq", "Imran Javed", "Fahad Nasir", "Salman Butt"];
const replies: ReplyPerson[] = names.map((n, i) => ({ id: `u${i}`, name: n, number: i + 3, answer: i < 4 ? "in" : i < 6 ? "out" : null }));

describe("Are you coming?", () => {
  it("a counts bar, two reply buttons that post to the existing action, and the guidance sentence", () => {
    const { container } = render(<MdAvailability communityId="c1" matchId="m1" mine={null} replies={replies} remindCount={0} />);
    expect(screen.getByRole("img", { name: "4 in, 2 can’t, 2 no reply" })).toBeTruthy();
    const form = container.querySelector("form")!;
    expect((form.querySelector('[name="communityId"]') as HTMLInputElement).value).toBe("c1");
    expect((form.querySelector('[name="matchId"]') as HTMLInputElement).value).toBe("m1");
    expect(within(form).getByRole("button", { name: /I’m in/ }).getAttribute("value")).toBe("in");
    expect(within(form).getByRole("button", { name: /Can’t make it/ }).getAttribute("value")).toBe("out");
    expect(screen.getByText(/Replies are only guidance: the lineup can include anyone, even on match day/)).toBeTruthy();
  });
  it("my reply is solid and pressed; the other button stays neutral", () => {
    render(<MdAvailability communityId="c1" matchId="m1" mine="in" replies={replies} remindCount={0} />);
    const yes = screen.getByRole("button", { name: /I’m in/ });
    expect(yes.getAttribute("aria-pressed")).toBe("true");
    expect(yes.className).toContain("on-in");
    expect(screen.getByRole("button", { name: /Can’t make it/ }).getAttribute("aria-pressed")).toBe("false");
  });
  it("tabs list who answered each way (the same names the page showed before), each with a gold shirt", () => {
    const { container } = render(<MdAvailability communityId="c1" matchId="m1" mine={null} replies={replies} remindCount={0} />);
    expect(screen.getByRole("tab", { name: "In 4" }).getAttribute("aria-selected")).toBe("true");
    expect(within(screen.getByRole("tabpanel")).getByText("Shahzaib Khan")).toBeTruthy();
    expect(container.querySelectorAll(".md-chip svg.shirt")).toHaveLength(4);
    fireEvent.click(screen.getByRole("tab", { name: "Can’t 2" }));
    expect(within(screen.getByRole("tabpanel")).getByText("Yasir Farooq")).toBeTruthy();
    expect(within(screen.getByRole("tabpanel")).queryByText("Shahzaib Khan")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "No reply 2" }));
    expect(within(screen.getByRole("tabpanel")).getByText("Salman Butt")).toBeTruthy();
  });
  it("arrow keys move between the tabs", () => {
    render(<MdAvailability communityId="c1" matchId="m1" mine={null} replies={replies} remindCount={0} />);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Can’t 2" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "No reply 2" }).getAttribute("aria-selected")).toBe("true");
  });
  it("an empty tab says nobody", () => {
    render(<MdAvailability communityId="c1" matchId="m1" mine={null} replies={replies.map((r) => ({ ...r, answer: "in" as const }))} remindCount={0} />);
    fireEvent.click(screen.getByRole("tab", { name: "Can’t 0" }));
    expect(screen.getByText("nobody")).toBeTruthy();
  });
  it("Remind is offered only when asked for (scheduled and somebody has not replied)", () => {
    const { container, rerender } = render(<MdAvailability communityId="c1" matchId="m1" mine={null} replies={replies} remindCount={0} />);
    expect(screen.queryByRole("button", { name: /Remind/ })).toBeNull();
    rerender(<MdAvailability communityId="c1" matchId="m1" mine={null} replies={replies} remindCount={12} />);
    expect(screen.getByRole("button", { name: /Remind the 12 who have not replied/ })).toBeTruthy();
    expect(container.querySelectorAll("form")).toHaveLength(2);
  });
});

/* ---------------- lineups ---------------- */
const side = (pos: 1 | 2, name: string, rows: LineupSide["rows"], mine = false): LineupSide => ({ pos, name, needed: 6, mine, rows });
const member = (i: number) => ({ id: `r${i}`, name: names[i]!, userId: `u${i}`, number: i + 3, kind: "member" as const, sub: "Batter" });
const guest = { id: "g1", name: "Adeel Rana", userId: null, number: null, kind: "guest" as const, sub: "Guest" };
const linked = { id: "g2", name: "Kashif Ali", userId: "u9", number: null, kind: "linked" as const, sub: "Guest · linked by Ali Raza" };
const linkable: Linkable[] = [
  { userId: "x1", name: "Arsalan Mir", number: 29, role: "Batter" }, { userId: "x2", name: "Moiz Abbasi", number: 16, role: "All-rounder" }, { userId: "x3", name: "Owais Qureshi", number: 27, role: "Bowler" },
];
const sides2 = (): [LineupSide, LineupSide] => [side(1, "Desert Falcons", [member(0), member(1)], true), side(2, "Blue Hawks", [member(2), guest, linked])];

describe("lineups", () => {
  it("one card per team with badge, 'x of 6 picked' and a progress bar; players are gold shirts, the guest a grey shirt with the name", () => {
    const { container } = render(<MdLineups communityId="c1" matchId="m1" canPick sides={sides2()} linkable={linkable} />);
    expect(screen.getByText("2 of 6 picked")).toBeTruthy();
    expect(screen.getByText("3 of 6 picked")).toBeTruthy();
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Team Desert Falcons" })).toBeTruthy();
    expect(container.querySelectorAll(".md-own")).toHaveLength(1);
    const guestShirts = screen.getAllByRole("img", { name: "Guest, no player number" });
    expect(guestShirts).toHaveLength(2);        // the guest and the linked guest have no player number of their own
    for (const g of guestShirts) expect(g.innerHTML).toContain("#8A97B5");
    expect(screen.getAllByText("Adeel Rana").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "Player number 5" }).innerHTML).toContain("#F5C84B");
    expect(screen.getAllByRole("link", { name: /Pick lineups/ })).toHaveLength(2);
  });
  it("members link to their player page; guests do not; no Pick lineups once the match started", () => {
    render(<MdLineups communityId="c1" matchId="m1" canPick={false} sides={sides2()} linkable={linkable} />);
    expect(screen.getByRole("link", { name: "Shahzaib Khan" }).getAttribute("href")).toBe("/c/c1/players/u0");
    expect(screen.queryByRole("link", { name: "Adeel Rana" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Pick lineups/ })).toBeNull();
  });
  it("an empty side says so", () => {
    render(<MdLineups communityId="c1" matchId="m1" canPick sides={[side(1, "A", []), side(2, "B", [])]} linkable={[]} />);
    expect(screen.getAllByText("No players picked yet.")).toHaveLength(2);
    expect(screen.getAllByText("0 of 6 picked")).toHaveLength(2);
  });
  it("a linked guest has Undo link (existing action fields); a plain guest has Link to member", () => {
    const { container } = render(<MdLineups communityId="c1" matchId="m1" canPick sides={sides2()} linkable={linkable} />);
    const undo = screen.getByRole("button", { name: /Undo link/ });
    const form = undo.closest("form")!;
    expect((form.querySelector('[name="entryId"]') as HTMLInputElement).value).toBe("g2");
    expect((form.querySelector('[name="matchId"]') as HTMLInputElement).value).toBe("m1");
    expect(screen.getByRole("button", { name: /Link to member/ })).toBeTruthy();
    expect(container.textContent).toContain("Guest · linked by Ali Raza");
  });
  it("the link sheet: search, choose, a confirm button that names the member, hidden fields for the existing action", () => {
    render(<MdLineups communityId="c1" matchId="m1" canPick sides={sides2()} linkable={linkable} />);
    fireEvent.click(screen.getByRole("button", { name: /Link to member/ }));
    const dlg = screen.getByRole("dialog", { name: "Link Adeel Rana to a member" });
    expect(within(dlg).getByText(/count toward the member’s career. You can undo the link/)).toBeTruthy();
    const confirm = within(dlg).getByRole("button", { name: "Choose a member" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(within(dlg).getAllByRole("radio")).toHaveLength(3);
    fireEvent.change(within(dlg).getByRole("searchbox"), { target: { value: "moiz" } });
    expect(within(dlg).getAllByRole("radio")).toHaveLength(1);
    fireEvent.click(within(dlg).getByRole("radio", { name: /Moiz Abbasi/ }));
    const go = within(dlg).getByRole("button", { name: "Link to Moiz Abbasi" }) as HTMLButtonElement;
    expect(go.disabled).toBe(false);
    const form = go.closest("form")!;
    expect((form.querySelector('[name="targetId"]') as HTMLInputElement).value).toBe("x2");
    expect((form.querySelector('[name="entryId"]') as HTMLInputElement).value).toBe("g1");
    expect((form.querySelector('[name="communityId"]') as HTMLInputElement).value).toBe("c1");
    fireEvent.change(within(dlg).getByRole("searchbox"), { target: { value: "zzz" } });
    expect(within(dlg).getByText("Nobody matches “zzz”.")).toBeTruthy();
  });
  it("Cancel and Escape close the sheet; nobody to link says so", () => {
    render(<MdLineups communityId="c1" matchId="m1" canPick sides={sides2()} linkable={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Link to member/ }));
    expect(screen.getByText(/Every member is already in this match/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Link to member/ }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

/* ---------------- toss ---------------- */
const toss = (over: Partial<React.ComponentProps<typeof MatchToss>> = {}) =>
  render(<MatchToss communityId="c1" matchId="m1" sides={["Desert Falcons", "Blue Hawks"]} winner={null} decision={null} battingFirst={null} canEdit mine={[true, false]} {...over} />);
const sel = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;
const submitForm = async (c: HTMLElement) => { await act(async () => { fireEvent.submit(c.querySelector("form")!); }); };

describe("toss card", () => {
  it("not recorded: a gold Toss the coin button, the manual form in its own card, the same hint about clearing", () => {
    const { container } = toss();
    expect(container.querySelector("#toss")).toBeTruthy();
    expect(screen.getByText("Not recorded")).toBeTruthy();
    expect(screen.getByText("Not recorded yet. Record it here before the match, or at the start of scoring.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Toss the coin/ })).toBeTruthy();
    expect(screen.getByText("Or enter a toss that was done in real life below.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Enter or correct the toss/ })).toBeTruthy();
    expect(sel("Who won the toss?").value).toBe("");
    expect(screen.getByText(/Choose “Not decided yet” in both to clear it/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save toss" })).toBeTruthy();
  });
  it("recorded: a Recorded badge, the summary, who bats first with the badge, a Change button; the fields start filled", () => {
    const { container } = toss({ winner: 2, decision: "bowl", battingFirst: 1 });
    expect(screen.getByText("Recorded")).toBeTruthy();
    expect(container.textContent).toContain("Blue Hawks won the toss and chose to bowl.");
    expect(container.textContent).toContain("Desert Falcons bats first.");
    expect(container.querySelector(".md-bats [role=img]")?.getAttribute("aria-label")).toBe("Team Desert Falcons");
    expect(screen.getByRole("button", { name: /Change/ })).toBeTruthy();
    expect(sel("Who won the toss?").value).toBe("2");
    expect(sel("The winner chose to").value).toBe("bowl");
  });
  it("after the match started: the summary only, no buttons and no form", () => {
    toss({ winner: 1, decision: "bat", battingFirst: 1, canEdit: false });
    expect(screen.getByText("Recorded")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Toss the coin/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save toss" })).toBeNull();
    cleanup();
    toss({ canEdit: false });
    expect(screen.getByText("No toss was recorded for this match.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save toss" })).toBeNull();
  });
  it("coin open: four steps, team tiles with badges, heads and tails tiles, the button off until a call, with its reason", () => {
    toss();
    fireEvent.click(screen.getByRole("button", { name: /Toss the coin/ }));
    const steps = screen.getByRole("list", { name: "Step 1 of 4: Who calls" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    const who = screen.getByRole("radiogroup", { name: "Who calls the toss" });
    expect(within(who).getAllByRole("radio")).toHaveLength(2);
    expect(who.querySelectorAll('[role="img"]')).toHaveLength(2);
    expect(within(who).getByRole("radio", { name: /Desert Falcons/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Desert Falcons calls")).toBeTruthy();
    const go = screen.getAllByRole("button", { name: /Toss the coin/ }).pop() as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    expect(screen.getByText("Choose heads or tails first.")).toBeTruthy();
    fireEvent.click(within(who).getByRole("radio", { name: /Blue Hawks/ }));
    expect(screen.getByText("Blue Hawks calls")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Heads/ }));
    expect(screen.getByRole("radio", { name: /Heads/ }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getAllByRole("button", { name: /Toss the coin/ }).pop() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("list", { name: "Step 3 of 4: Toss" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close the coin" }));
    expect(screen.queryByRole("radiogroup", { name: "Who calls the toss" })).toBeNull();
  });
  it("the flip: in the air for about 2.2 seconds with a status chip and a disabled Tossing button, then the result in words", () => {
    vi.useFakeTimers();
    toss();
    fireEvent.click(screen.getByRole("button", { name: /Toss the coin/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Heads/ }));       // Desert Falcons call heads
    h.flip.mockImplementation(() => "tails");                              // ...and the coin shows tails
    fireEvent.click(screen.getAllByRole("button", { name: /Toss the coin/ }).pop()!);
    expect(screen.getByText("Coin in the air")).toBeTruthy();
    expect(screen.getByText("Desert Falcons called heads. The coin is in the air…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Tossing…" }) as HTMLButtonElement).disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.queryByText("It’s TAILS")).toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText("It’s TAILS")).toBeTruthy();
    expect(screen.getByText("Blue Hawks won the toss.")).toBeTruthy();
    expect(screen.getByText("Blue Hawks chooses to")).toBeTruthy();
    expect(screen.getByText("Choose bat or bowl to continue.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Step 4 of 4: Choose" })).toBeTruthy();
  });
  it("choosing bat or bowl fills the two fields below and says who bats first; Save toss still has to be pressed", async () => {
    vi.useFakeTimers();
    const { container } = toss();
    fireEvent.click(screen.getByRole("button", { name: /Toss the coin/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Tails/ }));       // Desert Falcons call tails, the coin shows heads: Blue Hawks win
    fireEvent.click(screen.getAllByRole("button", { name: /Toss the coin/ }).pop()!);
    act(() => { vi.advanceTimersByTime(2300); });
    vi.useRealTimers();
    expect(screen.getByText("Blue Hawks won the toss.")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Bowl first/ }));
    expect(sel("Who won the toss?").value).toBe("2");
    expect(sel("The winner chose to").value).toBe("bowl");
    expect(screen.getByText(/Blue Hawks chose to bowl. Desert Falcons bats first. Filled into the form below: press Save toss to keep it./)).toBeTruthy();
    expect(h.toss).not.toHaveBeenCalled();
    await submitForm(container);
    expect(h.toss).toHaveBeenCalledTimes(1);
    const fd = h.toss.mock.calls[0]![1];
    expect(fd.get("winner")).toBe("2");
    expect(fd.get("decision")).toBe("bowl");
    expect(fd.get("communityId")).toBe("c1");
    expect(fd.get("matchId")).toBe("m1");
  });
  it("reduced motion: the result shows at once, with no waiting", () => {
    Object.defineProperty(window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), configurable: true });
    toss();
    fireEvent.click(screen.getByRole("button", { name: /Toss the coin/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Heads/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /Toss the coin/ }).pop()!);
    expect(screen.getByText("It’s HEADS")).toBeTruthy();
    expect(screen.queryByText("Coin in the air")).toBeNull();
  });
  it("validation: winner without a decision puts the message on the decision field, the button stays available, nothing is sent", async () => {
    const { container } = toss();
    fireEvent.change(sel("Who won the toss?"), { target: { value: "2" } });
    await submitForm(container);
    expect(h.toss).not.toHaveBeenCalled();
    const dec = sel("The winner chose to");
    expect(dec.getAttribute("aria-invalid")).toBe("true");
    expect(dec.className).toContain("bad");
    expect(screen.getByRole("alert").textContent).toBe("Choose what the toss winner decided: bat or bowl.");
    expect((screen.getByRole("button", { name: "Save toss" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(dec, { target: { value: "bat" } });          // fixing the field clears the message
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("validation: a decision without a winner marks the winner field", async () => {
    const { container } = toss();
    fireEvent.change(sel("The winner chose to"), { target: { value: "bat" } });
    await submitForm(container);
    expect(sel("Who won the toss?").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Choose which team won the toss.");
  });
  it("both 'Not decided yet' clears the toss: it is sent as empty values", async () => {
    const { container } = toss({ winner: 2, decision: "bowl", battingFirst: 1 });
    fireEvent.change(sel("Who won the toss?"), { target: { value: "" } });
    fireEvent.change(sel("The winner chose to"), { target: { value: "" } });
    await submitForm(container);
    const fd = h.toss.mock.calls[0]![1];
    expect(fd.get("winner")).toBe("");
    expect(fd.get("decision")).toBe("");
  });
  it("a server error shows on the form; 'already started' turns the card read only", async () => {
    h.toss.mockImplementation(async () => ({ error: "This match has already started, so the toss can no longer be changed here." }));
    const { container } = toss({ winner: 2, decision: "bowl", battingFirst: 1 });
    await submitForm(container);
    expect(screen.getByRole("alert").textContent).toContain("This match has already started, so the toss can no longer be changed here.");
    expect(screen.queryByRole("button", { name: "Save toss" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Toss the coin/ })).toBeNull();
    expect(container.textContent).toContain("Blue Hawks won the toss and chose to bowl.");
  });
  it("another server error stays under the form and the form stays", async () => {
    h.toss.mockImplementation(async () => ({ error: "That match could not be found." }));
    const { container } = toss({ winner: 2, decision: "bowl", battingFirst: 1 });
    await submitForm(container);
    expect(screen.getByText("That match could not be found.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save toss" })).toBeTruthy();
  });
});

/* ---------------- banners ---------------- */
describe("banners above the page", () => {
  it("created + a notice from ?e= stack; the green ones have a tick and role=status", () => {
    const { container } = render(<MdTopNotices q={{ created: "1", e: "reminded", n: "12" }} communityId="c1" matchId="m1" warning={null} />);
    expect(container.textContent).toContain("Match created. Everyone in the community was told and can reply.");
    expect(container.textContent).toContain("Reminder sent to 12 people who have not replied.");
    expect(screen.getByRole("link", { name: "Pick lineups" }).getAttribute("href")).toBe(`${BASE}/lineup`);
    expect(container.querySelectorAll('[role="status"]').length).toBeGreaterThanOrEqual(2);
  });
  it("after Rematch: the green line with Review lineups and Edit, the series note, and the series wording", () => {
    const { container } = render(<MdTopNotices q={{ rematch: "1", series: "s1" }} communityId="c1" matchId="m1" warning={null} />);
    expect(container.textContent).toContain("Rematch created. Lineups were copied: change them below if you need to. It is part of the series.");
    expect(screen.getByRole("link", { name: "Review lineups" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe(`${BASE}/edit`);
    cleanup();
    const n = render(<MdTopNotices q={{ rematch: "1", seriesnote: "1" }} communityId="c1" matchId="m1" warning={null} />);
    expect(n.container.textContent).toContain("could not be added to a series");
  });
  it("after Edit: Changes saved. After postpone and cancel: the notice words and a link to the Matches list", () => {
    expect(render(<MdTopNotices q={{ saved: "1" }} communityId="c1" matchId="m1" warning={null} />).container.textContent).toContain("Changes saved.");
    cleanup();
    const p = render(<MdTopNotices q={{ e: "postponed" }} communityId="c1" matchId="m1" warning={null} />);
    expect(p.container.textContent).toContain("Match postponed. Everyone was told.");
    expect(screen.getByRole("link", { name: /View in Matches/ }).getAttribute("href")).toBe("/c/c1/matches");
    cleanup();
    expect(render(<MdTopNotices q={{ e: "cancelled" }} communityId="c1" matchId="m1" warning={null} />).container.textContent).toContain("Match cancelled. Everyone was told.");
  });
  it("red notices keep their words and carry an alert icon; too many players links to Edit match", () => {
    const { container } = render(<MdTopNotices q={{ e: "too_many", side: "Blue Hawks", max: "6" }} communityId="c1" matchId="m1" warning={null} />);
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(container.textContent).toContain("Blue Hawks can have at most 6 players. Raise “players per side” in Edit match first, or take someone out.");
    expect(screen.getByRole("link", { name: /Edit match/ }).getAttribute("href")).toBe(`${BASE}/edit`);
    cleanup();
    expect(render(<MdTopNotices q={{ e: "locked" }} communityId="c1" matchId="m1" warning={null} />).container.textContent).toContain("This match has already started, so this can no longer be changed here.");
  });
  it("an unknown code shows nothing; the bowler pattern warning keeps its text with an Edit link", () => {
    expect(render(<MdTopNotices q={{ e: "nonsense" }} communityId="c1" matchId="m1" warning={null} />).container.textContent).toBe("");
    cleanup();
    const { container } = render(<MdTopNotices q={{}} communityId="c1" matchId="m1" warning="The pattern 2-2-1 adds up to 5 overs, but the match is 6 overs. Please check it." />);
    expect(container.textContent).toContain("The pattern 2-2-1 adds up to 5 overs, but the match is 6 overs. Please check it.");
    expect(screen.getByRole("link", { name: "Edit the match" })).toBeTruthy();
  });
  it("cancelled is explained in red; postponed is orange with a Reschedule button to Edit; others show nothing", () => {
    const c = render(<MdStatusNotice status="cancelled" communityId="c1" matchId="m1" />);
    expect(c.container.textContent).toContain("This match was cancelled.");
    expect(c.container.textContent).toContain("It stays in the list. You can delete it or play a rematch.");
    expect(c.container.querySelector('[role="alert"]')).toBeTruthy();
    cleanup();
    const p = render(<MdStatusNotice status="postponed" communityId="c1" matchId="m1" />);
    expect(p.container.textContent).toContain("This match is postponed.");
    expect(p.container.textContent).toContain("Edit it and choose a new date and time to schedule it again.");
    expect(screen.getByRole("link", { name: "Reschedule" }).getAttribute("href")).toBe(`${BASE}/edit`);
    cleanup();
    expect(render(<MdStatusNotice status="scheduled" communityId="c1" matchId="m1" />).container.textContent).toBe("");
  });
});

/* ---------------- primary button, rules, link ---------------- */
describe("primary button, rules and link", () => {
  it("Start scoring with the lineup gap above it; the gap only before scoring", () => {
    const p = primaryAction(BASE, "scheduled", { iHoldTheLock: false, scorerName: null });
    const { container } = render(<MdPrimary primary={p} gap="Each side needs at least 2 players before scoring can start." communityId="c1" matchId="m1" />);
    expect(screen.getByRole("link", { name: "Start scoring" }).getAttribute("href")).toBe(`${BASE}/score`);
    expect(container.textContent).toContain("Each side needs at least 2 players before scoring can start.");
    expect(screen.getByRole("link", { name: "Pick lineups" }).getAttribute("href")).toBe(`${BASE}/lineup`);
  });
  it("a live match for a spectator: Watch live or take over, with who is scoring", () => {
    render(<MdPrimary primary={primaryAction(BASE, "live", { iHoldTheLock: false, scorerName: "Usman Tariq" })} gap={null} communityId="c1" matchId="m1" />);
    expect(screen.getByRole("link", { name: "Watch live or take over" })).toBeTruthy();
    expect(screen.getByText("Scoring now: Usman Tariq")).toBeTruthy();
  });
  it("no button for cancelled and postponed", () => {
    expect(render(<MdPrimary primary={null} gap={null} communityId="c1" matchId="m1" />).container.textContent).toBe("");
  });
  it("rules: open before the match, closed after; every row of the old page is there", () => {
    const { container } = render(<MdRules r={DEFAULT_RULES} limitText="2 overs per bowler" open={false} />);
    expect(container.querySelector("details")!.hasAttribute("open")).toBe(false);
    for (const k of ["Innings", "Balls per over", "Wide", "No ball", "Byes and leg-byes", "Free hit", "Overthrows", "Retired batter", "Same bowler twice in a row", "Last batter", "Ways of getting out", "If level", "Bowler limit"]) {
      expect(container.textContent).toContain(k);
    }
    expect(container.textContent).toContain("2 overs per bowler");
    cleanup();
    expect(render(<MdRules r={DEFAULT_RULES} limitText="No limit" open />).container.querySelector("details")!.hasAttribute("open")).toBe(true);
  });
  it("match link with a Copy button and the sentence about who can open it", () => {
    const { container } = render(<MdLinkCard link="https://indoorkhelo.app/c/c1/matches/m1" />);
    expect(container.textContent).toContain("https://indoorkhelo.app/c/c1/matches/m1");
    expect(screen.getByRole("button", { name: /Copy/ })).toBeTruthy();
    expect(container.textContent).toContain("Members of this community can open it. Anyone else is asked to sign in and join first.");
  });
});

/* ---------------- manage ---------------- */
const manage = (status: Parameters<typeof MdManageCard>[0]["status"], rematchLabel = "Rematch") => (
  <SnackbarProvider>
    <div style={{ display: "flex" }}><MdTopRight communityId="c1" matchId="m1" status={status} link="https://x/y" title="A v B" rematchLabel={rematchLabel} /></div>
    <MdManageCard communityId="c1" matchId="m1" status={status} title="Desert Falcons v Blue Hawks" whenLabel="Fri 28 Nov" rematchLabel={rematchLabel} />
  </SnackbarProvider>
);
const card = () => document.getElementById("md-manage")!;
const rowsOf = () => Array.from(card().querySelectorAll<HTMLElement>("a.cr-mrow, button.cr-mrow"));

describe("Manage match and the top-right menu", () => {
  it("scheduled: Rematch, Edit, Postpone, Cancel, Delete, no dimmed rows", () => {
    render(manage("scheduled"));
    const rows = rowsOf().map((e) => e.textContent ?? "");
    expect(rows.map((t) => t.match(/^(Rematch|Edit match|Postpone|Cancel match|Delete match)/)?.[0])).toEqual(["Rematch", "Edit match", "Postpone", "Cancel match", "Delete match"]);
    expect(card().querySelector(".off")).toBeNull();
  });
  it("finished: only Rematch is left (no disabled buttons); a series that is open says so", () => {
    render(manage("completed", "Play another match in this series"));
    const rows = rowsOf();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain("Play another match in this series");
    expect(rows[0]!.getAttribute("href")).toBe(`${BASE}/rematch`);
  });
  it("live: Rematch only; postponed: no Postpone; cancelled: Rematch and Delete", () => {
    render(manage("live"));
    expect(rowsOf()).toHaveLength(1);
    cleanup();
    render(manage("postponed"));
    expect(card().textContent).toContain("Edit match");
    expect(card().textContent).toContain("Cancel match");
    expect(card().textContent).not.toContain("Postpone");
    cleanup();
    render(manage("cancelled"));
    expect(rowsOf().map((e) => e.textContent!.slice(0, 6))).toEqual(["Rematc", "Delete"]);
  });
  it("the menu lists the same actions in the proposal's order, risky ones last", () => {
    render(manage("scheduled"));
    fireEvent.click(screen.getByRole("button", { name: "Match actions" }));
    expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["Edit match", "Rematch", "Postpone", "Cancel match", "Delete match"]);
    expect(screen.getByRole("menuitem", { name: "Edit match" }).getAttribute("href")).toBe(`${BASE}/edit`);
    expect(screen.getByRole("menuitem", { name: "Cancel match" }).className).toContain("danger");
  });
  it("menu for a finished match is only Rematch; a series changes its wording", () => {
    render(manage("completed", "Play another match in this series"));
    fireEvent.click(screen.getByRole("button", { name: "Match actions" }));
    expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["Play another match in this series"]);
  });
  it("Postpone from the menu opens the card's dialog and the dialog posts the existing action with the match", async () => {
    render(manage("scheduled"));
    fireEvent.click(screen.getByRole("button", { name: "Match actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Postpone" }));
    const dlg = screen.getByRole("alertdialog", { name: "Postpone this match?" });
    expect(dlg.textContent).toContain("Desert Falcons v Blue Hawks");
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Postpone and tell everyone" })); });
    expect(h.postpone).toHaveBeenCalledTimes(1);
    const fd = h.postpone.mock.calls[0]![0] as FormData;
    expect(fd.get("communityId")).toBe("c1");
    expect(fd.get("matchId")).toBe("m1");
  });
  it("Cancel from the menu: 'Keep match' is the safe button, and Cancel match posts the existing action", async () => {
    render(manage("scheduled"));
    fireEvent.click(screen.getByRole("button", { name: "Match actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancel match" }));
    const dlg = screen.getByRole("alertdialog", { name: "Cancel this match?" });
    expect(within(dlg).getByRole("button", { name: "Keep match" })).toBeTruthy();
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Cancel match" })); });
    expect(h.cancel).toHaveBeenCalledTimes(1);
  });
  it("Delete asks for the match name and stays off until it is typed", async () => {
    render(manage("scheduled"));
    fireEvent.click(within(card()).getByRole("button", { name: /Delete match/ }));
    const dlg = screen.getByRole("alertdialog", { name: "Delete this match for good?" });
    const go = within(dlg).getByRole("button", { name: "Delete forever" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(within(dlg).getByRole("textbox"), { target: { value: "desert falcons v blue hawks" } });
    expect(go.disabled).toBe(false);
    await act(async () => { fireEvent.click(go); });
    expect(h.del).toHaveBeenCalledTimes(1);
  });
});

describe("share button", () => {
  it("copies the match link when the browser cannot share", async () => {
    const write = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    render(manage("scheduled"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Share match link" })); });
    expect(write).toHaveBeenCalledWith("https://x/y");
    expect(screen.getByText("Match link copied.")).toBeTruthy();
  });
});

/* ---------------- side column ---------------- */
describe("side column at 1360px and up", () => {
  it("below that width the blocks stay in the page", () => {
    Object.defineProperty(window, "matchMedia", { value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), configurable: true });
    const { container } = render(<><MdPanelSlot /><div id="page"><MdSide><p>toss</p></MdSide></div></>);
    expect(container.querySelector("#page")!.textContent).toBe("toss");
    expect(document.getElementById(MD_PANEL)!.textContent).toBe("");
  });
  it("on a wide screen they are drawn into the side column, and only there", () => {
    Object.defineProperty(window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), configurable: true });
    const { container } = render(<><MdPanelSlot /><div id="page"><MdSide><p>toss</p></MdSide></div></>);
    expect(document.getElementById(MD_PANEL)!.textContent).toBe("toss");
    expect(container.querySelector("#page")!.textContent).toBe("");
  });
});
