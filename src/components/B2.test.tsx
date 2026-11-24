// @vitest-environment jsdom
// Builder 2 (UI redesign): Alerts, Community and Invite screens.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  role: "admin" as "admin" | "member",
  approval: true,
  members: [] as { user_id: string; name: string; role: "admin" | "member"; player_number: number | null; playing_role: string | null }[],
  mine: [] as { id: string; name: string; role: "admin" | "member"; status: string; player_number: number | null }[],
  pending: [] as { user_id: string }[],
  activity: [] as { action: string; actor_name: string | null; target_name: string | null; created_at: Date }[],
  alerts: [] as Record<string, unknown>[],
  answers: {} as Record<string, "in" | "out">,
}));

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/alerts" }));
vi.mock("@/components/QrCode", () => ({ default: ({ label }: { label: string }) => <div role="img" aria-label={label} /> }));
vi.mock("@/lib/session", () => ({ requireAcceptedUser: async () => ({ id: "u1", name: "Ali Raza" }) }));
vi.mock("@/lib/zone", () => ({ getZone: async () => "Asia/Karachi" }));
vi.mock("@/lib/origin", () => ({ getOrigin: async () => "https://indoorkhelo.app" }));
vi.mock("@/lib/community", () => ({
  requireMember: async () => ({
    community: { id: "c1", name: "Karachi Indoor Cricket Club", description: "Weekly indoor cricket", location: "Clifton, Karachi", approval_required: h.approval, invite_code: "KICC-7Q4X" },
    membership: { role: h.role, player_number: 7, status: "approved" },
  }),
  listApprovedMembers: async () => h.members,
  listMyCommunities: async () => h.mine,
  listPending: async () => h.pending,
  isUuid: () => true,
}));
vi.mock("@/lib/management", () => ({
  listActivity: async () => h.activity,
  describeActivity: (a: { action: string; actor_name: string | null }) => `${a.actor_name ?? "Someone"} did ${a.action}`,
}));
vi.mock("@/lib/matches", () => ({ listAlerts: async () => h.alerts }));
vi.mock("@/lib/alertsData", () => ({ myAnswersFor: async () => h.answers }));

const acts = vi.hoisted(() => ({
  markOne: vi.fn(async () => ({ ok: true as const })),
  markAll: vi.fn(async () => ({ ok: true as const, ids: ["a1", "a2"] })),
  undo: vi.fn(async () => ({ ok: true as const })),
  answer: vi.fn(async (_c: string, _m: string, a: string) => ({ ok: true as const, answer: a })),
  replace: vi.fn(async (_fd: FormData) => undefined),
}));
vi.mock("@/app/actionsB2", () => ({
  markAlertReadAction: acts.markOne,
  markAllAlertsReadB2Action: acts.markAll,
  undoMarkAlertsReadAction: acts.undo,
  answerFromAlertAction: acts.answer,
}));
vi.mock("@/app/actions", () => ({ replaceInviteAction: acts.replace }));

import AlertsList, { AlertsEmpty, type AlertView } from "@/components/AlertsList";
import CopyButton, { COPIED_MS, COPY_HINT } from "@/components/CopyButton";
import { InviteFields, REPLACED_MESSAGE, ReplaceInvite, ShareButton, whatsappUrl } from "@/components/InviteBits";
import { SnackbarProvider } from "@/components/Snackbar";
import {
  ALERT_KINDS, alertTimeLabel, alertsMarkedText, canAnswerKind, countsByKind, dayBucket, filterCounts, kindMeta, matchesFilter,
} from "@/lib/alertsUi";
import { FIRST_MEMBERS, activityIcon, placesText, progressPercent } from "@/lib/communityUi";
import AlertsPage from "@/app/c/[id]/alerts/page";
import CommunityPage from "@/app/c/[id]/community/page";
import InvitePage from "@/app/c/[id]/invite/page";

