// @vitest-environment jsdom
// Phase G1 (UI redesign): Welcome, Terms, Choose, Create, Join, Invite preview, routing, Switch.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
class Redirect extends Error { constructor(public to: string) { super(`REDIRECT ${to}`); } }
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Redirect(to); }, useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => "/" }));
const cookieJar = vi.hoisted(() => ({ ik_last: undefined as string | undefined }));
const cookieSet = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (k: string) => (k === "ik_last" && cookieJar.ik_last ? { value: cookieJar.ik_last } : undefined), set: cookieSet }) }));

const actions = vi.hoisted(() => ({
  acceptTermsAction: vi.fn(), createCommunityAction: vi.fn(), findCommunityAction: vi.fn(), requestJoinAction: vi.fn(),
}));
vi.mock("@/app/actions", () => actions);
const auth = vi.hoisted(() => ({ social: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signIn: { social: auth.social }, signOut: auth.signOut, revokeSessions: vi.fn() } }));

const session = vi.hoisted(() => ({ user: null as null | { id: string; name: string; termsAccepted: boolean } }));
vi.mock("@/lib/session", () => ({
  getSessionUser: async () => session.user,
  requireUser: async () => { if (!session.user) throw new Redirect("/"); return session.user; },
  requireAcceptedUser: async () => { if (!session.user) throw new Redirect("/"); if (!session.user.termsAccepted) throw new Redirect("/terms"); return session.user; },
}));
const db = vi.hoisted(() => ({
  mine: [] as { id: string; name: string; role: "admin" | "member"; status: string; player_number: number | null }[],
  community: null as null | Record<string, unknown>,
  members: 24,
  membership: null as null | { status: string; player_number: number | null },
  adminName: "Ali Raza" as string | null,
}));
vi.mock("@/lib/community", () => ({
  isUuid: (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
  listMyCommunities: async () => db.mine,
  getCommunityByCode: async () => db.community,
  approvedCount: async () => db.members,
  getMembership: async () => db.membership,
}));
vi.mock("@/lib/db", () => ({ one: async () => (db.adminName ? { name: db.adminName } : null) }));

import SignInButton from "@/components/SignInButton";
import EnAccountMenu from "@/components/EnAccountMenu";
import EnCreateForm from "@/components/EnCreateForm";
import EnInstallHint from "@/components/EnInstallHint";
import { EnFullCard, EnInvalid, EnInviteCard, EnNextSteps } from "@/components/EnInvite";
import EnJoinForm from "@/components/EnJoinForm";
import EnOpenLink from "@/components/EnOpenLink";
import { EnSplash } from "@/components/EnParts";
import EnRequestJoin from "@/components/EnRequestJoin";
import EnSwitchList from "@/components/EnSwitchList";
import EnTermsForm from "@/components/EnTermsForm";
import WelcomePage from "@/app/page";
import TermsPage from "@/app/terms/page";
import ChoosePage from "@/app/choose/page";
import CreatePage from "@/app/create/page";
import JoinPage from "@/app/join/page";
import JoinPreviewPage from "@/app/join/[code]/page";
import SwitchPage from "@/app/switch/page";
import HomeRouter from "@/app/home/page";
import ProfileRouter from "@/app/profile/page";
import HomeLoading from "@/app/home/loading";
import ProfileLoading from "@/app/profile/loading";
import { GET as switchGet } from "@/app/switch/[id]/route";

const SARA = { id: "u1", name: "Sara Noor", termsAccepted: true };
const KARACHI = { id: "11111111-1111-4111-8111-111111111111", name: "Karachi Indoor Cricket Club", location: "Clifton, Karachi", description: "Weekly indoor cricket at the Clifton arena. All levels welcome.", approval_required: true, created_by: "a1", invite_code: "KH-7Q4M" };
const CLIFTON = "22222222-2222-4222-8222-222222222222";
const GULSHAN = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  session.user = null; db.mine = []; db.community = null; db.members = 24; db.membership = null; db.adminName = "Ali Raza"; cookieJar.ik_last = undefined;
  Object.values(actions).forEach((f) => f.mockReset());
  auth.social.mockReset(); auth.signOut.mockReset();
  try { localStorage.clear(); } catch { /* ignore */ }
});
// An action that is "still saving". React keeps every unfinished form action in one queue, so a test that leaves one
// hanging would block the next tests: finish them all after each test.
const hung: ((v: Record<string, never>) => void)[] = [];
const hang = () => new Promise<Record<string, never>>((res) => { hung.push(res); });
afterEach(async () => { await act(async () => { hung.splice(0).forEach((r) => r({})); }); cleanup(); vi.restoreAllMocks(); });

