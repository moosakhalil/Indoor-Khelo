// @vitest-environment jsdom
// Builder 1 (UI redesign phase B): the Home screen (11 scenarios), the alerts bell, the community switcher and the nav extras.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
let PATH = "/c/c1";
vi.mock("next/navigation", () => ({ usePathname: () => PATH }));
const setAvailabilityAction = vi.fn(async (_fd: FormData) => {});
vi.mock("@/app/actions4", () => ({ setAvailabilityAction: (fd: FormData) => setAvailabilityAction(fd) }));
const shell = vi.hoisted(() => ({
  user: null as null | { id: string; name: string },
  unread: 0,
}));
vi.mock("@/lib/shellData", () => ({
  shellUser: async () => shell.user,
  shellUnread: async () => shell.unread,
  shellHasLive: async () => false,
  shellCommunityName: async () => "Club",
  shellMember: async () => null,
  shellCommunities: async () => [],
}));
const loadEvents = vi.hoisted(() => vi.fn());
vi.mock("@/lib/scoring", () => ({ loadEvents }));

import BottomNav from "@/components/BottomNav";
import CommunitySwitcher from "@/components/CommunitySwitcher";
import Frame from "@/components/Frame";
import { formatDay, greetingFor } from "@/components/HomeParts";
import HomeView, { type HomeData } from "@/components/HomeView";
import { AlertsBell, BellLink, countLabel } from "@/components/ShellParts";
import { loadScoreLine, scoreLineFromState, scoreText } from "@/lib/scoreLine";

afterEach(() => { cleanup(); PATH = "/c/c1"; vi.restoreAllMocks(); setAvailabilityAction.mockClear(); });

/* ---------- helpers ---------- */
const match = (o: Record<string, unknown> = {}) => ({
  id: "m1", community_id: "c1", status: "scheduled", scheduled_at: new Date("2026-11-28T15:00:00Z"), venue: "Clifton Indoor Arena", overs: 6, players_per_side: 6, rules: {},
  side1_id: "s1", side1_name: "Desert Falcons", side1_team: null, side2_id: "s2", side2_name: "Blue Hawks", side2_team: null,
  in_count: 3, out_count: 1, member_count: 24, my_answer: null, ...o,
}) as never;
const inn = (o: Record<string, unknown>) => ({ batting: 2, superOver: false, runs: 47, wickets: 2, legalBalls: 26, maxOvers: 6, target: 59, manualTarget: null, ended: false, ...o });
const state = (innings: unknown[], sides: [string, string] = ["Thunder Strikers", "Royal Panthers"]) => ({ started: true, sides, rules: { ballsPerOver: 6 }, innings }) as never;
const liveLine = scoreLineFromState(state([inn({ batting: 1, runs: 58, wickets: 3, legalBalls: 36, target: null, ended: true }), inn({})]));
const doneLine = (a: [number, number], b: [number, number]) => scoreLineFromState(state([inn({ batting: 1, runs: a[0], wickets: a[1], legalBalls: 36, target: null, ended: true }), inn({ batting: 2, runs: b[0], wickets: b[1], ended: true })]));
const result = (n1: string, n2: string, text: string) => ({ id: n1 + n2, n1, n2, text, when: new Date("2026-11-22T12:00:00Z"), line: doneLine([72, 4], [66, 6]) });
const base: HomeData = {
  id: "c1", tz: "Asia/Karachi", isAdmin: true, pending: 3, alerts: 2, members: 24, cap: 99,
  community: { name: "Karachi Indoor Cricket Club", location: "Clifton, Karachi", description: "Weekly indoor cricket." },
  number: 7, live: match({ id: "L", status: "live", side1_name: "Thunder Strikers", side2_name: "Royal Panthers" }), liveLine,
  next: match(), today: null, todayLineup: [], mySide: null,
  results: [result("Thunder Strikers", "Desert Falcons", "Thunder Strikers won by 6 runs"), result("Royal Panthers", "Blue Hawks", "Match tied"), result("Blue Hawks", "Thunder Strikers", "Blue Hawks won")],
};
const home = (d: HomeData) => render(<HomeView d={d} />);
const lineup = (pos: 1 | 2, n: number, meFirst = false) => Array.from({ length: n }, (_, i) => ({
  id: `${pos}-${i}`, side_id: "s", position: pos, user_id: meFirst && i === 0 ? "me" : `u${pos}${i}`, guest_name: null, name: `Player ${pos}${i}`, player_number: i + 1, playing_role: null, kind: "member", linked_by_name: null,
})) as never[];