beforeEach(() => {
  for (const f of Object.values(acts)) f.mockClear();
  h.role = "admin";
  h.approval = true;
  h.members = [];
  h.mine = [];
  h.pending = [];
  h.activity = [];
  h.alerts = [];
  h.answers = {};
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const P = { params: Promise.resolve({ id: "c1" }) };
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const view = (over: Partial<AlertView> = {}): AlertView => ({
  id: "a1", kind: "match_scheduled", message: "New match: Desert Falcons v Blue Hawks. Are you coming?", matchId: "m1", bookingId: null,
  read: false, day: "today", time: "6:10 pm", matchWhen: "Sat, 28 Nov, 8:00 pm", canAnswer: true, myAnswer: null, ...over,
});
const mixed = (): AlertView[] => [
  view({ id: "a1" }),
  view({ id: "a2", kind: "match_reminder", message: "Reminder: Desert Falcons v Blue Hawks.", matchId: "m1", time: "9:00 am" }),
  view({ id: "a3", kind: "match_changed", message: "Thunder Strikers v Royal Panthers has a new date or time.", matchId: "m2", day: "yesterday", canAnswer: false }),
  view({ id: "a4", kind: "payment_reminder", message: "Reminder: Clifton Indoor Arena still has Rs 3,500 open.", matchId: null, bookingId: "b1", day: "yesterday", matchWhen: null, canAnswer: false }),
  view({ id: "a5", kind: "match_postponed", message: "Royal Panthers v Blue Hawks has been postponed.", matchId: "m3", read: true, day: "earlier", time: "Fri 20 Nov", canAnswer: false }),
  view({ id: "a6", kind: "match_cancelled", message: "Blue Hawks v Night Riders has been cancelled.", matchId: "m4", read: true, day: "earlier", time: "Thu 19 Nov", matchWhen: null, canAnswer: false }),
  view({ id: "a7", kind: "booking_share", message: "You are in the cost sharing for Clifton Indoor Arena.", matchId: null, bookingId: "b2", read: true, day: "earlier", matchWhen: null, canAnswer: false }),
  view({ id: "a8", kind: "booking_changed", message: "The cost for Clifton Indoor Arena changed to Rs 13,000.", matchId: null, bookingId: "b2", read: true, day: "earlier", matchWhen: null, canAnswer: false }),
  view({ id: "a9", kind: "match_changed", message: "A match that was deleted.", matchId: null, bookingId: null, read: true, day: "earlier", matchWhen: null, canAnswer: false }),
];
const renderList = (alerts: AlertView[]) => render(<SnackbarProvider><AlertsList communityId="c1" alerts={alerts} /></SnackbarProvider>);

/* ================= pure helpers ================= */
describe("alert kinds, filters and day headers", () => {
  it("every kind the code writes has an icon, a word and a group", () => {
    const kinds = ["match_scheduled", "match_reminder", "match_changed", "match_postponed", "match_cancelled", "booking_share", "booking_changed", "payment_reminder"];
    expect(Object.keys(ALERT_KINDS).sort()).toEqual([...kinds].sort());
    for (const k of kinds) {
      const m = kindMeta(k);
      expect(m.label.length).toBeGreaterThan(2);
      expect(m.icon).toBeTruthy();
    }
    expect(kindMeta("match_scheduled").label).toBe("New match");
    expect(kindMeta("match_cancelled").label).toBe("Cancelled");
    expect(kindMeta("payment_reminder").group).toBe("payment");
    expect(kindMeta("something_new").group).toBe("other");
  });
  it("only New match and Reminder alerts can be answered", () => {
    expect(canAnswerKind("match_scheduled")).toBe(true);
    expect(canAnswerKind("match_reminder")).toBe(true);
    expect(canAnswerKind("match_changed")).toBe(false);
    expect(canAnswerKind("booking_share")).toBe(false);
  });
  it("filters: All, Unread, Matches, Payments", () => {
    const list = [
      { kind: "match_scheduled", read: false }, { kind: "booking_share", read: true }, { kind: "payment_reminder", read: false }, { kind: "match_postponed", read: true },
    ];
    expect(list.filter((a) => matchesFilter(a, "all"))).toHaveLength(4);
    expect(list.filter((a) => matchesFilter(a, "unread"))).toHaveLength(2);
    expect(list.filter((a) => matchesFilter(a, "matches"))).toHaveLength(2);
    expect(list.filter((a) => matchesFilter(a, "payments"))).toHaveLength(2);
    expect(filterCounts(list)).toEqual({ all: 4, unread: 2, matches: 2, payments: 2 });
    expect(countsByKind(list).map((c) => [c.kind, c.n])).toEqual([["match_scheduled", 1], ["match_postponed", 1], ["booking_share", 1], ["payment_reminder", 1]]);
  });
  it("day headers use the viewer's own calendar day", () => {
    const now = new Date("2026-11-24T06:00:00Z"); // 11:00 in Karachi
    // 23:30 UTC on the 23rd is 04:30 on the 24th in Karachi: still today there, yesterday in UTC.
    const late = new Date("2026-11-23T23:30:00Z");
    expect(dayBucket(late, now, "Asia/Karachi")).toBe("today");
    expect(dayBucket(late, now, "UTC")).toBe("yesterday");
    expect(dayBucket(new Date("2026-11-23T10:00:00Z"), now, "UTC")).toBe("yesterday");
    expect(dayBucket(new Date("2026-11-20T10:00:00Z"), now, "UTC")).toBe("earlier");
    expect(dayBucket(new Date("2026-11-24T20:00:00Z"), now, "UTC")).toBe("today");
  });
  it("time label is the time for today and yesterday, the date for earlier", () => {
    const d = new Date("2026-11-20T15:15:00Z");
    expect(alertTimeLabel(d, "today", "UTC")).toMatch(/^3:15\s?pm$/i);
    expect(alertTimeLabel(d, "earlier", "UTC")).toBe("Fri 20 Nov");
  });
  it("the confirmation words", () => {
    expect(alertsMarkedText(4)).toBe("4 alerts marked as read");
    expect(alertsMarkedText(1)).toBe("1 alert marked as read");
  });
  it("community helpers", () => {
    expect(placesText(24)).toBe("75 places left. Numbers 1 to 99 are unique in a community.");
    expect(placesText(98)).toContain("1 place left");
    expect(progressPercent(24)).toBe(24);
    expect(progressPercent(200)).toBe(100);
    expect(FIRST_MEMBERS).toBe(5);
    for (const a of ["community_created", "request_approved", "joined_open", "member_left", "member_removed", "admin_granted", "admin_removed", "settings_changed", "match_created", "match_postponed", "match_cancelled", "match_corrected"]) {
      expect(activityIcon(a)).not.toBe("bell");
    }
    expect(activityIcon("unknown")).toBe("bell");
  });
});

/* ================= Alerts list ================= */
describe("Alerts list", () => {
  it("scenario 1: kind badges, Unread labels, day headers, filters and Mark all (N)", () => {
    renderList(mixed());
    for (const w of ["New match", "Reminder", "Changed", "Payment reminder", "Postponed", "Cancelled", "Payments", "Cost changed"]) {
      expect(screen.getAllByText(w).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Unread")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Today" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Yesterday" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Earlier" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All 9" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unread 4" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Matches" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Payments" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Mark all as read \(4\)/ })).toBeTruthy();
    // truth and the 50 limit
    expect(document.body.textContent).toContain("Phone push notifications are not switched on");
    expect(document.body.textContent).toContain("Only the latest 50 alerts are kept");
  });
  it("unread alerts carry the gold bar class, read ones are dimmed but readable", () => {
    const { container } = renderList(mixed());
    expect(container.querySelectorAll("article.unread")).toHaveLength(4);
    expect(container.querySelectorAll("article.read")).toHaveLength(5);
    expect(screen.getByText("Royal Panthers v Blue Hawks has been postponed.")).toBeTruthy();
  });
  it("links go to the match or payment; an alert whose match is gone is a plain card, not a link", () => {
    const { container } = renderList(mixed());
    const hrefs = Array.from(container.querySelectorAll("article a.al-body")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/c/c1/matches/m1");
    expect(hrefs).toContain("/c/c1/payments/b1");
    const plain = container.querySelector("article.plain")!;
    expect(plain.querySelector("a")).toBeNull();
    expect(plain.textContent).toContain("No longer available");
    expect(container.querySelectorAll("article.plain")).toHaveLength(1);
  });
  it("the cancelled match shows no match time line", () => {
    renderList([view({ id: "c", kind: "match_cancelled", matchWhen: null, canAnswer: false, message: "X v Y has been cancelled." })]);
    expect(document.querySelector(".al-when")).toBeNull();
  });
  it("only New match and Reminder alerts have I'm in / Can't make it", () => {
    const { container } = renderList(mixed());
    expect(container.querySelectorAll(".al-reply")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /I’m in/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Can’t make it/ })).toHaveLength(2);
  });
  it("answering calls the availability action and shows the reply on both alerts of that match", async () => {
    renderList(mixed());
    fireEvent.click(screen.getAllByRole("button", { name: /I’m in/ })[0]!);
    await waitFor(() => expect(acts.answer).toHaveBeenCalledWith("c1", "m1", "in"));
    await waitFor(() => expect(screen.getAllByText("You replied: I’m in")).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("button", { name: /Can’t make it/ })[0]!);
    await waitFor(() => expect(acts.answer).toHaveBeenLastCalledWith("c1", "m1", "out"));
    await waitFor(() => expect(screen.getAllByText("You replied: Can’t make it")).toHaveLength(2));
  });
  it("a refused reply says why in a message", async () => {
    acts.answer.mockResolvedValueOnce({ ok: false, error: "locked" } as never);
    renderList(mixed());
    fireEvent.click(screen.getAllByRole("button", { name: /I’m in/ })[0]!);
    await waitFor(() => expect(document.body.textContent).toContain("already started"));
  });
  it("a reply made earlier is shown as chosen", () => {
    renderList([view({ myAnswer: "in" })]);
    expect(screen.getByRole("button", { name: /I’m in/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("You replied: I’m in")).toBeTruthy();
  });
  it("scenario 4: the Unread filter narrows the list, a kebab has Mark as read and Open", () => {
    const { container } = renderList(mixed());
    fireEvent.click(screen.getByRole("button", { name: "Unread 4" }));
    expect(container.querySelectorAll("article")).toHaveLength(4);
    expect(container.querySelectorAll("article.read")).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Actions for this alert/ })[0]!);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Mark as read" })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Open match" }).getAttribute("href")).toBe("/c/c1/matches/m1");
  });
  it("Matches and Payments filters", () => {
    const { container } = renderList(mixed());
    fireEvent.click(screen.getByRole("button", { name: "Payments" }));
    expect(container.querySelectorAll("article")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Matches" }));
    expect(container.querySelectorAll("article")).toHaveLength(6);
  });
  it("an empty filter says so and offers Show all", () => {
    renderList([view({ read: true, canAnswer: false })]);
    fireEvent.click(screen.getByRole("button", { name: "Unread 0" }));
    expect(screen.getByText("No unread alerts")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all alerts" }));
    expect(document.querySelectorAll("article")).toHaveLength(1);
  });
  it("Mark as read from the menu calls the action for that alert and removes the Unread label", async () => {
    const { container } = renderList(mixed());
    fireEvent.click(screen.getAllByRole("button", { name: /Actions for this alert/ })[0]!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark as read" }));
    await waitFor(() => expect(acts.markOne).toHaveBeenCalledWith("c1", "a1"));
    expect(container.querySelectorAll("article.unread")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Mark all as read \(3\)/ })).toBeTruthy();
  });
  it("opening an unread alert (tapping its link) marks it read; a read alert does not call the action", async () => {
    const { container } = renderList(mixed());
    const unreadLinks = container.querySelectorAll("article.unread a.al-body");
    expect(unreadLinks.length).toBeGreaterThan(0);
    fireEvent.click(unreadLinks[0]!);
    await waitFor(() => expect(acts.markOne).toHaveBeenCalledTimes(1));
    const readLinks = container.querySelectorAll("article.read a.al-body");
    acts.markOne.mockClear();
    if (readLinks.length > 0) { fireEvent.click(readLinks[0]!); expect(acts.markOne).not.toHaveBeenCalled(); }
  });
  it("a read alert has no Mark as read item; a plain read card has no menu at all", () => {
    const { container } = renderList(mixed());
    const read = container.querySelector("article.read.link")!;
    fireEvent.click(within(read as HTMLElement).getByRole("button", { name: /Actions for this alert/ }));
    expect(screen.queryByRole("menuitem", { name: "Mark as read" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: /Open/ })).toBeTruthy();
    const plain = container.querySelector("article.plain")!;
    expect(within(plain as HTMLElement).queryByRole("button", { name: /Actions for this alert/ })).toBeNull();
  });
  it("scenario 3: Mark all as read tells how many, with Undo that restores exactly those alerts", async () => {
    const { container } = renderList(mixed());
    fireEvent.click(screen.getByRole("button", { name: /Mark all as read \(4\)/ }));
    await waitFor(() => expect(acts.markAll).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(document.body.textContent).toContain("2 alerts marked as read")); // the server said which ids it changed
    expect(container.querySelectorAll("article.unread")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Mark all as read/ })).toBeNull();
    // read cards keep their words and icon
    expect(screen.getAllByText("New match").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(acts.undo).toHaveBeenCalledWith("c1", ["a1", "a2"]));
    expect(container.querySelectorAll("article.unread")).toHaveLength(9);
  });
  it("scenario 2: the empty state has an icon, the truthful wording and a way back to Home", () => {
    const { container } = render(<AlertsEmpty communityId="c1" />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.textContent).toContain("No alerts yet");
    expect(container.textContent).toContain("phone push notifications are not switched on".replace("phone", "Phone"));
    expect(screen.getByRole("link", { name: "Back to Home" }).getAttribute("href")).toBe("/c/c1");
    cleanup();
    renderList([]);
    expect(document.body.textContent).toContain("No alerts yet");
  });
});