async function pageHtml(el: Promise<React.ReactElement>) { return renderToStaticMarkup(await el); }
async function redirectOf(el: Promise<unknown>) { try { await el; } catch (e) { if (e instanceof Redirect) return e.to; throw e; } return null; }

/* ================= Welcome and sign in ================= */
describe("Welcome and sign in /", () => {
  it("1. signed out, default: brand, three promises, Get started, Google button, privacy line", async () => {
    const html = await pageHtml(WelcomePage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Indoor <span>Khelo</span>");
    expect(html).toContain("Play. <b>Score.</b> Split.");
    for (const t of ["Live scoring", "Stats", "Split costs", "Score every ball", "Teams, stats and leaderboards", "Share the venue cost"]) expect(html).toContain(t);
    expect(html).toContain("Get started");
    expect(html).toContain("One tap creates your account or signs you in. No password to remember.");
    expect(html).toContain("Continue with Google");
    expect(html).toContain("Only your name is used. No photo, no password. Your email stays private.");
    expect(html).toContain("/icons/icon-512.png");
  });
  it("a signed-in visitor is sent to /home and nothing is drawn", async () => {
    session.user = SARA;
    expect(await redirectOf(WelcomePage({ searchParams: Promise.resolve({}) }))).toBe("/home");
  });
  it("2. after tapping the button: spinner, label 'Opening Google…', disabled and aria-busy; same size button", async () => {
    auth.social.mockReturnValue(new Promise(() => {}));
    render(<SignInButton next="/home" />);
    const btn = screen.getByRole("button", { name: "Continue with Google" });
    expect(btn.getAttribute("aria-busy")).toBe("false");
    fireEvent.click(btn);
    const busy = await screen.findByRole("button", { name: "Opening Google…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(busy.querySelector(".en-spin")).toBeTruthy();
    expect(auth.social).toHaveBeenCalledWith({ provider: "google", callbackURL: `${window.location.origin}/home` });
  });
  it("3. sign-in error: banner with icon and title, the real message, button tappable again", async () => {
    auth.social.mockResolvedValue({ error: { message: "x" } });
    render(<SignInButton next="/home" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Google sign-in could not start");
    expect(alert.textContent).toContain("Please check your internet and try again.");
    expect(alert.querySelector("svg")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Continue with Google" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/Still stuck\? Check you are online/)).toBeTruthy();
  });
  it("3b. a thrown error (offline) gives the same banner", async () => {
    auth.social.mockRejectedValue(new Error("network"));
    render(<SignInButton next="/join/KH-7Q4M" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect((await screen.findByRole("alert")).textContent).toContain("could not start");
  });
  it("4. install hint: only when the browser says it can be installed; Install calls prompt; 14-day dismiss respected", async () => {
    const { unmount } = render(<EnInstallHint />);
    expect(screen.queryByText("Install the app")).toBeNull();
    const prompt = vi.fn(async () => {});
    const ev = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    await act(async () => { window.dispatchEvent(ev); });
    expect(screen.getByText("Install the app")).toBeTruthy();
    expect(ev.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await waitFor(() => expect(prompt).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Install the app")).toBeNull());
    unmount();
    localStorage.setItem("ik-install-dismissed-at", String(Date.now()));
    render(<EnInstallHint />);
    await act(async () => { window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: "dismissed" }) })); });
    expect(screen.queryByText("Install the app")).toBeNull();
  });
});

/* ================= Terms ================= */
describe("Terms and privacy /terms", () => {
  it("1. first sign-in: icon facts (same wording), checkbox row, account menu with Log out only", async () => {
    session.user = { id: "u1", name: "Sara Noor", termsAccepted: false };
    const html = await pageHtml(TermsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Welcome to Indoor Khelo, Sara");
    expect(html).toContain("Please read this once. It takes 30 seconds.");
    for (const t of ["What it is", "Your name", "Open communities", "Your records", "We take only your name from Google. No photos are used. Your email stays private and is used only to sign you in.", "Career stats come only from matches scored in the app. Nobody can edit them by hand."]) expect(html).toContain(t);
    expect(html).toContain("I accept the Terms and the Privacy notice");
    expect(html).toContain('aria-label="Account menu"');
    expect(html).toContain('value="/choose"');
  });
  it("redirects on when already accepted, and keeps a safe next path", async () => {
    session.user = SARA;
    expect(await redirectOf(TermsPage({ searchParams: Promise.resolve({ next: "/join/KH-7Q4M" }) }))).toBe("/join/KH-7Q4M");
    expect(await redirectOf(TermsPage({ searchParams: Promise.resolve({ next: "//evil.com" }) }))).toBe("/choose");
  });
  it("1b. the whole row is the checkbox: ticking turns it gold", () => {
    render(<EnTermsForm next="/choose" />);
    const box = screen.getByRole("checkbox", { name: "I accept the Terms and the Privacy notice" }) as HTMLInputElement;
    const row = box.closest("label")!;
    expect(row.className).not.toContain(" on");
    fireEvent.click(row.querySelector(".en-tick-t")!);
    expect(box.checked).toBe(true);
    expect(row.className).toContain(" on");
  });
  it("2. Continue without ticking: the row turns red and carries the real message with an icon", async () => {
    actions.acceptTermsAction.mockResolvedValue({ error: "Please tick the box to accept the Terms and Privacy notice." });
    const { container } = render(<EnTermsForm next="/choose" />);
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Please tick the box to accept the Terms and Privacy notice.");
    expect(alert.querySelector("svg")).toBeTruthy();
    const row = container.querySelector(".en-tick")!;
    expect(row.className).toContain("bad");
    expect(screen.getByRole("checkbox").getAttribute("aria-invalid")).toBe("true");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(container.querySelector(".en-tick")!.className).not.toContain("bad");
  });
  it("3. ticked, saving: the same action is sent the next path and accept=on; button shows spinner and 'Saving…'", async () => {
    let seen: FormData | null = null;
    actions.acceptTermsAction.mockImplementation((_p: unknown, fd: FormData) => { seen = fd; return hang(); });
    const { container } = render(<EnTermsForm next="/join/KH-7Q4M" />);
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const btn = await screen.findByRole("button", { name: "Saving…" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.querySelector(".en-spin")).toBeTruthy();
    expect(seen!.get("accept")).toBe("on");
    expect(seen!.get("next")).toBe("/join/KH-7Q4M");
  });
});

/* ================= Choose ================= */
describe("Create or join /choose", () => {
  it("1. first time: two doors (Create primary), friendly empty note, account menu", async () => {
    session.user = SARA;
    const html = await pageHtml(ChoosePage());
    expect(html).toContain("Welcome, Sara");
    expect(html).toContain("You are not in a community yet.");
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/join"');
    expect(html).toContain("en-door primary");
    expect(html).toContain("No communities yet");
    expect(html).toContain('aria-label="Account menu"');
    expect(html).not.toContain("Your communities");
  });
  it("2. two communities and one pending request: list first with Admin and Pending badges, links to waiting / community", async () => {
    session.user = SARA;
    db.mine = [
      { id: KARACHI.id, name: KARACHI.name, role: "admin", status: "approved", player_number: 7 },
      { id: CLIFTON, name: "Clifton Office League", role: "member", status: "approved", player_number: 12 },
      { id: GULSHAN, name: "Gulshan Night Cricket", role: "member", status: "pending", player_number: null },
    ];
    const html = await pageHtml(ChoosePage());
    expect(html).toContain("Welcome back, Sara");
    expect(html).toContain("Pick a community to open, or start a new one.");
    expect(html).toContain("Admin · number 7");
    expect(html).toContain("Member · number 12");
    expect(html).toContain(">Admin</span>");
    expect(html).toContain(">Pending</span>");
    expect(html).toContain(`href="/c/${KARACHI.id}"`);
    expect(html).toContain(`href="/c/${GULSHAN}/waiting"`);
    expect(html.indexOf("Your communities")).toBeLessThan(html.indexOf("Create a community"));
    expect(html).not.toContain("en-door primary");
  });
  it("3. only a pending request: Pending badge and the line 'Request sent, waiting for the Admin'", async () => {
    session.user = SARA;
    db.mine = [{ id: GULSHAN, name: "Gulshan Night Cricket", role: "member", status: "pending", player_number: null }];
    const html = await pageHtml(ChoosePage());
    expect(html).toContain("Request sent, waiting for the Admin");
    expect(html).toContain(">Pending</span>");
  });
  it("signed out goes to / and unaccepted terms go to /terms", async () => {
    expect(await redirectOf(ChoosePage())).toBe("/");
    session.user = { ...SARA, termsAccepted: false };
    expect(await redirectOf(ChoosePage())).toBe("/terms");
  });
});

/* ================= Create ================= */
describe("Create a community /create", () => {
  it("page: back to /choose, 3-step progress, heading", async () => {
    session.user = SARA;
    const html = await pageHtml(CreatePage());
    expect(html).toContain('href="/choose"');
    expect(html).toContain("1 Community");
    expect(html).toContain("2 Player number");
    expect(html).toContain("3 Invite friends");
    expect(html).toContain("Create a community");
  });
  it("1. empty form: counters 0 / 60, 0 / 300, 0 / 80, switch text for ON, preview shows ? and placeholders", () => {
    render(<EnCreateForm />);
    expect(screen.getByText("0 / 60")).toBeTruthy();
    expect(screen.getByText("0 / 300")).toBeTruthy();
    expect(screen.getByText("0 / 80")).toBeTruthy();
    expect(screen.getByText("People who use your link wait until you approve them")).toBeTruthy();
    const prev = screen.getByLabelText("Preview of your community");
    expect(prev.textContent).toContain("?");
    expect(prev.textContent).toContain("Your community name");
    expect(prev.textContent).toContain("Your description appears here.");
  });
  it("3. filled in, approval off: preview follows the form, switch text changes, field names are the old ones", () => {
    const { container } = render(<EnCreateForm />);
    fireEvent.change(screen.getByLabelText("Community name"), { target: { value: "Alpha Indoor Club" } });
    fireEvent.change(screen.getByLabelText("Short description (optional)"), { target: { value: "A friendly group." } });
    fireEvent.change(screen.getByLabelText("Location (optional)"), { target: { value: "Lahore" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Admin approves new members/ }));
    expect(screen.getByText("17 / 60")).toBeTruthy();
    expect(screen.getByText("Anyone with the link joins straight away")).toBeTruthy();
    const prev = screen.getByLabelText("Preview of your community");
    expect(prev.textContent).toContain("AI");
    expect(prev.textContent).toContain("Alpha Indoor Club");
    expect(prev.textContent).toContain("Lahore");
    expect(prev.textContent).toContain("A friendly group.");
    expect([...container.querySelectorAll("input,textarea")].map((e) => (e as HTMLInputElement).name)).toEqual(["name", "description", "location", "approvalRequired"]);
  });
  it("posts the same fields to the same action (approvalRequired is 'on' only when the switch is on)", async () => {
    let seen: FormData | null = null;
    actions.createCommunityAction.mockImplementation(async (_p: unknown, fd: FormData) => { seen = fd; return {}; });
    const { container } = render(<EnCreateForm />);
    fireEvent.change(screen.getByLabelText("Community name"), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Admin approves new members/ }));
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    expect(seen!.get("name")).toBe("Alpha");
    expect(seen!.get("approvalRequired")).toBeNull();
    expect(seen!.get("location")).toBe("");
  });
  it("2. name too short: red ring, icon and the real message on the field; typed text is kept; the generic line stays hidden", async () => {
    actions.createCommunityAction.mockResolvedValue({ fieldErrors: { name: "Give your community a name (at least 2 letters)." }, error: "Please fix the highlighted fields." });
    const { container } = render(<EnCreateForm />);
    fireEvent.change(screen.getByLabelText("Community name"), { target: { value: "A" } });
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Give your community a name (at least 2 letters).");
    expect(alert.querySelector("svg")).toBeTruthy();
    const input = screen.getByLabelText("Community name") as HTMLInputElement;
    expect(input.className).toContain("bad");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.value).toBe("A");
    expect(screen.queryByText("Please fix the highlighted fields.")).toBeNull();
  });
  it("a server error without field errors is shown", async () => {
    actions.createCommunityAction.mockResolvedValue({ error: "Something went wrong." });
    const { container } = render(<EnCreateForm />);
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    expect((await screen.findByRole("alert")).textContent).toContain("Something went wrong.");
  });
  it("4. saving: disabled button with spinner and 'Creating…' (no second tap)", async () => {
    actions.createCommunityAction.mockImplementation(() => hang());
    const { container } = render(<EnCreateForm />);
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const btn = await screen.findByRole("button", { name: "Creating…" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.querySelector(".en-spin")).toBeTruthy();
  });
  it("the button is labelled as before when idle", () => {
    render(<EnCreateForm />);
    expect(screen.getByRole("button", { name: /Next: choose my player number/ })).toBeTruthy();
  });
});

/* ================= Join ================= */
describe("Join a community /join", () => {
  it("1. empty: Paste button, both examples, same intro", async () => {
    session.user = SARA;
    const html = await pageHtml(JoinPage());
    expect(html).toContain("Paste the invite link or type the code your Admin gave you.");
    expect(html).toContain("Paste");
    expect(html).toContain("…/join/KH-7Q4M");
    expect(html).toContain(">KH-7Q4M<");
    expect(html).toContain('href="/choose"');
  });
  it("Paste puts the clipboard text in the field", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { readText: vi.fn(async () => "  KH-7Q4M ") }, configurable: true });
    render(<EnJoinForm />);
    fireEvent.click(screen.getByRole("button", { name: "Paste from clipboard" }));
    await waitFor(() => expect((screen.getByLabelText("Invite link or code") as HTMLInputElement).value).toBe("KH-7Q4M"));
  });
  it("Paste with no permission says what to do instead", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { readText: vi.fn(async () => { throw new Error("denied"); }) }, configurable: true });
    render(<EnJoinForm />);
    fireEvent.click(screen.getByRole("button", { name: "Paste from clipboard" }));
    expect(await screen.findByText(/Could not read the clipboard/)).toBeTruthy();
  });
  it("2. not an invite: red ring, icon and the real message on the field", async () => {
    actions.findCommunityAction.mockResolvedValue({ error: "That does not look like an invite link or code. A code looks like KH-7Q4M." });
    const { container } = render(<EnJoinForm />);
    fireEvent.change(screen.getByLabelText("Invite link or code"), { target: { value: "hello" } });
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("That does not look like an invite link or code. A code looks like KH-7Q4M.");
    expect(alert.querySelector("svg")).toBeTruthy();
    expect(screen.getByLabelText("Invite link or code").getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByLabelText("Invite link or code") as HTMLInputElement).value).toBe("hello");
  });
  it("3. finding: spinner and 'Finding…', field name is 'code'", async () => {
    let seen: FormData | null = null;
    actions.findCommunityAction.mockImplementation((_p: unknown, fd: FormData) => { seen = fd; return hang(); });
    const { container } = render(<EnJoinForm />);
    fireEvent.change(screen.getByLabelText("Invite link or code"), { target: { value: "KH-7Q4X" } });
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const btn = await screen.findByRole("button", { name: "Finding…" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.querySelector(".en-spin")).toBeTruthy();
    expect(seen!.get("code")).toBe("KH-7Q4X");
  });
});

