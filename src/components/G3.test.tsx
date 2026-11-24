// @vitest-environment jsdom
// Phase G3 (UI redesign): Account, You are offline, App banners (PwaShell) and the public shareable profile.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { careerOf, type MatchLine } from "@/lib/career";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/home", notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/outbox", () => ({ flushAllWaiting: vi.fn() }));

const h = vi.hoisted(() => ({
  user: { id: "u1", name: "Hamza Khan" },
  plan: { blockers: [] as { id: string; name: string }[], willDelete: [] as { id: string; name: string }[], willLeave: [{ id: "c1", name: "Karachi Indoor Cricket Club" }, { id: "c2", name: "Clifton Office League" }] },
  deleteData: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn(),
  revoke: vi.fn(),
  profile: null as null | Record<string, unknown>,
}));
vi.mock("@/lib/session", () => ({ requireAcceptedUser: async () => h.user }));
vi.mock("@/lib/management", () => ({ accountPlan: async () => h.plan }));
vi.mock("@/app/actions2", () => ({ deleteAccountDataAction: () => h.deleteData() }));
vi.mock("@/lib/auth/client", () => ({ authClient: { deleteUser: () => h.deleteUser(), signOut: () => h.signOut(), revokeSessions: () => h.revoke() } }));
vi.mock("@/lib/profileShare", () => ({ publicProfile: async () => h.profile }));

import AccountPage from "@/app/account/page";
import OfflinePage from "@/app/offline/page";
import PublicProfilePage from "@/app/p/[token]/page";
import ProfileLinkNotWorking from "@/app/p/[token]/not-found";
import AcOfflineRetry from "@/components/AcOfflineRetry";
import PublicProfileView from "@/components/PublicProfileView";
import PwaShell from "@/components/PwaShell";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function accountHtml() { return renderToStaticMarkup(await AccountPage()); }