/* ================= Alerts page ================= */
describe("Alerts page (server markup)", () => {
  it("builds views in the viewer's zone, with a summary panel and counts per kind", async () => {
    const now = Date.now();
    h.alerts = [
      { id: "a1", match_id: "m1", booking_id: null, kind: "match_scheduled", message: "New match: A v B. Are you coming?", created_at: new Date(now - 60_000), read_at: null, scheduled_at: new Date(now + 86_400_000), status: "scheduled" },
      { id: "a2", match_id: "m2", booking_id: null, kind: "match_cancelled", message: "C v D has been cancelled.", created_at: new Date(now - 10 * 86_400_000), read_at: new Date(), scheduled_at: new Date(now + 86_400_000), status: "cancelled" },
      { id: "a3", match_id: "m3", booking_id: null, kind: "match_reminder", message: "Reminder: E v F.", created_at: new Date(now - 120_000), read_at: null, scheduled_at: new Date(now - 3_600_000), status: "in_progress" },
    ];
    h.answers = { m1: "in" };
    const out = html(<SnackbarProvider>{await AlertsPage(P)}</SnackbarProvider>);
    expect(out).toContain("Alerts");
    expect(out).toContain('aria-label="Alerts summary"');
    expect(out).toContain("3 kept, 2 unread");
    expect(out).toContain("Phone push notifications are not switched on");
    expect(out).toContain("You replied: I’m in");
    // a match that has started cannot be answered any more: only the first alert has reply buttons
    expect(out.match(/aria-label="Are you coming\?"/g)).toHaveLength(1);
    // cancelled: no match time line (only the first alert shows one)
    expect(out.match(/class="al-when"/g)).toHaveLength(2); // a1 and a3
  });
});

