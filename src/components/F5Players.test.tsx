// @vitest-environment jsdom
// Phase F5 (UI redesign): My profile, Edit my profile and the Player page. The three real pages are rendered with their data
// libraries replaced by fixtures, so the page code (permissions, filters, scenarios) is what is tested.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureLines } from "@/components/F5.fixtures";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/profile", notFound: () => { throw new Error("NOT_FOUND"); } }));

const h = vi.hoisted(() => ({
  me: { id: "u1", name: "Ali Raza" },
  member: { role: "admin" as "admin" | "member", player_number: 7 as number | null },
  profile: { id: "u1", name: "Ali Raza", batting_hand: "right", batting_position: "opener", bowling_style: "right_medium", playing_role: "batter" } as Record<string, string | null>,
  player: null as null | Record<string, unknown>,
  token: null as string | null,
  lines: [] as unknown[],
  myCommunities: [] as unknown[],
  teams: [{ id: "t1", name: "Thunder Strikers" }] as { id: string; name: string }[],
  series: [] as { id: string; name: string }[],
  lastFilter: null as unknown,
  saveResult: { error: "" } as { error?: string; message?: string },
  saveCalls: 0,
  shareCalls: [] as string[],
  revoke: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireAcceptedUser: async () => h.me }));
vi.mock("@/lib/community", () => ({
  requireMember: async () => ({ community: { id: "c1", name: "Karachi Indoor Cricket Club" }, membership: h.member }),
  listMyCommunities: async () => h.myCommunities,
  isUuid: (s: string) => /^[0-9a-f-]{36}$/i.test(s),
}));
vi.mock("@/lib/profile", () => ({ getProfile: async () => h.profile, getPlayerInCommunity: async () => h.player }));
vi.mock("@/lib/profileShare", () => ({ profileShareToken: async () => h.token }));
vi.mock("@/lib/origin", () => ({ getOrigin: async () => "https://khelo.test" }));
vi.mock("@/lib/reports", () => ({ playerLines: async (_c: string, _u: string, f: unknown) => { h.lastFilter = f; return h.lines; } }));
vi.mock("@/lib/teams", () => ({ teamsOfPlayer: async () => h.teams, listTeams: async () => h.teams }));
vi.mock("@/lib/seriesDb", () => ({ listSeries: async () => h.series }));
vi.mock("@/app/actions3", () => ({ saveProfileAction: async () => { h.saveCalls++; return h.saveResult; } }));
vi.mock("@/app/actions8", () => ({ shareProfileAction: async (fd: FormData) => { h.shareCalls.push(String(fd.get("on"))); } }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signOut: (...a: unknown[]) => h.signOut(...a), revokeSessions: (...a: unknown[]) => h.revoke(...a) } }));

import { LOGOUT_ALL_ERROR, PfLogoutCard } from "@/components/PfAccount";
import PfFilterBar, { PfFilterFields, dateLabel, filterCount } from "@/components/PfFilters";
import { PfCareerStrip, PfDetails, PfInThisMatch, PfPlayerCard, careerTiles } from "@/components/PfParts";
import PfProfileForm, { isChoiceError } from "@/components/PfProfileForm";
import PfShare from "@/components/PfShare";
import PlayerStats from "@/components/PlayerStats";
import { SnackbarProvider } from "@/components/Snackbar";
import { careerOf } from "@/lib/career";

const UID_OTHER = "11111111-1111-1111-1111-111111111111";
const baseCss = () => ["src/app/globals.css", "src/components/shell.css", "src/components/pf.css"].map((f) => readFileSync(f, "utf8")).join("\n");

/** When F5_SHOTS_DIR is set, every rendered page is also written there as an HTML file for a visual check. */
function shot(name: string, html: string) {
  const dir = process.env.F5_SHOTS_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.html`, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${baseCss()}</style></head><body>${html}</body></html>`);
}

async function renderPage(mod: string, params: Record<string, string>, search: Record<string, string> = {}) {
  const page = (await import(/* @vite-ignore */ mod)).default as (p: unknown) => Promise<React.ReactElement>;
  const el = await page({ params: Promise.resolve(params), searchParams: Promise.resolve(search) });
  return renderToStaticMarkup(<SnackbarProvider>{el}</SnackbarProvider>);
}
const profilePage = (s: Record<string, string> = {}) => renderPage("@/app/c/[id]/profile/page", { id: "c1" }, s);
const editPage = () => renderPage("@/app/c/[id]/profile/edit/page", { id: "c1" });
const playerPage = (s: Record<string, string> = {}, userId = "u1") => renderPage("@/app/c/[id]/players/[userId]/page", { id: "c1", userId }, s);