/* ------------------------------------------------------------------ Account */
describe("Account page", () => {
  beforeEach(() => {
    h.plan = { blockers: [], willDelete: [], willLeave: [{ id: "c1", name: "Karachi Indoor Cricket Club" }, { id: "c2", name: "Clifton Office League" }] };
    h.deleteData.mockReset(); h.deleteUser.mockReset(); h.signOut.mockReset(); h.revoke.mockReset();
    h.deleteData.mockResolvedValue({}); h.deleteUser.mockResolvedValue({}); h.signOut.mockResolvedValue({}); h.revoke.mockResolvedValue({});
  });
  async function open() { const { container } = render(await AccountPage()); return container; }

  it("1. shows three zones: profile (gold shirt, no number), Sessions, red Danger zone, with chips for what you will leave", async () => {
    const html = await accountHtml();
    expect(html).toContain("Hamza Khan");
    expect(html).toContain("Signed in with Google. Your email is private and used only to sign you in.");
    expect(html).toContain("Sessions");
    expect(html).toContain("Ends every session on every phone and computer, including this one.");
    expect(html).toContain("Delete my account");
    expect(html).toContain("Karachi Indoor Cricket Club");
    expect(html).toContain("Clifton Office League");
    expect(html).toContain("You will leave:");
    expect(html).toContain("shirt");                       // the player is a shirt, never an initials circle
    expect(html).toContain("No player number, HK");        // grey shirt (no community open), two initials
    expect(html).not.toContain("Choose a new Admin");
  });

  it("1. 'Log out' is the normal button and 'Log out of all devices' the quieter one", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Log out" }).className).toContain("ghost");
    expect(screen.getByRole("button", { name: "Log out of all devices" }).className).toContain("ac-lessbtn");
  });

  it("2. the only Admin of a community with members: blocker rows open its leave page, the box and the button are disabled", async () => {
    h.plan = { blockers: [{ id: "c9", name: "Karachi Indoor Cricket Club" }], willDelete: [], willLeave: [{ id: "c2", name: "Clifton Office League" }] };
    const c = await open();
    expect(c.textContent).toContain("You are the only Admin of Karachi Indoor Cricket Club, which still has members.");
    expect(c.textContent).toContain("Make someone else Admin first (Community page, Manage members), or delete that community.");
    const link = screen.getByRole("link", { name: /Karachi Indoor Cricket Club/ });
    expect(link.getAttribute("href")).toBe("/c/c9/leave");
    expect(c.textContent).toContain("Choose a new Admin or delete it");
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Delete my account" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(h.deleteData).not.toHaveBeenCalled();
  });

  it("3. a community with only you in it is a red banner naming it", async () => {
    h.plan = { blockers: [], willDelete: [{ id: "c3", name: "Night Cricket Friends" }], willLeave: [{ id: "c1", name: "Karachi Indoor Cricket Club" }] };
    const c = await open();
    expect(c.textContent).toContain("These communities will be deleted too");
    expect(c.textContent).toContain("These communities have only you in them, so they will be deleted too: Night Cricket Friends.");
    expect(c.querySelector(".ac-note.red")).not.toBeNull();
  });

  it("4. nothing is deleted until the box is ticked; ticking turns the row gold and arms the red button", async () => {
    const c = await open();
    const btn = screen.getByRole("button", { name: "Delete my account" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(c.querySelector(".ac-confirm.on")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(c.querySelector(".ac-confirm.on")).not.toBeNull();
    expect(btn.disabled).toBe(false);
    expect(btn.className).toContain("armed");
    expect(h.deleteData).not.toHaveBeenCalled();
  });

  it("5. Deleting shows a spinner and blocks a second tap; then data, sign-in record, sign out, home", async () => {
    let finish: (v: unknown) => void = () => {};
    h.deleteData.mockReturnValue(new Promise((r) => { finish = r; }));
    const hrefs: string[] = [];
    const loc = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...loc, set href(v: string) { hrefs.push(v); }, get href() { return "http://localhost/account"; } } });
    const c = await open();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    const busy = await screen.findByRole("button", { name: "Deleting…" }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(c.querySelector(".ac-spin")).not.toBeNull();
    fireEvent.click(busy);
    expect(h.deleteData).toHaveBeenCalledTimes(1);
    await act(async () => { finish({}); });
    await waitFor(() => expect(h.signOut).toHaveBeenCalled());
    expect(h.deleteUser).toHaveBeenCalled();
    await waitFor(() => expect(hrefs).toContain("/"));
    Object.defineProperty(window, "location", { configurable: true, value: loc });
  });

  it("6. a refused delete (became only Admin meanwhile) is an error banner above the button; the button works again", async () => {
    h.deleteData.mockResolvedValue({ error: "You are now the only Admin of a community with members." });
    const c = await open();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("You are now the only Admin of a community with members.");
    expect(alert.className).toContain("red");
    const btn = screen.getByRole("button", { name: "Delete my account" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(h.deleteUser).not.toHaveBeenCalled();
    expect(c.querySelector(".ac-note.red .ac-ic")).not.toBeNull();
  });

  it("7. data deleted but the Google record stays: blue information banner with the same wording and a gold Done button", async () => {
    h.deleteUser.mockResolvedValue({ error: { message: "nope" } });
    const c = await open();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    await screen.findByRole("link", { name: "Done" });
    expect(c.querySelector(".ac-note.blue")?.textContent).toContain("Your data in Indoor Khelo is removed and you are signed out. Your Google sign-in record could not be deleted automatically, so it will be removed by hand. If you sign in again, you start fresh.");
    expect(screen.getByRole("link", { name: "Done" }).className).toContain("gold");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(h.signOut).toHaveBeenCalled();
  });

  it("8. log out of all devices failing (offline) shows the real sentence in an offline-icon banner inside Sessions", async () => {
    h.revoke.mockRejectedValue(new Error("offline"));
    const c = await open();
    fireEvent.click(screen.getByRole("button", { name: "Log out of all devices" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not log out of all devices. Please check your internet and try again.");
    expect(c.querySelector(".ac-zone:not(.danger) .ac-note.red")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Log out of all devices" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("8. log out of all devices also fails when the service answers with an error", async () => {
    h.revoke.mockResolvedValue({ error: { message: "x" } });
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Log out of all devices" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not log out of all devices");
  });

  it("9. Log out shows a spinner, clears the cached pages first, signs out and goes to /", async () => {
    const postMessage = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: async () => ({ active: { postMessage } }) } });
    let finish: (v: unknown) => void = () => {};
    h.signOut.mockReturnValue(new Promise((r) => { finish = r; }));
    const hrefs: string[] = [];
    const loc = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...loc, set href(v: string) { hrefs.push(v); }, get href() { return "http://localhost/account"; } } });
    const c = await open();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    const busy = await screen.findByRole("button", { name: "Signing out…" }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(c.querySelector(".ac-spin")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Log out of all devices" }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_PAGES" }));
    await act(async () => { finish({}); });
    await waitFor(() => expect(hrefs).toContain("/"));
    Object.defineProperty(window, "location", { configurable: true, value: loc });
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
  });
});