/* ================= Copy button ================= */
describe("Copy button", () => {
  it("success: green check and the word Copied for 1.8 seconds, then the label comes back", async () => {
    vi.useFakeTimers();
    const write = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText: write } });
    render(<CopyButton text="abc" label="Copy link" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy link" })); });
    expect(write).toHaveBeenCalledWith("abc");
    const done = screen.getByRole("button", { name: "Copied" });
    expect(done.className).toContain("green");
    expect(done.querySelector("svg")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(COPIED_MS - 10); });
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(20); });
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });
  it("refused: says Select and copy, selects the text of the named box and reports the state", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => { throw new Error("denied"); }) } });
    const seen: string[] = [];
    render(<><div id="box">https://x/join/ABC</div><CopyButton text="x" targetId="box" onState={(s) => seen.push(s)} /></>);
    await act(async () => { fireEvent.click(screen.getByRole("button")); });
    expect(screen.getByRole("button").textContent).toContain("Select and copy");
    expect(screen.getByRole("button").textContent).toContain(COPY_HINT);
    expect(window.getSelection()?.toString()).toBe("https://x/join/ABC");
    expect(seen).toEqual(["failed"]);
  });
  it("keeps its old props: only text is required, the label defaults to Copy", () => {
    render(<CopyButton text="abc" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });
});