/* ================= Invite preview ================= */
describe("Invite preview /join/[code]", () => {
  const open = (code = "KH-7Q4M") => JoinPreviewPage({ params: Promise.resolve({ code }), searchParams: Promise.resolve({}) });
  it("1. signed out, approval required: welcome card, facts, Sign in to join, Google button, three steps", async () => {
    db.community = KARACHI;
    const html = await pageHtml(open());
    expect(html).toContain("You are invited to join");
    expect(html).toContain("Karachi Indoor Cricket Club");
    expect(html).toContain("Clifton, Karachi");
    expect(html).toContain("Weekly indoor cricket at the Clifton arena.");
    expect(html).toContain(">24<");
    expect(html).toContain("Ali Raza");
    expect(html).toContain("Admin approval needed");
    expect(html).toContain("Sign in to join");
    expect(html).toContain("Continue with Google");
    expect(html).toContain("One tap with Google. Only your name is used.");
    for (const s of ["Sign in with Google", "The Admin approves you", "Pick your player number", "From 1 to 99. You can change it later."]) expect(html).toContain(s);
    expect(html).not.toContain('aria-label="Account menu"');
  });
  it("2. signed out, open community with no description or location: one quiet line, no Admin step", async () => {
    db.community = { ...KARACHI, approval_required: false, description: "", location: "" };
    const html = await pageHtml(open());
    expect(html).toContain("No location or description added yet.");
    expect(html).toContain("Open, join straight away");
    expect(html).not.toContain("The Admin approves you");
    expect(html).toContain("Pick your player number");
  });
  it("3. signed in, approval required: 'Ask to join', 'Request to join', number line, steps with 'You are signed in'", async () => {
    session.user = SARA; db.community = KARACHI;
    const html = await pageHtml(open());
    expect(html).toContain("Ask to join");
    expect(html).toContain("Request to join");
    expect(html).toContain("You will choose your player number after you are approved.");
    expect(html).toContain("You are signed in");
    expect(html).toContain("The Admin approves you");
    expect(html).toContain('aria-label="Account menu"');
    expect(html).not.toContain("Continue with Google");
  });
  it("4. signed in, open community: 'Join now', 'Join community', no Admin step, number comes next", async () => {
    session.user = SARA; db.community = { ...KARACHI, approval_required: false };
    const html = await pageHtml(open());
    expect(html).toContain("Join now");
    expect(html).toContain("Join community");
    expect(html).toContain("You will choose your player number next.");
    expect(html).not.toContain("The Admin approves you");
  });
  it("5. sending the request: spinner and 'Sending…', code posted to requestJoinAction", async () => {
    let seen: FormData | null = null;
    actions.requestJoinAction.mockImplementation((_p: unknown, fd: FormData) => { seen = fd; return hang(); });
    const { container } = render(<EnRequestJoin code="KH-7Q4M" approval />);
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const btn = await screen.findByRole("button", { name: "Sending…" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.querySelector(".en-spin")).toBeTruthy();
    expect(seen!.get("code")).toBe("KH-7Q4M");
  });
  it("6. request fails (invite replaced): the real message in a banner with an icon above the button", async () => {
    actions.requestJoinAction.mockResolvedValue({ error: "This invite link or code is not valid any more. Ask the Admin for a new one." });
    const { container } = render(<EnRequestJoin code="KH-7Q4M" approval />);
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This invite link or code is not valid any more. Ask the Admin for a new one.");
    expect(alert.querySelector("svg")).toBeTruthy();
    const btn = screen.getByRole("button", { name: /Request to join/ });
    expect(alert.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
  it("7. community is full: a state with the message and 'Try another code'; no sign-in button, for a signed-out and a signed-in visitor", async () => {
    db.community = KARACHI; db.members = 99;
    for (const u of [null, SARA]) {
      session.user = u;
      const html = await pageHtml(open());
      expect(html).toContain("This community is full");
      expect(html).toContain("This community already has 99 members, so no one else can join.");
      expect(html).toContain("Try another code");
      expect(html).toContain('href="/join"');
      expect(html).not.toContain("Continue with Google");
      expect(html).not.toContain("Request to join");
    }
  });
  it("8. signed out, Google could not start: banner above the still-active button (SignInButton on this page)", async () => {
    auth.social.mockResolvedValue({ error: { message: "x" } });
    render(<SignInButton next="/join/KH-7Q4M" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Google sign-in could not start");
    expect(auth.social).toHaveBeenCalledWith({ provider: "google", callbackURL: `${window.location.origin}/join/KH-7Q4M` });
    expect((screen.getByRole("button", { name: "Continue with Google" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("9. invalid or replaced code: same words, 'Try another code' and a way back to the start", async () => {
    db.community = null;
    const html = await pageHtml(open("nonsense"));
    expect(html).toContain("This invite is not valid");
    expect(html).toContain("The link or code may be wrong, or the Admin replaced it. Ask your Admin for a new one.");
    expect(html).toContain('href="/join"');
    expect(html).toContain("Try another code");
    expect(html).toContain('href="/"');
    expect(html).toContain("Go to Indoor Khelo");
  });
  it("keeps every redirect: unaccepted terms, approved without number, approved, pending", async () => {
    db.community = KARACHI;
    session.user = { ...SARA, termsAccepted: false };
    expect(await redirectOf(open())).toBe(`/terms?next=${encodeURIComponent("/join/KH-7Q4M")}`);
    session.user = SARA;
    db.membership = { status: "approved", player_number: null };
    expect(await redirectOf(open())).toBe(`/c/${KARACHI.id}/number`);
    db.membership = { status: "approved", player_number: 7 };
    expect(await redirectOf(open())).toBe(`/c/${KARACHI.id}`);
    db.membership = { status: "pending", player_number: null };
    expect(await redirectOf(open())).toBe(`/c/${KARACHI.id}/waiting`);
  });
  it("parts: the full card and the steps stand alone", () => {
    const { container } = render(<div><EnFullCard cap={99} /><EnNextSteps approval={false} signedIn={false} /></div>);
    expect(container.textContent).toContain("99 members");
    expect(container.textContent).not.toContain("The Admin approves you");
    cleanup();
    render(<EnInviteCard community={{ name: "Alpha", location: "", description: "", approval_required: true }} members={3} adminName="Zed" />);
    expect(screen.getByText("No location or description added yet.")).toBeTruthy();
    render(<EnInvalid />);
  });
});

/* ================= Routing redirects ================= */
describe("Routing redirects /home, /profile, /switch/[id]", () => {
  const ready = { id: KARACHI.id, name: "K", role: "admin" as const, status: "approved", player_number: 7 };
  it("/home keeps its six rules", async () => {
    expect(await redirectOf(HomeRouter())).toBe("/");
    session.user = { ...SARA, termsAccepted: false };
    expect(await redirectOf(HomeRouter())).toBe("/terms");
    session.user = SARA;
    db.mine = [ready, { id: CLIFTON, name: "C", role: "member", status: "approved", player_number: 3 }];
    expect(await redirectOf(HomeRouter())).toBe(`/c/${KARACHI.id}`);
    cookieJar.ik_last = CLIFTON;
    expect(await redirectOf(HomeRouter())).toBe(`/c/${CLIFTON}`);
    db.mine = [{ ...ready, player_number: null }];
    expect(await redirectOf(HomeRouter())).toBe(`/c/${KARACHI.id}/number`);
    db.mine = [{ id: GULSHAN, name: "G", role: "member", status: "pending", player_number: null }];
    expect(await redirectOf(HomeRouter())).toBe(`/c/${GULSHAN}/waiting`);
    db.mine = [];
    expect(await redirectOf(HomeRouter())).toBe("/choose");
  });
  it("/profile goes to the profile of a ready community, otherwise /choose", async () => {
    session.user = SARA;
    db.mine = [ready];
    expect(await redirectOf(ProfileRouter())).toBe(`/c/${KARACHI.id}/profile`);
    db.mine = [];
    expect(await redirectOf(ProfileRouter())).toBe("/choose");
  });
  it("/switch/[id] (route handler unchanged): strangers go to / or /choose; approved opens the community; pending opens waiting; the choice is remembered", async () => {
    const go = async (id: string) => {
      const res = await switchGet(new Request(`https://app.test/switch/${id}`), { params: Promise.resolve({ id }) });
      return new URL(res.headers.get("location")!).pathname;
    };
    expect(await go(KARACHI.id)).toBe("/");                       // signed out
    session.user = { ...SARA, termsAccepted: false };
    expect(await go(KARACHI.id)).toBe("/");                       // terms not accepted
    session.user = SARA;
    expect(await go("not-a-uuid")).toBe("/");
    db.membership = null;
    expect(await go(KARACHI.id)).toBe("/choose");                 // not a member
    cookieSet.mockClear();
    db.membership = { status: "approved", player_number: 7 };
    expect(await go(KARACHI.id)).toBe(`/c/${KARACHI.id}`);
    expect(cookieSet).toHaveBeenCalledWith("ik_last", KARACHI.id, expect.objectContaining({ httpOnly: true, path: "/" }));
    db.membership = { status: "pending", player_number: null };
    expect(await go(GULSHAN)).toBe(`/c/${GULSHAN}/waiting`);
  });
  it("2. NEW loading screen: logo, what is happening and a progress bar, instead of a blank page", () => {
    for (const el of [<HomeLoading key="h" />, <ProfileLoading key="p" />]) {
      const html = renderToStaticMarkup(el);
      expect(html).toContain("/icons/icon-192.png");
      expect(html).toContain("Checking your communities…");
      expect(html).toContain("en-bar");
      expect(html).toContain('role="status"');
    }
    expect(renderToStaticMarkup(<HomeLoading />)).toContain("Opening Indoor Khelo");
    expect(renderToStaticMarkup(<EnSplash title="Opening Karachi" overlay />)).toContain("en-splash-overlay");
  });
});

/* ================= Switch ================= */
describe("Your communities /switch", () => {
  const three = [
    { id: KARACHI.id, name: KARACHI.name, role: "admin" as const, status: "approved", player_number: 7 },
    { id: CLIFTON, name: "Clifton Office League", role: "member" as const, status: "approved", player_number: 12 },
    { id: GULSHAN, name: "Gulshan Night Cricket", role: "member" as const, status: "pending", player_number: null },
  ];
  it("1. two communities and one pending: role badges, gold shirt with the number, Open buttons, Last opened, Create and Join buttons", async () => {
    session.user = SARA; db.mine = three; cookieJar.ik_last = KARACHI.id;
    const html = await pageHtml(SwitchPage());
    expect(html).toContain("Your communities");
    expect(html).toContain("Tap one to open it.");
    expect(html).toContain(`href="/switch/${KARACHI.id}"`);
    expect(html).toContain(`href="/switch/${GULSHAN}"`);
    expect(html).toContain(">Admin</span>");
    expect(html).toContain(">Member</span>");
    expect(html).toContain(">Pending</span>");
    expect(html).toContain(">Last opened</span>");
    expect(html).toContain("Waiting for approval");
    expect(html).toContain("Player number 7");
    expect(html).toContain("Player number 12");
    expect(html).toContain("No player number yet");
    expect(html).toContain(">Status<");
    expect(html).toContain("Create community");
    expect(html).toContain("Join community");
    expect(html).toContain('href="/home"');
    expect((html.match(/en-ccard pref/g) ?? []).length).toBe(1);
  });
  it("the default community (cookie or first ready) has the primary button; 'Last opened' only when the cookie says so", async () => {
    session.user = SARA; db.mine = three;
    let html = await pageHtml(SwitchPage());
    expect(html).not.toContain("Last opened");
    expect(html).toContain(`en-ccard pref"><span class="logo-mark`);
    cookieJar.ik_last = CLIFTON;
    html = await pageHtml(SwitchPage());
    expect(html.indexOf("Last opened")).toBeGreaterThan(html.indexOf("Clifton Office League"));
    expect(html.indexOf("Last opened")).toBeLessThan(html.indexOf("Gulshan Night Cricket"));
  });
  it("2. not in any community yet: empty state with Create and Join inside it", async () => {
    session.user = SARA; db.mine = [];
    const html = await pageHtml(SwitchPage());
    expect(html).toContain("You are not in a community yet");
    expect(html).toContain("Create one for your group, or join one with an invite link.");
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/join"');
    expect(html).not.toContain("Tap one to open it.");
  });
  it("Open is a link to /switch/[id] and puts a loading cover with the community name on the page while it loads", () => {
    render(<EnSwitchList mine={three} preferredId={KARACHI.id} lastId={KARACHI.id} />);
    const open = screen.getByRole("link", { name: `Open ${KARACHI.name}` });
    expect(open.getAttribute("href")).toBe(`/switch/${KARACHI.id}`);
    expect(open.className).toContain("gold");
    expect(screen.getByRole("link", { name: "Open Clifton Office League" }).className).not.toContain("gold");
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(open);
    const cover = screen.getByRole("status");
    expect(cover.textContent).toContain(`Opening ${KARACHI.name}`);
  });
  it("Open on its own", () => {
    render(<EnOpenLink id={CLIFTON} name="Clifton" label="Status" pending />);
    fireEvent.click(screen.getByRole("link", { name: "Status Clifton" }));
    expect(screen.getByRole("status").textContent).toContain("Checking Clifton");
  });
});

/* ================= Account menu ================= */
describe("Account menu on the entry pages", () => {
  it("opens with the name, an Account link and Log out; Escape closes it", () => {
    render(<EnAccountMenu name="Sara Noor" />);
    expect(screen.queryByText("Log out")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByText("Sara Noor")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Account" }).getAttribute("href")).toBe("/account");
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: "Account menu" }), { key: "Escape" });
    expect(screen.queryByText("Log out")).toBeNull();
  });
  it("before the Terms are accepted only Log out is offered (/account would send the person back)", () => {
    render(<EnAccountMenu name="Sara Noor" showAccount={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
  });
});