/* ------------------------------------------------------------------ You are offline */
describe("You are offline page", () => {
  it("1. is calm, lists what works and what needs internet, and uses only inline icons and CSS", () => {
    const html = renderToStaticMarkup(<OfflinePage />);
    expect(html).toContain("You are offline");
    expect(html).toContain("This page could not load without internet. Your saved data is safe on this phone.");
    for (const t of ["Works offline", "Scoring a match, and undo", "Squads, scorecards and stats you opened before", "Creating a quick match", "Recording a cash payment",
      "Needs internet", "Signing in for the first time", "Joining a community", "Seeing live scores from other phones"]) expect(html).toContain(t);
    expect(html).toContain("Indoor Khelo reconnects by itself when the signal is back.");
    expect(html).toContain("Try again");
    // no new network-only assets: no images, no scripts of its own, no stylesheets, no web fonts, no external urls
    expect(html).not.toMatch(/<img|<link|@import|https?:\/\//);
    expect(html).toContain("<style>");                     // its styles travel inside the page the service worker keeps
    expect(html).toContain("<svg");
  });

  it("2. 'Try again' is a real link (works with no script) and, with no signal, says so instead of reloading", () => {
    const { container } = render(<AcOfflineRetry />);
    const a = screen.getByRole("link", { name: "Try again" });
    expect(a.getAttribute("href")).toBe("/");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent.click(a);
    expect(container.textContent).toContain("Still no signal. We will try again when it is back.");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("2. tries by itself when the signal comes back", () => {
    const reload = vi.fn();
    const loc = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...loc, pathname: "/c/x/matches", reload } });
    render(<AcOfflineRetry />);
    window.dispatchEvent(new Event("online"));
    expect(reload).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, "location", { configurable: true, value: loc });
  });
});

/* ------------------------------------------------------------------ App banners */
const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
function setUa(ua: string) { Object.defineProperty(navigator, "userAgent", { configurable: true, value: ua }); }
function setOnline(v: boolean) { Object.defineProperty(navigator, "onLine", { configurable: true, value: v }); }