/* ================= Invite pieces ================= */
describe("Invite: share, fields and replace", () => {
  it("Share opens the system share sheet when there is one", async () => {
    const share = vi.fn(async () => undefined);
    Object.assign(navigator, { share });
    render(<ShareButton name="KICC" link="https://x/join/A" code="A" />);
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const arg = (share.mock.calls[0] as unknown as [{ url: string }])[0];
    expect(arg.url).toBe("https://x/join/A");
    // @ts-expect-error cleanup
    delete navigator.share;
  });
  it("Share falls back to a WhatsApp link when sharing is not available", () => {
    // @ts-expect-error not available in this browser
    delete navigator.share;
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<ShareButton name="KICC" link="https://x/join/A" code="A" />);
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    expect(open).toHaveBeenCalledTimes(1);
    const url = String(open.mock.calls[0]![0]);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("https://x/join/A");
    expect(whatsappUrl("a b")).toBe("https://wa.me/?text=a%20b");
    open.mockRestore();
  });
  it("closing the share sheet is not an error and does not open WhatsApp", async () => {
    const err = Object.assign(new Error("closed"), { name: "AbortError" });
    Object.assign(navigator, { share: vi.fn(async () => { throw err; }) });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<ShareButton name="KICC" link="https://x/join/A" code="A" />);
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    await new Promise((r) => setTimeout(r, 0));
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
    // @ts-expect-error cleanup
    delete navigator.share;
  });
  it("copy refused: the link box gets the focus ring state and the hint appears", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => { throw new Error("no"); }) } });
    render(<InviteFields name="KICC" link="https://x/join/ABC" code="ABC" />);
    expect(screen.queryByText(COPY_HINT)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy link" })); });
    expect(screen.getByText(COPY_HINT)).toBeTruthy();
    expect(document.getElementById("iv-link")!.className).toContain("bad");
    expect(window.getSelection()?.toString()).toBe("https://x/join/ABC");
  });
  it("Replace link and code asks first, says what stops working, then confirms with a message", async () => {
    render(<SnackbarProvider><ReplaceInvite communityId="c1" /></SnackbarProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Replace link and code/ }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("old link");
    expect(dlg.textContent).toContain("old code");
    expect(dlg.textContent).toContain("QR code");
    expect(acts.replace).not.toHaveBeenCalled();
    // Cancel does nothing
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(acts.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Replace link and code/ }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Replace link" }));
    await waitFor(() => expect(acts.replace).toHaveBeenCalledTimes(1));
    const fd = acts.replace.mock.calls[0]![0];
    expect(fd.get("communityId")).toBe("c1");
    await waitFor(() => expect(document.body.textContent).toContain(REPLACED_MESSAGE));
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
});