/* ---------- score summary (src/lib/scoreLine.ts) ---------- */
describe("score summary from the engine state", () => {
  it("gives each side's runs, wickets and overs, and the chase sentence", () => {
    expect(liveLine!.sides[0]).toMatchObject({ name: "Thunder Strikers", runs: 58, wickets: 3, overs: "6.0", batted: true });
    expect(liveLine!.sides[1]).toMatchObject({ name: "Royal Panthers", runs: 47, wickets: 2, overs: "4.2" });
    expect(liveLine!.batting).toBe(2);
    expect(liveLine!.chase).toBe("Royal Panthers need 12 from 10 balls · RRR 7.2");
    expect(scoreText(liveLine!.sides[0])).toBe("58/3");
  });
  it("says ball in the singular and leaves out the rate when no balls are left", () => {
    const one = scoreLineFromState(state([inn({ batting: 1, target: null, ended: true }), inn({ legalBalls: 35, runs: 50 })]));
    expect(one!.chase).toBe("Royal Panthers need 9 from 1 ball · RRR 54.0");
    const none = scoreLineFromState(state([inn({ batting: 1, target: null, ended: true }), inn({ legalBalls: 36, runs: 50 })]));
    expect(none!.chase).toBe("Royal Panthers need 9 from 0 balls");
  });
  it("has no chase in the first innings, and a side that has not batted shows a dash", () => {
    const first = scoreLineFromState(state([inn({ batting: 1, target: null, runs: 20, wickets: 1, legalBalls: 12 })]));
    expect(first!.chase).toBeNull();
    expect(first!.batting).toBe(1);
    expect(scoreText(first!.sides[1])).toBe("–");
  });
  it("is null before the match starts, and a finished innings is not 'batting'", () => {
    expect(scoreLineFromState({ started: false, innings: [], sides: ["A", "B"], rules: { ballsPerOver: 6 } } as never)).toBeNull();
    const over = doneLine([72, 4], [66, 6]);
    expect(over!.batting).toBeNull();
    expect(over!.chase).toBeNull();
  });
  it("a super over never replaces the match score", () => {
    const l = scoreLineFromState(state([inn({ batting: 1, runs: 40, target: null, ended: true }), inn({ batting: 2, runs: 40, ended: true }), inn({ batting: 1, superOver: true, runs: 9, target: null, ended: true }), inn({ batting: 2, superOver: true, runs: 3, target: 10, legalBalls: 4, maxOvers: 1 })]));
    expect(l!.sides[0].runs).toBe(40);
    expect(l!.chase).toBe("Super over: Royal Panthers need 7 from 2 balls · RRR 21.0");
  });
  it("loadScoreLine reads the events and never throws", async () => {
    loadEvents.mockResolvedValueOnce([]);
    expect(await loadScoreLine("m")).toBeNull();
    loadEvents.mockRejectedValueOnce(new Error("db down"));
    expect(await loadScoreLine("m")).toBeNull();
    expect(loadEvents).toHaveBeenCalledWith("m");
  });
});

/* ---------- Home scenarios ---------- */
describe("Home: greeting and dates", () => {
  it("greets by the hour in the viewer's zone with the first name", () => {
    expect(greetingFor(8, "Ali Raza")).toBe("Good morning, Ali");
    expect(greetingFor(13, "Ali Raza")).toBe("Good afternoon, Ali");
    expect(greetingFor(20, "Ali Raza")).toBe("Good evening, Ali");
    expect(greetingFor(20, "  ")).toBe("Good evening, there");
  });
  it("formats the result date in the viewer's time zone", () => {
    expect(formatDay(new Date("2026-11-22T23:30:00Z"), "Asia/Karachi")).toMatch(/Mon\s+23 Nov/);
    expect(formatDay(null, "UTC")).toBe("");
  });
});