describe("App banners (PwaShell)", () => {
  const ua0 = navigator.userAgent;
  beforeEach(() => {
    setUa(ua0); setOnline(true);
    try { localStorage.clear(); } catch { /* ignore */ }
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { cleanup(); setUa(ua0); setOnline(true); delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker; });

  it("renders nothing when online, up to date and not installable", () => {
    const { container } = render(<PwaShell />);
    expect(container.querySelector(".ac-toast")).toBeNull();
  });

  it("1. offline: a neutral toast with an offline icon (not a gold error bar), then it goes away when the signal returns", () => {
    setOnline(false);
    const { container } = render(<PwaShell />);
    const t = screen.getByText("You are offline").closest(".ac-toast") as HTMLElement;
    expect(t.textContent).toContain("Your saved data is safe on this phone. Some things need internet.");
    expect(container.querySelector(".ac-tic.orange svg")).not.toBeNull();
    expect(container.querySelector(".banner")).toBeNull();
    act(() => { setOnline(true); window.dispatchEvent(new Event("online")); });
    expect(screen.queryByText("You are offline")).toBeNull();
  });

  function stubWorker(waiting: boolean) {
    const post = vi.fn();
    const listeners: Record<string, () => void> = {};
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        register: async () => ({ waiting: waiting ? { postMessage: post } : null, addEventListener() {} }),
        addEventListener: (n: string, f: () => void) => { listeners[n] = f; },
        removeEventListener() {},
      },
    });
    return post;
  }

  it("2. new version: reassurance line and a 44px primary Refresh button that sends SKIP_WAITING", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const post = stubWorker(true);
    render(<PwaShell />);
    expect(await screen.findByText("New version is ready")).toBeTruthy();
    expect(screen.getByText("Refresh to update. Your saved data is kept.")).toBeTruthy();
    const btn = screen.getByRole("button", { name: "Refresh" });
    expect(btn.className).toContain("gold");
    fireEvent.click(btn);
    expect(post).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  function installEvent() {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = vi.fn().mockResolvedValue(undefined);
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    return e;
  }

  it("3. install available: app icon card with two equal buttons; Install prompts, Not now hides it for 14 days", async () => {
    const { container } = render(<PwaShell />);
    const e = installEvent();
    act(() => { window.dispatchEvent(e); });
    expect(screen.getByText("Install Indoor Khelo")).toBeTruthy();
    expect(screen.getByText("Add it to your home screen. It opens full screen and works offline.")).toBeTruthy();
    expect(container.querySelector("img.ac-appicon")?.getAttribute("src")).toBe("/icons/icon-192.png");
    fireEvent.click(screen.getByRole("button", { name: /Install/ }));
    await waitFor(() => expect(e.prompt).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Install Indoor Khelo")).toBeNull());
    // again, then Not now
    const e2 = installEvent();
    act(() => { window.dispatchEvent(e2); });
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Install Indoor Khelo")).toBeNull();
    expect(Number(localStorage.getItem("ik-install-dismissed-at"))).toBeGreaterThan(0);
  });

  it("3. install help is skipped when dismissed in the last 14 days or already installed", () => {
    localStorage.setItem("ik-install-dismissed-at", String(Date.now() - 3 * 24 * 3600 * 1000));
    render(<PwaShell />);
    act(() => { window.dispatchEvent(installEvent()); });
    expect(screen.queryByText("Install Indoor Khelo")).toBeNull();
  });

  it("4. iPhone Safari: the three steps with the Share and Add icons, an arrow toward the Share button, Not now", () => {
    setUa(IPHONE_SAFARI);
    const { container } = render(<PwaShell />);
    expect(screen.getByText("Add Indoor Khelo to your iPhone")).toBeTruthy();
    const steps = container.querySelectorAll(".ac-steps li");
    expect(steps.length).toBe(3);
    expect(steps[0].textContent).toContain("Tap the Share button at the bottom of Safari.");
    expect(steps[1].textContent).toContain("Scroll and tap Add to Home Screen.");
    expect(steps[2].textContent).toContain("Tap Add. Open Indoor Khelo from your home screen.");
    expect(steps[0].querySelector("svg")).not.toBeNull();
    expect(steps[1].querySelector("svg")).not.toBeNull();
    expect(container.querySelector(".ac-arrow")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Add Indoor Khelo to your iPhone")).toBeNull();
  });

  it("5. iPhone Chrome/Firefox/Edge: open in Safari, with a Copy address button that copies this page's address", async () => {
    setUa(IPHONE_SAFARI.replace("Version/17.0", "CriOS/120.0"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<PwaShell />);
    expect(screen.getByText("Open this page in Safari to install")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Copy address/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
    expect(await screen.findByText("Address copied. Open Safari and paste it.")).toBeTruthy();
  });

  it("5. when the browser refuses to copy, the address is shown to select by hand", async () => {
    setUa(IPHONE_SAFARI.replace("Version/17.0", "FxiOS/120.0"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("no")) } });
    render(<PwaShell />);
    fireEvent.click(screen.getByRole("button", { name: /Copy address/ }));
    expect(await screen.findByLabelText("This page's address")).toBeTruthy();
    expect(screen.getByText("Select the address above and copy it.")).toBeTruthy();
  });

  it("iPhone inside another app's browser (WhatsApp, Instagram) shows no install help", () => {
    setUa(IPHONE_SAFARI + " Instagram 300.0");
    render(<PwaShell />);
    expect(screen.queryByText("Add Indoor Khelo to your iPhone")).toBeNull();
    expect(screen.queryByText("Open this page in Safari to install")).toBeNull();
  });

  it("6. offline, new version and install at the same time stack as three separate toasts in one compact column", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setOnline(false);
    stubWorker(true);
    const { container } = render(<PwaShell />);
    await screen.findByText("New version is ready");
    act(() => { window.dispatchEvent(installEvent()); });
    const col = container.querySelector(".ac-toasts") as HTMLElement;
    expect(col.querySelectorAll(":scope > .ac-toast").length).toBe(3);
    expect(col.textContent).toContain("You are offline");
    expect(col.textContent).toContain("New version is ready");
    expect(col.textContent).toContain("Install Indoor Khelo");
  });
});

/* ------------------------------------------------------------------ Public shareable profile */
const base = { name: "Ali Raza", playing_role: "batter", batting_hand: "right", batting_position: "opener", bowling_style: "none" };
const line = (runs: number, out: boolean, over: Partial<MatchLine> = {}): MatchLine => ({
  entryId: "e1", side: 1, name: "Ali", result: "win", points: 20, pom: true, matchId: `m${runs}`, when: "2026-11-23T10:00:00Z", ballsPerOver: 6, teamName: "Secret Team", opponent: "Secret Opponents", resultText: "Secret Team won", numberUsed: 7,
  bat: [{ innings: 0, runs, balls: 10, fours: 1, sixes: 1, dots: 2, singles: 3, twos: 1, threes: 0, fives: 0, freeHitRuns: 0, out: out ? "bowled" : null, golden: false }],
  bowl: [], field: { catches: 1, caughtBowled: 0, stumpings: 0, runOuts: 0 }, partnerships: [], ...over,
});
const view = (p: Record<string, unknown>) => renderToStaticMarkup(<PublicProfileView p={{ ...base, career: careerOf([]), ...p } as never} />);