/* ================= Invite page ================= */
const invite = async (isNew?: string) => html(<SnackbarProvider>{await InvitePage({ ...P, searchParams: Promise.resolve({ new: isNew }) })}</SnackbarProvider>);

describe("Invite page (server markup)", () => {
  it("scenario 1: Admin with approval: QR, link, code, Share, gold banner with Change in settings, Replace", async () => {
    const out = await invite();
    expect(out).toContain("Invite friends");
    expect(out).toContain('aria-label="Back"');
    expect(out).toContain("https://indoorkhelo.app/join/KICC-7Q4X");
    expect(out).toContain("KICC-7Q4X");
    expect(out).toContain("Copy link");
    expect(out).toContain("Copy code");
    expect(out).toContain("Share");
    expect(out).toContain("Approval is on");
    expect(out).toContain("New people wait until an Admin approves them.");
    expect(out).toContain('href="/c/c1/settings"');
    expect(out).toContain("Change in settings");
    expect(out).toContain("Replace link and code");
    expect(out).toContain("QR code that opens the invite link");
    expect(out).not.toContain("Go to Home");
  });
  it("scenario 2: a member sees Open joining and no Admin controls", async () => {
    h.role = "member";
    h.approval = false;
    const out = await invite();
    expect(out).toContain("Open joining");
    expect(out).toContain("Anyone with this link joins straight away.");
    expect(out).not.toContain("Change in settings");
    expect(out).not.toContain("Replace link and code");
    expect(out).toContain("Share");
  });
  it("scenario 3: ?new=1 says Community created, has no back arrow, a progress strip and a Go to Home button", async () => {
    const out = await invite("1");
    expect(out).toContain("Community created");
    expect(out).not.toContain('aria-label="Back"');
    expect(out).toContain("Karachi Indoor Cricket Club is ready");
    expect(out).toContain("Create");
    expect(out).toContain("Set up");
    expect(out).toContain('aria-label="Progress: Create, Set up, Invite"');
    expect(out).toContain("Go to Home");
    expect(out).toContain('href="/c/c1"');
    expect(out).toContain("Replace link and code"); // the founder sees the same tools
  });
});