const communities = [
  { id: "c1", name: "Karachi Indoor Cricket Club", role: "admin", status: "approved", player_number: 7 },
  { id: "c2", name: "Gulshan Friday Cricket", role: "member", status: "approved", player_number: 22 },
  { id: "c3", name: "DHA Office League", role: "member", status: "approved", player_number: 3 },
];

beforeEach(() => {
  h.me = { id: "u1", name: "Ali Raza" };
  h.member = { role: "admin", player_number: 7 };
  h.profile = { id: "u1", name: "Ali Raza", batting_hand: "right", batting_position: "opener", bowling_style: "right_medium", playing_role: "batter" };
  h.player = { id: "u1", name: "Ali Raza", batting_hand: "right", batting_position: "opener", bowling_style: "right_medium", playing_role: "batter", community_role: "admin", player_number: 7 };
  h.token = null;
  h.lines = fixtureLines(14);
  h.myCommunities = communities;
  h.teams = [{ id: "t1", name: "Thunder Strikers" }];
  h.series = [];
  h.saveResult = { error: "" };
  h.saveCalls = 0;
  h.shareCalls = [];
  h.revoke.mockReset();
  h.signOut.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* =============================== My profile =============================== */
describe("My profile page", () => {
  it("1: admin, details set, three communities, sharing off: card, career strip, details, share card, communities, links", async () => {
    const html = await profilePage();
    shot("my-profile-1", html);
    expect(html).toContain("Ali Raza (you)");
    expect(html).toContain("Admin · Number 7 · you");
    expect(html).toContain(">AR<");                                   // gold shirt, big, with initials
    expect(html).toContain("Karachi Indoor Cricket Club");           // top bar subtitle
    expect(html).toContain("Thunder Strikers");                       // team badge with name
    expect(html).toContain("pf-team mine");                           // my own team gets the gold ring
    expect(html).toContain("Career in this community");
    expect(html).toContain("Full stats");
    for (const w of ["Matches", "Runs", "Bat avg", "Wickets", "Economy", "Player of the Match"]) expect(html).toContain(w);
    expect(html).toContain("Player details");
    expect(html).not.toContain("Not set");
    expect(html).toContain("Share my profile");
    expect(html).toContain("Create a public link");
    expect(html).toContain("Nothing about payments");
    expect(html).toContain("My communities and numbers");
    expect(html).toContain("Gulshan Friday Cricket");
    expect(html).toContain("DHA Office League");
    expect(html).toContain("Community page");
    expect(html).toContain("Log out of all devices");
    expect(html).not.toContain("later build phases");                 // the outdated footer is gone
    expect(html).toContain("/c/c1/profile/edit");
    expect(html).toContain("/c/c1/profile/payments");
    expect(html).toContain("/c/c1/number");
    expect(html).toContain("/c/c1/players/u1");
  });
  it("a plain member sees the word Member, not Admin", async () => {
    h.member = { role: "member", player_number: 7 };
    const html = await profilePage();
    expect(html).toContain("Number 7 · you");
    expect(html).not.toContain("Admin · Number 7");
  });
  it("2: public sharing on: link box with Copy, Stop sharing in red (the confirm is tested below)", async () => {
    h.token = "abcdefghijklmnopqrstuv";
    const html = await profilePage();
    shot("my-profile-2", html);
    expect(html).toContain("https://khelo.test/p/abcdefghijklmnopqrstuv");
    expect(html).toContain(">On<");
    expect(html).toContain("Copy");
    expect(html).toContain("Stop sharing");
    expect(html).toContain("btn red");
    expect(html).not.toContain("Create a public link");
  });
  it("5: brand-new member: Add buttons, Role not set, Not in a team yet, Stats start here", async () => {
    h.profile = { id: "u1", name: "Hassan Javed", batting_hand: null, batting_position: null, bowling_style: null, playing_role: null };
    h.me = { id: "u1", name: "Hassan Javed" };
    h.member = { role: "member", player_number: 41 };
    h.lines = [];
    h.teams = [];
    h.myCommunities = [communities[0]];
    const html = await profilePage();
    shot("my-profile-5", html);
    expect(html).toContain("Role not set");
    expect(html).toContain("Not in a team yet");
    expect(html).toContain("Stats start here");
    expect(html).toContain("Runs, wickets and awards appear here after your first finished match.");
    expect((html.match(/pf-add/g) ?? []).length).toBe(4);              // one Add per blank detail
    expect(html).toContain('aria-label="Add playing role"');
    expect(html).not.toContain("Not set");
    expect(html).not.toContain("Full stats");
  });
});

describe("My profile: share card and log out", () => {
  const wrap = (ui: React.ReactElement) => render(<SnackbarProvider>{ui}</SnackbarProvider>);
  it("3: Stop sharing asks first (Keep sharing is the calm default) and only then submits the same action", async () => {
    const token = "abcdefghijklmnopqrstuv";
    wrap(<PfShare communityId="c1" token={token} origin="https://khelo.test" />);
    fireEvent.click(screen.getByRole("button", { name: /Stop sharing/ }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("Stop sharing your profile?");
    expect(dlg.textContent).toContain("https://khelo.test/p/abcdefghijklmnopqrstuv");
    expect(dlg.textContent).toContain("brand-new link");
    expect(screen.getByRole("button", { name: "Keep sharing" })).toBeTruthy();
    expect(h.shareCalls).toEqual([]);                                  // nothing happens before the confirm
    fireEvent.click(screen.getByRole("button", { name: "Keep sharing" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(h.shareCalls).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /Stop sharing/ }));
    const confirm = screen.getAllByRole("button", { name: "Stop sharing" }).find((b) => dlg.ownerDocument.querySelector(".dlg")?.contains(b))!;
    await act(async () => { fireEvent.click(confirm); });
    await waitFor(() => expect(h.shareCalls).toEqual(["0"]));
  });
  it("4: Copy turns green with a tick and a snackbar says what happened; a refused copy says Select and copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wrap(<PfShare communityId="c1" token="abcdefghijklmnopqrstuv" origin="https://khelo.test" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy" })); });
    expect(writeText).toHaveBeenCalledWith("https://khelo.test/p/abcdefghijklmnopqrstuv");
    expect(screen.getByRole("button", { name: "Copied" }).className).toContain("done");
    expect(document.body.textContent).toContain("Link copied");
    writeText.mockRejectedValue(new Error("no"));
    cleanup();
    wrap(<PfShare communityId="c1" token="abcdefghijklmnopqrstuv" origin="https://khelo.test" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy" })); });
    expect(screen.getByRole("button", { name: /Select and copy/ })).toBeTruthy();
  });
  it("off: Create a public link posts on=1", async () => {
    wrap(<PfShare communityId="c1" token={null} origin="https://khelo.test" />);
    expect(document.body.textContent).toContain("Off. Nobody outside the app can see your profile.");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Create a public link/ })); });
    await waitFor(() => expect(h.shareCalls).toEqual(["1"]));
  });
  it("6: Log out of all devices failed (offline): red banner with the real message, button works again", async () => {
    h.revoke.mockRejectedValue(new Error("offline"));
    render(<PfLogoutCard />);
    const btn = screen.getByRole("button", { name: "Log out of all devices" });
    await act(async () => { fireEvent.click(btn); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(LOGOUT_ALL_ERROR);
    expect(alert.textContent).toContain("Please check your internet and try again.");
    expect((screen.getByRole("button", { name: "Log out of all devices" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

/* =============================== Edit my profile =============================== */
describe("Edit my profile", () => {
  type Prof = Parameters<typeof PfProfileForm>[0]["profile"];
  const draw = (profile: Prof = h.profile as Prof) =>
    render(<PfProfileForm communityId="c1" profile={profile} number={7} adminLabel="Admin · " teams={[{ id: "t1", name: "Thunder Strikers", mine: true }]} />);

  it("page: owner-only, loads my own profile, Cancel and Save, number note", async () => {
    const html = await editPage();
    shot("edit-1", html);
    expect(html).toContain("Edit profile");
    expect(html).toContain("Save profile");
    expect(html).toContain("Cancel");
    expect(html).toContain("Only you can change this. Career stats cannot be edited by anyone: they come only from matches scored in the app.");
    expect(html).toContain("/c/c1/number");
    expect(html).toContain("This is the name every member sees.");
    expect(html).toContain("8/60");
  });
  it("1: the four choices are single-choice chips with a visible Not set, the right one selected", () => {
    draw();
    for (const [group, selected, count] of [["Playing role", "Batter", 5], ["Batting hand", "Right-hand", 3], ["Batting position", "Opener", 5], ["Bowling style", "Right-arm medium", 8]] as const) {
      const g = screen.getByRole("radiogroup", { name: group });
      const radios = g.querySelectorAll<HTMLInputElement>("input[type=radio]");
      expect(radios.length).toBe(count);                                // options plus Not set
      expect(g.textContent).toContain("Not set");
      expect(Array.from(radios).filter((r) => r.checked).map((r) => r.parentElement!.textContent)).toEqual([selected]);
    }
  });
  it("one tap changes a choice and the live preview follows; the counter follows the name", () => {
    const { container } = draw();
    fireEvent.click(screen.getByLabelText("Bowler"));
    expect(container.querySelector<HTMLInputElement>("input[name=playingRole]:checked")!.value).toBe("bowler");
    const preview = screen.getByLabelText("Preview of your player card");
    expect(preview.textContent).toContain("Bowler");
    expect(preview.textContent).not.toContain("Batter");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ali R" } });
    expect(screen.getByText("5/60")).toBeTruthy();
    expect(preview.textContent).toContain("Ali R");
    // Not set is a real option
    const notSet = container.querySelector<HTMLInputElement>('input[name=battingHand][value=""]')!;
    fireEvent.click(notSet);
    expect(notSet.checked).toBe(true);
  });
  it("the box refuses a 61st letter and the counter reads 60/60", () => {
    draw({ ...(h.profile as Prof), name: "A".repeat(60) });
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    expect(input.maxLength).toBe(60);
    expect(screen.getByText("60/60").className).toContain("max");
  });
  it("2 and 3: a name error sits on the field (red box, alert icon, same message under it)", async () => {
    for (const msg of ["Please enter your name.", "Your name can be at most 60 characters."]) {
      cleanup();
      h.saveResult = { error: msg };
      const { container } = draw({ ...(h.profile as Prof), name: "" });
      await act(async () => { fireEvent.submit(container.querySelector("form")!); });
      const err = await screen.findByText(msg);
      expect(err.closest("p")!.getAttribute("role")).toBe("alert");
      expect(container.querySelector(".pf-namebox")!.className).toContain("bad");
      expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
      expect(container.querySelector(".pf-fail")).toBeNull();
    }
  });
  it("7: a choice not on the list is a red banner with the way out, the name is not marked", async () => {
    h.saveResult = { error: "Please choose a playing role from the list." };
    const { container } = draw();
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const banner = await screen.findByText("Please choose a playing role from the list.");
    expect(banner.closest(".banner")!.getAttribute("role")).toBe("alert");
    expect(container.querySelector(".pf-namebox")!.className).not.toContain("bad");
    expect(isChoiceError("Please choose a bowling style from the list.")).toBe(true);
    expect(isChoiceError("Please enter your name.")).toBe(false);
  });
  it("5: saved: the real message in a green banner, the form stays and keeps what was typed", async () => {
    h.saveResult = { message: "Profile saved." };
    const { container } = draw();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ali Raza Khan" } });
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const banner = (await screen.findByText("Profile saved.")).closest(".banner")!;
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.textContent).toContain("Your changes are live for every member.");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Ali Raza Khan");
    expect(h.saveCalls).toBe(1);
  });
  it("4: while saving the button is disabled and says Saving…", async () => {
    let release: () => void = () => {};
    h.saveResult = { message: "Profile saved." };
    const mod = await import("@/app/actions3");
    vi.spyOn(mod, "saveProfileAction").mockImplementation(() => new Promise((r) => { release = () => r({ message: "Profile saved." }); }));
    const { container } = draw();
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const btn = screen.getByRole("button", { name: /Saving…/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await act(async () => { release(); });
  });
  it("6: first time, nothing chosen: Not set is the selected chip in every group", () => {
    const { container } = draw({ name: "Hassan Javed", batting_hand: null, batting_position: null, bowling_style: null, playing_role: null });
    for (const n of ["playingRole", "battingHand", "battingPosition", "bowlingStyle"]) {
      expect(container.querySelector<HTMLInputElement>(`input[name=${n}]:checked`)!.value).toBe("");
    }
    expect(screen.getByLabelText("Preview of your player card").textContent).toContain("Role not set");
  });
  it("the form posts the same field names as before", () => {
    const { container } = draw();
    const names = Array.from(container.querySelectorAll("input")).map((i) => i.getAttribute("name"));
    for (const n of ["communityId", "name", "playingRole", "battingHand", "battingPosition", "bowlingStyle"]) expect(names).toContain(n);
  });
});

/* =============================== Player page =============================== */
const stripText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Player page", () => {
  it("1: my own page, Overview: card, pencil, career strip, filter chips, segmented tabs, Edit button; no Manage", async () => {
    const html = await playerPage();
    shot("player-1-overview", html);
    expect(html).toContain("My stats");
    expect(html).toContain("How other members see me");
    expect(html).toContain("Ali Raza (you)");
    expect(html).toContain("Admin · Number 7");
    expect(html).toContain('aria-label="Edit my profile"');            // the pencil
    expect(html).toContain("Edit my profile</a>");                     // and the button at the end
    expect(html).not.toContain("Manage this member");
    expect(html).toContain("Career in this community");
    expect(html).toContain("pf-tabs");
    for (const t of ["Overview", "Batting", "Bowling", "Fielding", "Matches"]) expect(html).toContain(`>${t}</a>`);
    expect(html).toContain('aria-current="page">Overview');
    expect(html).toContain("This community");
    expect(html).toContain("Any team");
    expect(html).toContain("Last 5 innings");
    expect(html).toContain("Awards");
    expect(html).toContain("Recent matches");
    expect(html).toContain("All matches");
    expect(html).toContain("WON");
    expect(html).toContain("Analytics");
    expect(html).toContain("/c/c1/players/u1/analytics");
    expect(html).toContain("What the numbers mean");
    expect(html).not.toContain("<details open");                       // help is closed by default
  });
  it("career strip: six tiles worked out by careerOf", () => {
    const c = careerOf(fixtureLines(14));
    const tiles = careerTiles(c);
    expect(tiles.map((t) => t.label)).toEqual(["Matches", "Runs", "Bat avg", "Wickets", "Economy", "Player of the Match"]);
    expect(tiles[0]!.value).toBe("14");
    expect(tiles[0]!.sub).toBe(`${c.record.won} won`);
    expect(tiles[1]!.value).toBe(String(c.batting.runs));
    expect(tiles[1]!.sub).toMatch(/^HS \d+\*?$/);
    expect(tiles[2]!.value).toBe((c.batting.average as number).toFixed(2));
    expect(tiles[3]!.sub).toMatch(/^Best \d+\/\d+$/);
    expect(tiles[5]!.value).toBe(String(c.awards.count));
    expect(tiles[5]!.sub).toBe(`${c.awards.points} pts`);
    const none = careerTiles(careerOf([]));
    expect(none[2]!.value).toBe("–");                                  // dashes stay honest with no data
    expect(none[2]!.sub).toBe("– SR");
    expect(none[4]!.value).toBe("–");
    const html = renderToStaticMarkup(<PfCareerStrip career={c} title="Career" fullHref="/x" />);
    expect(html).toContain('class="pf-tile hi"');                       // runs and wickets are highlighted
  });
  it("2: another member viewed by an Admin: no pencil, no Edit, Manage link plus the menu item", async () => {
    h.player = { id: UID_OTHER, name: "Hamza Khan", batting_hand: "left", batting_position: "middle_order", bowling_style: "left_spin", playing_role: "all_rounder", community_role: "member", player_number: 10 };
    h.teams = [{ id: "t2", name: "Royal Panthers" }];
    const html = await playerPage({}, UID_OTHER);
    shot("player-2-admin", html);
    expect(html).toContain("Hamza Khan");
    expect(html).toContain("Number 10");
    expect(html).not.toContain("(you)");
    expect(html).not.toContain("Edit my profile");
    expect(html).toContain("Manage this member (Admin)");
    expect(html).toContain(`/c/c1/members/${UID_OTHER}`);
    expect(html).toContain("More about this member");                  // the kebab, with a text label
    expect(html).toContain("Royal Panthers");
    expect(html).toContain("/c/c1/teams/t2");
    expect(html).not.toMatch(/(owes|unpaid|paid)/i);              // payment status is never shown here
  });
  it("4: a plain member sees neither Edit nor Manage", async () => {
    h.member = { role: "member", player_number: 3 };
    h.me = { id: "u9", name: "Sara" };
    h.player = { id: UID_OTHER, name: "Hamza Khan", batting_hand: "left", batting_position: null, bowling_style: null, playing_role: "all_rounder", community_role: "member", player_number: 10 };
    const html = await playerPage({ tab: "bowling" }, UID_OTHER);
    shot("player-4-bowling", html);
    expect(html).not.toContain("Edit my profile");
    expect(html).not.toContain("Manage this member");
    expect(html).toContain("Wickets by type");
    expect(html).toContain("pf-hbars");
    expect(html).toContain("pf-gauge");                                 // dot-ball gauge
    expect(html).toContain("Best figures");
    expect(html).toContain("Worst economy");
  });
  it("3: Batting tab: run mix as one bar with a counted legend, how out as bars, partnership callout, last innings", async () => {
    const html = await playerPage({ tab: "batting" });
    shot("player-3-batting", html);
    expect(html).toContain("How the runs were scored");
    expect(html).toContain("stackedbar");
    const c = careerOf(fixtureLines(14));
    for (const [l, v] of [["Dots", c.batting.dots], ["Singles", c.batting.singles], ["Fours", c.batting.fours], ["Sixes", c.batting.sixes]] as const) {
      expect(stripText(html)).toContain(`${l} ${v}`);
    }
    expect(html).toContain("How out");
    expect(html).toContain("Hit wicket");
    expect(html).toContain("Retired out");
    expect(html).toContain("Best partnership: 54 runs");
    expect(html).toContain("31 balls with Zain Malik");
    expect(html).toContain("Golden ducks");
    expect(html).toContain("Best strike rate (6+ balls)");
  });
  it("5: Fielding tab: tiles, the blue note, help block is a closed accordion with the eight definitions", async () => {
    const html = await playerPage({ tab: "fielding" });
    shot("player-5-fielding", html);
    expect(html).toContain("Fielding counts only where the scorer named the fielder. Dropped catches and misfields are not recorded.");
    expect(html).toContain("pf-note");
    expect(html).toContain("Matches with a fielder recorded");
    expect(html).toContain("<details class=\"pf-help\">");
    expect((html.match(/<details[\s\S]*?<\/details>/)![0].match(/<li>/g) ?? []).length).toBe(8);
  });
  it("6: Matches tab: team record bar with legend, one-line rows with result words, wore #, count shown, segmented filter", async () => {
    const html = await playerPage({ tab: "matches" });
    shot("player-6-matches", html);
    expect(html).toContain("Team record while this player played");
    expect(html).toContain("pf-record");
    expect(stripText(html)).toMatch(/Won \d+/);
    expect(html).toContain("Every match");
    expect(html).toContain("14 shown");
    expect(html).toContain("wore #7");
    expect(html).toContain("wore #12");                                // a past match keeps the number used at the time
    expect(html).toContain("WON");
    expect(html).toContain("LOST");
    expect(html).toContain("TIED");
    expect(html).toContain("Player of the Match");
    expect(html).toContain("tab=matches&amp;lines=bat");
    expect(html).toContain("All lines");
  });
  it("7: Matches tab filtered to Batting: the match where the player did not bat is hidden and the count says so", async () => {
    const html = await playerPage({ tab: "matches", lines: "bat" });
    shot("player-7-batting-lines", html);
    expect(html).toContain("13 shown");                                // 14 matches, one without a batting line
    expect(html).not.toContain("did not bowl");
    const bowl = await playerPage({ tab: "matches", lines: "bowl" });
    expect(bowl).toContain("7 shown");
    expect(bowl).not.toContain("did not bat");
  });
  it("8: opened from a scorecard: the gold In this match card is first, with four tiles and a link back", async () => {
    const lines = fixtureLines(14);
    h.lines = lines;
    const target = lines[8]!;
    target.matchId = "22222222-2222-2222-2222-222222222222";
    const html = await playerPage({ match: target.matchId });
    shot("player-8-in-this-match", html);
    const i = html.indexOf("In this match"), j = html.indexOf("Career in this community");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(j);                                         // above the career strip
    expect(html).toContain(`/c/c1/matches/${target.matchId}/report`);
    expect(html).toContain("Open the match");
    expect(html).toContain("wore #7");
    for (const t of ["Batting", "Bowling", "Fielding", "Player of the Match points"]) expect(html).toContain(t);
    expect(html).toContain("Career figures are below.");
  });
  it("9: a guest linked afterwards (no number worn): no fake number, did not bat, bowled 1/24, dashes stay honest", async () => {
    const guest = { ...fixtureLines(1)[0]!, matchId: "33333333-3333-3333-3333-333333333333", numberUsed: null, bat: [], pom: false, points: 9, result: "win" as const, field: { catches: 0, caughtBowled: 0, stumpings: 0, runOuts: 0 },
      bowl: [{ innings: 1, balls: 12, runs: 24, wickets: 1, maidens: 0, dots: 2, wides: 0, noballs: 0, freeHits: 0, fours: 1, sixes: 0, byType: { bowled: 1, caught: 0, caughtBowled: 0, lbw: 0, stumped: 0, hit_wicket: 0 }, hatTrick: false }] };
    h.lines = [guest];
    const html = await playerPage({ match: guest.matchId });
    shot("player-9-guest", html);
    const hero = html.slice(html.indexOf("pf-hero"), html.indexOf("Career in this community"));
    expect(hero).not.toContain("wore #");
    expect(hero).toContain("joined the community after this match");
    expect(hero).toContain("did not bat");
    expect(hero).toContain("1/24");
    expect(hero).toContain("2.0 ov");
    expect(html).toContain("12.00");                                    // economy
    expect(stripText(html)).toContain("– SR");
  });
  it("10: filters applied with results: gold chips say what is applied, Clear all, count on Filters, same address parameters", async () => {
    h.series = [{ id: "s1", name: "Winter Cup 2026" }];
    const html = await playerPage({ scope: "all", team: "t1", series: "s1", from: "2026-09-01", to: "2026-11-22" });
    shot("player-10-filters", html);
    expect(h.lastFilter).toEqual({ allCommunities: true, teamId: "t1", from: "2026-09-01", to: "2026-11-22", seriesId: "s1" });
    expect(html).toContain("Filters · 4");
    expect(html).toContain("All communities");
    expect(html).toContain("Thunder Strikers");
    expect(html).toContain("Winter Cup 2026");
    expect(html).toContain("1 Sep 2026 to 22 Nov 2026");
    expect(html).toContain("Clear all");
    expect(html).toContain("/c/c1/players/u1?tab=overview");           // clear link keeps only the tab
    expect(html).toContain("scope=all&amp;team=t1&amp;series=s1&amp;from=2026-09-01&amp;to=2026-11-22&amp;tab=batting");
    expect(html).toContain('id="pfp-series"');                          // the desktop panel has the full form, with Series because the community has one
  });
  it("no filters: Clear all is not shown; Series field only when the community has a series", async () => {
    const html = await playerPage();
    expect(html).not.toContain("pf-fchip clear");                    // no red chip when no filter is on
    expect(html).not.toContain('id="pfp-series"');
    expect(html).toContain('id="pfp-scope"');
    expect(html).toContain('id="pfp-from"');
  });
  it("11: filters applied, no matches: its own Clear filters button, chips stay, tabs and analytics are hidden", async () => {
    h.lines = [];
    const html = await playerPage({ team: "t1", from: "2026-12-01", to: "2026-12-31" });
    shot("player-11-filtered-empty", html);
    expect(html).toContain("No matches for these filters");
    expect(html).toContain("Try clearing a filter.");
    expect(html).toContain("Clear filters");
    expect(html).toContain("Filters · 2");
    expect(html).not.toContain("pf-tabs");
    expect(html).not.toContain("analytics");
    expect(html).not.toContain("Career in this community");
  });
  it("12: new player with zero matches: Stats start here, Role not set, Not in a team yet, no dead controls", async () => {
    h.lines = [];
    h.teams = [];
    h.player = { id: "u1", name: "Hassan Javed", batting_hand: null, batting_position: null, bowling_style: null, playing_role: null, community_role: "member", player_number: 41 };
    const html = await playerPage();
    shot("player-12-new", html);
    expect(html).toContain("Stats start here");
    expect(html).toContain("Records build only from matches scored in Indoor Khelo. Nothing is added by hand.");
    expect(html).toContain("Role not set");
    expect(html).toContain("Not in a team yet");
    expect(html).not.toContain("pf-tabs");
    expect(html).not.toContain("/analytics");
    expect(html).not.toContain("pf-tile");
    expect(html).toContain("What the numbers mean");
  });
  it("13: the filters open in a sheet on a phone, same fields, big Apply and Cancel", async () => {
    render(<PfFilterBar tab="batting" state={{ allCommunities: false, teamId: null, seriesId: null, from: null, to: null }} teams={[{ id: "t1", name: "Thunder Strikers" }]} series={[{ id: "s1", name: "Winter Cup" }]} clearHref="/x" />);
    expect(screen.queryByRole("dialog")).toBeNull();                    // closed until asked for
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    const dlg = screen.getByRole("dialog");
    expect(dlg.textContent).toContain("Where");
    expect(dlg.querySelector<HTMLInputElement>("input[name=tab]")!.value).toBe("batting");
    for (const n of ["scope", "team", "series", "from", "to"]) expect(dlg.querySelector(`[name=${n}]`)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeTruthy();
    expect((dlg.querySelector("form") as HTMLFormElement).method).toBe("get");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();                    // Escape closes it
  });
  it("filter helpers", () => {
    expect(dateLabel("2026-09-01")).toBe("1 Sep 2026");
    expect(filterCount({ allCommunities: true, teamId: "t", seriesId: null, from: "2026-01-01", to: "2026-02-01" })).toBe(3);
    const html = renderToStaticMarkup(<PfFilterFields prefix="x" tab="overview" state={{ allCommunities: false, teamId: null, seriesId: null, from: null, to: null }} teams={[]} series={[]} clearHref="/c" />);
    expect(html).not.toContain("Series");
  });
  it("a stranger id is not found", async () => {
    h.player = null;
    await expect(playerPage({}, UID_OTHER)).rejects.toThrow("NOT_FOUND");
  });
});

/* =============================== parts =============================== */
describe("player card parts", () => {
  it("the card uses the gold shirt with the number and initials (never a plain avatar), grey shirt if there is no number", () => {
    const a = renderToStaticMarkup(<PfPlayerCard communityId="c1" name="Ali Raza" number={7} role="Batter" hand={null} position={null} bowling={null} teams={[]} />);
    expect(a).toContain("#F5C84B");
    expect(a).toContain(">7<");
    expect(a).toContain(">AR<");
    expect(a).toContain("Not in a team yet");
    const b = renderToStaticMarkup(<PfPlayerCard communityId="c1" name="Zain Ahmed" number={null} role={null} hand={null} position={null} bowling={null} teams={[]} />);
    expect(b).toContain("#8A97B5");
    expect(b).toContain("Role not set");
    expect(b).not.toContain("Edit my profile");                          // no pencil unless an edit link is given
  });
  it("teams are TeamBadge initials with the name, linked; only my team has the ring", () => {
    const html = renderToStaticMarkup(<PfPlayerCard communityId="c1" name="Ali" number={1} role="Batter" hand={null} position={null} bowling={null} teams={[{ id: "t1", name: "Thunder Strikers", mine: true }, { id: "t2", name: "Blue Hawks" }]} />);
    expect(html).toContain("team-badge");
    expect(html).toContain("/c/c1/teams/t1");
    expect((html.match(/pf-team mine/g) ?? []).length).toBe(1);
  });
  it("details: blank rows get an Add link to the edit page, set rows show the value", () => {
    const html = renderToStaticMarkup(<PfDetails rows={[["Playing role", "Batter"], ["Batting hand", null]]} editHref="/c/c1/profile/edit" />);
    expect(html).toContain("Batter");
    expect(html).toContain('aria-label="Add batting hand"');
    expect(html).not.toContain('aria-label="Add playing role"');
    expect(html).toContain('aria-label="Edit player details"');
  });
  it("In this match shows 'wore #' only when a number was worn", () => {
    const l = fixtureLines(2)[0]!;
    expect(renderToStaticMarkup(<PfInThisMatch communityId="c1" line={l} />)).toContain("wore #7");
    expect(renderToStaticMarkup(<PfInThisMatch communityId="c1" line={{ ...l, numberUsed: null }} />)).not.toContain("wore #");
  });
  it("PlayerStats keeps its props: the summary tiles and the help are still there by default", () => {
    const c = careerOf(fixtureLines(3));
    const html = renderToStaticMarkup(<PlayerStats c={c} lines={fixtureLines(3)} tab="overview" base="/c/c1/players/u" linesFilter="all" communityId="c1" />);
    expect(html).toContain("Last ");
    expect(html).toContain("What the numbers mean");
    expect(html).not.toContain("pf-analytics");
  });
});