describe("Public shareable profile", () => {
  it("1. full career: share card with the gold shirt and NO number, role chips, three big tiles, batting/bowling/fielding, last innings legend", () => {
    const html = view({ career: careerOf([line(34, true), line(12, false), line(0, true), line(61, false)]) });
    expect(html).toContain("Ali Raza");
    expect(html).toContain("Indoor cricket");
    expect(html).toContain("ac-pchip role");                 // role chips
    expect(html).toContain("shirt big");                     // the gold shirt with initials ...
    expect(html).toContain("AR");
    expect(html).not.toContain("shirt-num");                 // ... and no number on the chest
    expect(html).not.toContain("Player number");
    expect(html).not.toContain("#7");
    expect(html).toContain("Matches");
    expect(html).toContain("Runs");
    expect(html).toContain("Wickets");
    expect(html).toContain("HS 61*");
    expect(html).toContain("Batting");
    expect(html).toContain("Bowling");
    expect(html).toContain("Fielding and awards");
    expect(html).toContain("Last 4 innings");
    expect(html).toContain("30 or more");
    expect(html).toContain("Out for a duck");
    expect(html).not.toContain("Secret");
    expect(html).not.toContain("href=");
    expect(html.toLowerCase()).not.toContain("payment");
    expect(html).not.toMatch(/<img|https?:\/\//);
  });

  it("1. the page adds the call to action, a 'Public profile' tag, the Open Indoor Khelo header button and the 'Shared by the player' note", async () => {
    h.profile = { ...base, career: careerOf([line(34, true)]) };
    const html = renderToStaticMarkup(await PublicProfilePage({ params: Promise.resolve({ token: "a".repeat(24) }) }));
    expect(html).toContain("Public profile");
    expect(html).toContain("Scored with Indoor Khelo");
    expect(html).toContain("Score your own indoor cricket matches, with live scoring, stats and leaderboards.");
    expect(html).toContain("Shared by the player");
    expect(html).toContain("This page shows no community names, number, match list or payments, and search engines are told not to list it. The player can switch the link off at any time.");
    expect((html.match(/Open Indoor Khelo/g) ?? []).length).toBe(2);   // header button + gold card
    expect(html).not.toContain("Secret");
  });

  it("2. nothing set and no finished matches: dashed empty card with the real wording, four quiet 'Not set' rows, 'Role not set' chip", () => {
    const html = view({ name: "Hassan Javed", playing_role: null, batting_hand: null, batting_position: null, bowling_style: null });
    expect(html).toContain("No finished matches yet");
    expect(html).toContain("Records come only from matches scored in Indoor Khelo.");
    expect(html).toContain("ac-empty");
    expect((html.match(/Not set/g) ?? []).length).toBe(4);
    expect(html).toContain("unset");
    expect(html).toContain("Role not set");
    expect(html).toContain("HJ");
    expect(html).not.toContain("Strike rate");
  });

  it("3. played but never batted: dashes stay and the last-innings card says so instead of disappearing", () => {
    const l = line(0, false, { bat: [], bowl: [{ innings: 1, balls: 12, runs: 24, wickets: 1, maidens: 0, dots: 2, wides: 0, noballs: 0, freeHits: 0, fours: 1, sixes: 0, byType: { bowled: 1, caught: 0, caughtBowled: 0, lbw: 0, stumped: 0, hit_wicket: 0 }, hatTrick: false }] as never });
    const html = view({ playing_role: "allrounder", batting_position: null, career: careerOf([l]) });
    expect(html).toContain("No batting innings yet.");
    expect(html).toContain("Last innings");
    expect(html).not.toMatch(/Last \d+ innings/);
    expect(html).toContain("–");
    expect(html).toContain("Not set");
  });

  it("4. an invalid or switched-off link is a friendly dead end that confirms nothing and offers a way out", async () => {
    h.profile = null;
    await expect(PublicProfilePage({ params: Promise.resolve({ token: "bad" }) })).rejects.toThrow("NOT_FOUND"); // still the real 404
    const html = renderToStaticMarkup(<ProfileLinkNotWorking />);
    expect(html).toContain("This link isn’t working");
    expect(html).toContain("The player may have switched sharing off, or the link was copied with a letter missing. Ask them to send it again.");
    expect(html).toContain("Open Indoor Khelo");
    expect(html).toContain("Error 404 · profile link not found");
    expect(html).toContain('href="/"');
  });

  it("keeps search engines away (noindex) on the page and on the dead end", async () => {
    const mod = await import("@/app/p/[token]/page");
    expect(mod.metadata.robots).toEqual({ index: false, follow: false });
    const nf = await import("@/app/p/[token]/not-found");
    expect(nf.metadata.robots).toEqual({ index: false, follow: false });
  });
});