/* ================= Community page ================= */
const member = (i: number, over: Partial<(typeof h.members)[number]> = {}) => ({ user_id: `u${i}`, name: `Player ${i}`, role: "member" as const, player_number: i, playing_role: null, ...over });
const community = async () => html(<SnackbarProvider>{await CommunityPage(P)}</SnackbarProvider>);

describe("Community page (server markup)", () => {
  it("scenario 1: Admin hub with stats, toolbox badge, timeline icons, kebabs, See all and the red leave card", async () => {
    h.members = [member(1, { user_id: "u1", name: "Ali Raza", role: "admin" }), ...Array.from({ length: 23 }, (_, i) => member(i + 2, { role: i === 0 ? "admin" : "member" }))];
    h.pending = [{ user_id: "p1" }, { user_id: "p2" }, { user_id: "p3" }];
    h.mine = [
      { id: "c1", name: "Karachi Indoor Cricket Club", role: "admin", status: "approved", player_number: 7 },
      { id: "c2", name: "Gulshan Gully Cricket", role: "member", status: "approved", player_number: 21 },
      { id: "c3", name: "DHA Friday Night Six", role: "admin", status: "approved", player_number: 4 },
      { id: "c4", name: "Waiting Club", role: "member", status: "pending", player_number: null },
    ];
    h.activity = [
      { action: "settings_changed", actor_name: "Ali Raza", target_name: null, created_at: new Date("2026-11-22T10:00:00Z") },
      { action: "match_created", actor_name: "Ali Raza", target_name: null, created_at: new Date("2026-11-21T10:00:00Z") },
    ];
    const out = await community();
    expect(out).toContain("Karachi Indoor Cricket Club");
    expect(out).toContain("Clifton, Karachi");
    expect(out).toContain("Weekly indoor cricket");
    expect(out).toContain("Invite");
    expect(out).toContain('href="/c/c1/settings"');
    expect(out).toContain("24<small");
    expect(out).toContain("/99");
    expect(out).toContain("Open requests");
    expect(out).toContain("75 places left");
    expect(out).toContain('aria-valuenow="24"');
    expect(out).toContain("Admin tools");
    expect(out).toContain("Admin only");
    expect(out).not.toContain("you see this because you are an Admin");
    expect(out).toContain('aria-label="3 waiting"');
    expect(out).toContain("Join requests");
    expect(out).toContain("Player numbers");
    expect(out).toContain("22 Nov");
    expect(out).toContain("cm-tl-ico");
    // the five first members use the gold shirt, with the kebab for Admins (not on yourself)
    expect(out.match(/class="item cm-member"/g)).toHaveLength(5);
    expect(out.match(/class="shirt"/g)!.length).toBeGreaterThanOrEqual(5);
    expect(out).toContain("See all 24");
    expect(out.match(/aria-label="Manage Player/g)).toHaveLength(4);
    expect(out).not.toContain('aria-label="Manage Ali Raza"');
    // your communities: pending ones are not listed; Create another / Join another
    expect(out).toContain("Gulshan Gully Cricket");
    expect(out).toContain('href="/switch/c2"');
    expect(out).toContain("DHA Friday Night Six");
    expect(out).not.toContain("Waiting Club");
    expect(out).toContain("Create another");
    expect(out).toContain("Join another");
    // leave
    expect(out).toContain("cm-leave");
    expect(out).toContain("Your career stats stay with you.");
    expect(out).toContain('href="/c/c1/leave"');
  });
  it("scenario 2: a member has no Admin card, no Settings button and no kebabs", async () => {
    h.role = "member";
    h.members = [member(1, { user_id: "u1", name: "Ali Raza" }), member(2, { role: "admin", name: "Hamza Khan", playing_role: "Batter" })];
    h.mine = [{ id: "c1", name: "Karachi Indoor Cricket Club", role: "member", status: "approved", player_number: 7 }];
    h.activity = [{ action: "member_left", actor_name: "Zain", target_name: null, created_at: new Date() }];
    const out = await community();
    expect(out).not.toContain("Admin tools");
    expect(out).not.toContain("Open requests");
    expect(out).not.toContain('href="/c/c1/settings"');
    expect(out).not.toContain("menu-btn");
    expect(out).toContain("Your role");
    expect(out).toContain("Batter");
    expect(out).toContain('class="pill green">Admin<');
    expect(out).toContain("Leave community");
  });
  it("scenario 3: a brand-new community: one member, no description, no See all, one activity, no others", async () => {
    h.members = [member(1, { user_id: "u1", name: "Ali Raza", role: "admin" })];
    h.activity = [{ action: "community_created", actor_name: "Ali Raza", target_name: null, created_at: new Date() }];
    h.mine = [{ id: "c1", name: "Karachi Indoor Cricket Club", role: "admin", status: "approved", player_number: 7 }];
    const out = await community();
    expect(out).toContain("98 places left");
    expect(out).not.toContain("See all");
    expect(out).toContain('aria-valuenow="1"');
    expect(out.match(/class="item cm-member"/g)).toHaveLength(1);
    expect(out).toContain("Current");
    expect(out).not.toContain('href="/switch/');
  });
  it("scenario 3 (exactly 5 members): still no See all", async () => {
    h.members = Array.from({ length: 5 }, (_, i) => member(i + 1));
    expect(await community()).not.toContain("See all");
    h.members = Array.from({ length: 6 }, (_, i) => member(i + 1));
    expect(await community()).toContain("See all 6");
  });
  it("scenario 4: a member of 4 communities sees role and number per community and a Switch link each", async () => {
    h.members = [member(1)];
    h.mine = [
      { id: "c1", name: "Karachi Indoor Cricket Club", role: "admin", status: "approved", player_number: 7 },
      { id: "c2", name: "Gulshan Gully Cricket", role: "member", status: "approved", player_number: 21 },
      { id: "c3", name: "DHA Friday Night Six", role: "admin", status: "approved", player_number: 4 },
      { id: "c4", name: "Saddar Sixes", role: "member", status: "approved", player_number: null },
    ];
    const out = await community();
    expect(out).toContain("Member · #21");
    expect(out).toContain("Admin · #4");
    expect(out.match(/href="\/switch\/c\d"/g)).toHaveLength(3);
    expect(out).toContain('aria-label="Switch to Saddar Sixes"');
  });
});