describe("Home scenario 1: Admin, live match, unanswered next match, 3 requests, 2 alerts, 3 results", () => {
  it("shows banners with buttons, the score bug, the reply buttons, quick actions and results", () => {
    home(base);
    const banners = screen.getAllByRole("link").filter((a) => a.classList.contains("hm-banner"));
    expect(banners.map((a) => a.getAttribute("href"))).toEqual(["/c/c1/requests", "/c/c1/alerts"]);
    expect(banners[0]!.textContent).toContain("3 join requests");
    expect(banners[0]!.textContent).toContain("Review");
    expect(banners[1]!.textContent).toContain("2 new alerts");
    expect(banners[1]!.textContent).toContain("Open");
    const live = screen.getByRole("region", { name: "Live match" });
    expect(live.textContent).toContain("LIVE");
    expect(live.textContent).toContain("58/3");
    expect(live.textContent).toContain("47/2");
    expect(live.textContent).toContain("Royal Panthers need 12 from 10 balls · RRR 7.2");
    expect(within(live).getByRole("link", { name: /Watch/ }).getAttribute("href")).toBe("/c/c1/matches/L/score");
    expect(within(live).getByRole("link", { name: /Score/ }).getAttribute("href")).toBe("/c/c1/matches/L/score");
    expect(within(live).getAllByRole("img", { name: /^Team / })).toHaveLength(2);
    const next = screen.getByRole("region", { name: "Next match" });
    expect(next.textContent).toContain("Reply needed");
    expect(within(next).getByRole("button", { name: /I'm in/ })).toBeTruthy();
    expect(within(next).getByRole("button", { name: /Can't make it/ })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Quick actions" }).textContent).toContain("Continue scoring");
    expect(screen.getByRole("region", { name: "Recent results" }).textContent).toContain("72/4");
  });
  it("the player's own shirt (normal size, number only) is on the community card with 'Your number · Admin'", () => {
    home(base);
    const card = screen.getByRole("region", { name: "Community" });
    expect(card.textContent).toContain("24 of 99 members · Clifton, Karachi");
    expect(card.textContent).toContain("Your number · Admin");
    expect(within(card).getByRole("img", { name: "Player number 7" }).getAttribute("class")).toBe("shirt");
    expect(within(card).getByRole("link", { name: /Open the community page/ }).getAttribute("href")).toBe("/c/c1/community");
  });
  it("has the floating New match button, hidden by CSS from 640 px up", () => {
    home(base);
    const fab = screen.getAllByRole("link", { name: /New match/ }).find((a) => a.classList.contains("hm-fab"));
    expect(fab?.getAttribute("href")).toBe("/c/c1/matches/new");
  });
});

describe("Home scenario 2/3/4: the reply", () => {
  const answered = (a: "in" | "out" | null) => ({ ...base, live: null, liveLine: null, isAdmin: false, pending: 0, alerts: 5, next: match({ my_answer: a }) });
  it("2: 'You are in' is a green row with a check and a Change button; no Admin cards; alerts banner says 5", () => {
    home(answered("in"));
    const row = screen.getByRole("status");
    expect(row.textContent).toContain("You are in");
    expect(row.className).toContain("is-in");
    expect(screen.getByRole("button", { name: /Change your reply/ })).toBeTruthy();
    expect(screen.queryByText(/join request/)).toBeNull();
    expect(screen.queryByText("Join requests")).toBeNull();
    expect(screen.getByText("5 new alerts")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Quick actions" }).textContent).toContain("Start scoring");
    expect(screen.getByRole("region", { name: "Community" }).textContent).toContain("Your number");
    expect(screen.getByRole("region", { name: "Community" }).textContent).not.toContain("Admin");
  });
  it("3: 'You are out' is neutral, not green, and still has Change", () => {
    home(answered("out"));
    const row = screen.getByRole("status");
    expect(row.textContent).toContain("You are out");
    expect(row.className).toContain("is-out");
    expect(row.className).not.toContain("is-in");
    expect(screen.queryByText("Reply needed")).toBeNull();
  });
  it("Change shows the two buttons again; they post the same fields as the match page, with next=home", () => {
    home(answered("out"));
    fireEvent.click(screen.getByRole("button", { name: /Change your reply/ }));
    const group = screen.getByRole("group", { name: "Are you coming?" });
    const forms = group.querySelectorAll("form");
    expect(forms).toHaveLength(2);
    const fields = (f: Element) => Object.fromEntries(Array.from(f.querySelectorAll("input")).map((i) => [i.getAttribute("name"), i.getAttribute("value")]));
    expect(fields(forms[0]!)).toEqual({ communityId: "c1", matchId: "m1", answer: "in", next: "home" });
    expect(fields(forms[1]!)).toEqual({ communityId: "c1", matchId: "m1", answer: "out", next: "home" });
    fireEvent.click(screen.getByRole("button", { name: "Keep my reply" }));
    expect(screen.getByRole("status").textContent).toContain("You are out");
  });
  it("4: no reply yet shows 'Reply needed', both team badges, venue and time, and a link to the match", () => {
    home(answered(null));
    const next = screen.getByRole("region", { name: "Next match" });
    expect(next.textContent).toContain("Reply needed");
    expect(next.textContent).toContain("Desert Falcons v Blue Hawks");
    expect(next.textContent).toContain("Clifton Indoor Arena");
    expect(within(next).getAllByRole("img", { name: /^Team / })).toHaveLength(2);
    expect(within(next).getByRole("link", { name: /Open the match/ }).getAttribute("href")).toBe("/c/c1/matches/m1");
  });
  it("submitting calls the existing action once", async () => {
    home(answered(null));
    const form = screen.getByRole("button", { name: /I'm in/ }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });
    expect(setAvailabilityAction).toHaveBeenCalledTimes(1);
  });
});

describe("Home scenario 5 and 6: match day", () => {
  const today = match({ id: "T", side1_name: "Thunder Strikers", side2_name: "Desert Falcons" });
  it("5: both lineups as lists with a shirt per player and a count; own team has the gold ring; three actions", () => {
    home({ ...base, live: null, liveLine: null, pending: 0, alerts: 1, today, next: today, todayLineup: [...lineup(1, 6, true), ...lineup(2, 5)], mySide: 1 });
    const card = screen.getByRole("region", { name: "Match day" });
    expect(card.textContent).toContain("Today");
    expect(within(card).getAllByRole("listitem")).toHaveLength(11);
    expect(within(card).getByLabelText("6 players").textContent).toBe("6");
    expect(within(card).getByLabelText("5 players").textContent).toBe("5");
    expect(within(card).getAllByRole("img", { name: /^Player number/ })).toHaveLength(11);
    expect(card.querySelectorAll(".hm-ringwrap.mine")).toHaveLength(1);
    expect(card.querySelector(".hm-ringwrap.mine")!.textContent).toBe("TS");
    expect(card.textContent).toContain("your team");
    expect(within(card).getByRole("link", { name: /Start scoring/ }).getAttribute("href")).toBe("/c/c1/matches/T/score");
    expect(within(card).getByRole("link", { name: /Pick lineups/ }).getAttribute("href")).toBe("/c/c1/matches/T/lineup");
    expect(within(card).getByRole("link", { name: /Toss the coin/ }).getAttribute("href")).toBe("/c/c1/matches/T#toss");
    expect(within(card).getByRole("link", { name: /Start scoring/ }).className).toContain("gold");
    expect(card.textContent).not.toContain("No lineup yet");
    // match day replaces the next-match card
    expect(screen.queryByRole("region", { name: "Next match" })).toBeNull();
  });
  it("6: empty sides say 'No lineup yet' with a Pick lineup button and a count of 0", () => {
    home({ ...base, live: null, liveLine: null, pending: 0, alerts: 0, today, next: today, todayLineup: [], mySide: null });
    const card = screen.getByRole("region", { name: "Match day" });
    expect(within(card).getAllByText("No lineup yet")).toHaveLength(2);
    expect(within(card).getAllByRole("link", { name: /Pick lineup$/ })).toHaveLength(2);
    expect(within(card).getAllByLabelText("0 players")).toHaveLength(2);
    expect(card.querySelectorAll(".hm-ringwrap.mine")).toHaveLength(0);
  });
  it("a guest in the lineup gets the grey no-number shirt", () => {
    const guest = { ...(lineup(1, 1)[0] as object), kind: "guest", player_number: null, name: "Sami (guest)" } as never;
    home({ ...base, live: null, liveLine: null, today, next: today, todayLineup: [guest], mySide: null });
    expect(screen.getByRole("img", { name: "Guest, no player number" })).toBeTruthy();
  });
});

describe("Home scenario 7: live match and no next match", () => {
  it("the score bug leads, no 'No match planned' box, New match is in quick actions, scores from both sides", () => {
    home({ ...base, next: null, pending: 0, alerts: 0 });
    expect(screen.queryByText("No match planned yet")).toBeNull();
    expect(screen.getByRole("region", { name: "Live match" })).toBeTruthy();
    const quick = screen.getByRole("region", { name: "Quick actions" });
    expect(within(quick).getByRole("link", { name: /Continue scoring/ }).getAttribute("href")).toBe("/c/c1/matches/L/score");
    expect(within(quick).getByRole("link", { name: /New match/ })).toBeTruthy();
    expect(within(quick).getByRole("link", { name: /Invite friends/ }).getAttribute("href")).toBe("/c/c1/invite");
  });
  it("a paused match says PAUSED, and a live match with no score yet shows dashes", () => {
    home({ ...base, live: match({ id: "L", status: "paused" }), liveLine: null, next: null });
    const live = screen.getByRole("region", { name: "Live match" });
    expect(live.textContent).toContain("PAUSED");
    expect(live.textContent).toContain("–");
  });
});

describe("Home scenario 8 and 9: brand-new community, singular wording, empty results", () => {
  const fresh: HomeData = { ...base, live: null, liveLine: null, next: null, pending: 0, alerts: 0, results: [], members: 1 };
  it("8: 'No match planned yet' with a gold New match button, disabled Start scoring with its reason, a 'No results yet' panel", () => {
    home(fresh);
    const empty = screen.getByRole("region", { name: "No match planned" });
    expect(empty.textContent).toContain("No match planned yet");
    expect(within(empty).getByRole("link", { name: /New match/ }).className).toContain("gold");
    const quick = screen.getByRole("region", { name: "Quick actions" });
    const start = within(quick).getByRole("button", { name: /Start scoring/ }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(start.getAttribute("aria-describedby")).toBe("hm-noscore");
    expect(document.getElementById("hm-noscore")!.textContent).toBe("Create a match first");
    expect(screen.getByRole("region", { name: "Recent results" }).textContent).toContain("No results yet");
    expect(screen.queryByRole("link", { name: "See all" })).toBeNull();
    expect(screen.getByRole("region", { name: "Community" }).textContent).toContain("1 of 99 members");
    expect(screen.getByRole("region", { name: "More" }).textContent).toContain("1 player");
    expect(screen.getByRole("region", { name: "More" }).textContent).not.toContain("1 players");
  });
  it("9: exactly one request and one alert use the singular", () => {
    home({ ...fresh, pending: 1, alerts: 1 });
    expect(screen.getByText("1 join request")).toBeTruthy();
    expect(screen.getByText("1 new alert")).toBeTruthy();
  });
  it("Admin link list has Join requests with the waiting count; a member's list does not", () => {
    home({ ...fresh, pending: 3, alerts: 2 });
    const more = screen.getByRole("region", { name: "More" });
    expect(more.textContent).toContain("3 waiting");
    expect(more.textContent).toContain("2 unread");
    cleanup();
    home({ ...fresh, isAdmin: false, pending: 0, alerts: 0 });
    expect(screen.getByRole("region", { name: "More" }).textContent).not.toContain("Join requests");
    expect(screen.getByRole("region", { name: "More" }).textContent).toContain("Nothing new");
  });
});

describe("Home recent results", () => {
  it("each result has both badges, the date, both scores and a kebab with Open report and View PDF", () => {
    home(base);
    const card = screen.getByRole("region", { name: "Recent results" });
    expect(within(card).getAllByRole("img", { name: /^Team / })).toHaveLength(6);
    expect(card.textContent).toContain("Sun 22 Nov · Thunder Strikers won by 6 runs");
    expect(card.textContent).toContain("72/4");
    expect(card.textContent).toContain("66/6");
    expect(within(card).getByRole("link", { name: "See all" }).getAttribute("href")).toBe("/c/c1/matches");
    fireEvent.click(within(card).getAllByRole("button", { name: /More for/ })[0]!);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Open report" }).getAttribute("href")).toBe("/c/c1/matches/Thunder StrikersDesert Falcons/report");
    expect(within(menu).getByRole("menuitem", { name: "View PDF" }).getAttribute("href")).toBe("/api/matches/Thunder StrikersDesert Falcons/pdf?communityId=c1");
  });
  it("a result whose events cannot be read still shows the teams and the result text", () => {
    home({ ...base, results: [{ ...result("A Team", "B Team", "A Team won by 1 run"), line: null }] });
    expect(screen.getByRole("region", { name: "Recent results" }).textContent).toContain("A Team won by 1 run");
  });
});

describe("Home scenario 10: offline", () => {
  const online = (v: boolean) => Object.defineProperty(window.navigator, "onLine", { value: v, configurable: true });
  afterEach(() => online(true));
  it("shows a calm blue banner with the gold no-signal button and the roster-saved sentence", () => {
    online(false);
    home({ ...base, live: null, liveLine: null, pending: 0, alerts: 0 });
    const banner = screen.getByRole("status", { name: "You are offline" });
    expect(banner.className).toBe("hm-offline");
    expect(banner.textContent).toContain("Players are saved on this phone");
    const btn = within(banner).getByRole("link", { name: "New match with no signal" });
    expect(btn.getAttribute("href")).toBe("/c/c1/matches/quick");
    expect(btn.className).toContain("gold");
  });
  it("shows nothing while online, and appears when the phone goes offline", () => {
    online(true);
    home({ ...base, live: null, liveLine: null, pending: 0, alerts: 0 });
    expect(screen.queryByText("New match with no signal")).toBeNull();
    act(() => { online(false); window.dispatchEvent(new Event("offline")); });
    expect(screen.getByText("New match with no signal")).toBeTruthy();
    act(() => { online(true); window.dispatchEvent(new Event("online")); });
    expect(screen.queryByText("New match with no signal")).toBeNull();
  });
});

/* ---------- shell: bell ---------- */
describe("alerts bell", () => {
  beforeEach(() => { shell.user = null; shell.unread = 0; });
  it("renders nothing when nobody is signed in (and never redirects)", async () => {
    expect(await AlertsBell({ communityId: "c1" })).toBeNull();
  });
  it("links to the alerts page with the unread count in the accessible name", async () => {
    shell.user = { id: "u", name: "Ali" }; shell.unread = 3;
    render(await AlertsBell({ communityId: "c1" }));
    const a = screen.getByRole("link", { name: "Alerts, 3 unread" });
    expect(a.getAttribute("href")).toBe("/c/c1/alerts");
    expect(a.textContent).toBe("3");
  });
  it("no badge at zero, and 99+ for very large counts", () => {
    const html = renderToStaticMarkup(<BellLink communityId="c1" count={0} />);
    expect(html).toContain('aria-label="Alerts"');
    expect(html).not.toContain("hm-bell-n");
    expect(countLabel(120)).toBe("99+");
    expect(countLabel(99)).toBe("99");
  });
  it("is in the top bar of every Frame page without removing the title, back link or right slot", () => {
    const html = renderToStaticMarkup(<Frame communityId="c1" title="Teams" back="/c/c1" right={<button>Add</button>}><p>Body</p></Frame>);
    expect(html).toContain("<h1>Teams</h1>");
    expect(html).toContain('aria-label="Back"');
    expect(html).toContain("<button>Add</button>");
    expect(html).toContain("<p>Body</p>");
  });
  it("Frame shows an optional subtitle under the title and keeps working without one", () => {
    const withSub = renderToStaticMarkup(<Frame communityId="c1" title="Good evening, Ali" subtitle={<span>Club</span>}><p>x</p></Frame>);
    expect(withSub).toContain('class="hm-title"');
    expect(withSub).toContain("<span>Club</span>");
    expect(renderToStaticMarkup(<Frame communityId="c1" title="T"><p>x</p></Frame>)).not.toContain("hm-title");
  });
});

/* ---------- shell: community switcher ---------- */
const mine = [
  { id: "c1", name: "Karachi Indoor Cricket Club", role: "admin" as const, number: 7, members: 24 },
  { id: "c2", name: "Gulshan Gully Cricket", role: "member" as const, number: 21, members: 31 },
];
describe("community switcher", () => {
  it("the closed button shows the community name and tells screen readers what it does", () => {
    render(<CommunitySwitcher communityId="c1" communityName="Karachi Indoor Cricket Club" items={mine} />);
    const b = screen.getByRole("button", { name: /Switch community/ });
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(b.textContent).toBe("Karachi Indoor Cricket Club");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("opens a dialog with every community (role, number, members), shortcuts, Create another and Join another", () => {
    render(<CommunitySwitcher communityId="c1" communityName="Karachi Indoor Cricket Club" items={mine} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch community/ }));
    const dlg = screen.getByRole("dialog", { name: "Your communities" });
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(dlg.textContent).toContain("Admin · #7 · 24 members");
    expect(dlg.textContent).toContain("Member · #21 · 31 members");
    expect(within(dlg).getByRole("link", { name: "Switch to Gulshan Gully Cricket" }).getAttribute("href")).toBe("/switch/c2");
    expect(dlg.querySelector(".crow.current")!.textContent).toContain("Current");
    const places = ["Series", "Leaderboard", "Insights", "Members", "Alerts", "Community"].map((l) => within(dlg).getByRole("link", { name: l }).getAttribute("href"));
    expect(places).toEqual(["/c/c1/series", "/c/c1/leaderboard", "/c/c1/insights", "/c/c1/members", "/c/c1/alerts", "/c/c1/community"]);
    expect(within(dlg).getByRole("link", { name: /Create another/ }).getAttribute("href")).toBe("/create");
    expect(within(dlg).getByRole("link", { name: /Join another/ }).getAttribute("href")).toBe("/join");
    expect(screen.getByRole("button", { name: /Switch community/ }).getAttribute("aria-expanded")).toBe("true");
  });
  it("one community: a short hint and the same shortcuts and actions", () => {
    render(<CommunitySwitcher communityId="c1" communityName="Karachi Indoor Cricket Club" items={mine.slice(0, 1)} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch community/ }));
    const dlg = screen.getByRole("dialog");
    expect(dlg.textContent).toContain("You are in one community");
    expect(within(dlg).getByRole("link", { name: /Create another/ })).toBeTruthy();
    expect(within(dlg).getByRole("link", { name: "Members" })).toBeTruthy();
  });
  it("Escape, the close button and a tap on the backdrop close it and focus returns to the button", () => {
    render(<CommunitySwitcher communityId="c1" communityName="Karachi Indoor Cricket Club" items={mine} />);
    const open = () => fireEvent.click(screen.getByRole("button", { name: /Switch community/ }));
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Switch community/ }));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    open();
    fireEvent.click(document.querySelector(".hm-sw-back")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("tapping a community closes the panel; the page behind does not scroll while it is open", () => {
    render(<CommunitySwitcher communityId="c1" communityName="Karachi Indoor Cricket Club" items={mine} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch community/ }));
    expect(document.body.style.overflow).toBe("hidden");
    document.addEventListener("click", (e) => e.preventDefault(), { once: true }); // jsdom cannot navigate
    fireEvent.click(screen.getByRole("link", { name: "Switch to Gulshan Gully Cricket" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
  it("Tab stays inside the panel", () => {
    render(<CommunitySwitcher communityId="c1" communityName="Karachi Indoor Cricket Club" items={mine} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch community/ }));
    const dlg = screen.getByRole("dialog");
    const all = dlg.querySelectorAll<HTMLElement>("button, a[href]");
    all[all.length - 1]!.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(all[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(all[all.length - 1]);
  });
  it("the sidebar variant shows the logo, the name and 'Switch community'", () => {
    render(<CommunitySwitcher communityId="c1" communityName="Karachi Indoor Cricket Club" items={mine} variant="sidebar" />);
    const b = screen.getByRole("button", { name: /Switch community/ });
    expect(b.className).toBe("hm-sw-side");
    expect(b.textContent).toContain("KI");
    expect(b.textContent).toContain("Switch community");
  });
  it("on a wide screen it opens next to the button (fixed position from the button), on a phone as a sheet with no inline position", () => {
    const mm = (matches: boolean) => Object.defineProperty(window, "matchMedia", { value: () => ({ matches }), configurable: true });
    mm(true);
    const { unmount } = render(<CommunitySwitcher communityId="c1" communityName="Club" items={mine} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch community/ }));
    expect(screen.getByRole("dialog").getAttribute("style")).toMatch(/top:/);
    unmount();
    mm(false);
    render(<CommunitySwitcher communityId="c1" communityName="Club" items={mine} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch community/ }));
    expect(screen.getByRole("dialog").getAttribute("style")).toBeNull();
    // @ts-expect-error cleanup of the stub
    delete window.matchMedia;
  });
});

/* ---------- shell: navigation ---------- */
describe("navigation extras", () => {
  const tabs = () => Array.from(document.querySelectorAll(".nav > ul a")).map((a) => [a.textContent, a.getAttribute("aria-current")]);
  it("Home stays lit on its sub-pages (members, alerts, community, invite, requests, settings) and only there", () => {
    for (const p of ["/members", "/alerts", "/community", "/invite", "/requests", "/settings", "/members/u1"]) {
      PATH = `/c/c1${p}`;
      render(<BottomNav communityId="c1" />);
      expect(tabs().filter(([, c]) => c === "page")).toEqual([["Home", "page"]]);
      cleanup();
    }
    PATH = "/c/c1/teams/t1";
    render(<BottomNav communityId="c1" />);
    expect(tabs().filter(([, c]) => c === "page")).toEqual([["Teams", "page"]]);
  });
  it("the sidebar list gains Insights and Members and keeps Switch community", () => {
    render(<BottomNav communityId="c1" />);
    expect(Array.from(document.querySelectorAll(".nav-more a")).map((a) => a.textContent)).toEqual(["Community", "Series", "Leaderboard", "Insights", "Members", "Alerts", "Switch community"]);
  });
  it("renders the optional slots in the right places and nothing when they are not given", () => {
    render(<BottomNav communityId="c1" header={<i data-t="head" />} footer={<i data-t="foot" />} matchesSlot={<i data-t="dot" />} alertsSlot={<i data-t="count" />} />);
    expect(document.querySelector(".hm-nav-head [data-t=head]")).toBeTruthy();
    expect(document.querySelector(".hm-nav-foot [data-t=foot]")).toBeTruthy();
    expect(document.querySelector("li:has(a[href='/c/c1/matches']) [data-t=dot]")).toBeTruthy();
    expect(document.querySelector("li:has(a[href='/c/c1/alerts']) [data-t=count]")).toBeTruthy();
    cleanup();
    render(<BottomNav communityId="c1" />);
    expect(document.querySelector(".hm-nav-head, .hm-nav-foot")).toBeNull();
  });
});
