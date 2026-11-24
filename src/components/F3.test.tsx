// @vitest-environment jsdom
// Phase F3 (UI redesign): Payments home, New booking, Venues, Venue edit/delete and Edit booking.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/payments", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

type R = { error?: string; fieldErrors?: Record<string, string>; message?: string };
const createBooking = vi.fn<(p: R, fd: FormData) => Promise<R>>(async () => ({}));
const updateBooking = vi.fn<(p: R, fd: FormData) => Promise<R>>(async () => ({}));
const createVenue = vi.fn<(p: R, fd: FormData) => Promise<R>>(async () => ({}));
const updateVenue = vi.fn<(p: R, fd: FormData) => Promise<R>>(async () => ({}));
const deleteVenue = vi.fn<(fd: FormData) => void>();
vi.mock("@/app/actions7", () => ({
  createBookingAction: (p: R, fd: FormData) => createBooking(p, fd),
  updateBookingAction: (p: R, fd: FormData) => updateBooking(p, fd),
  createVenueAction: (p: R, fd: FormData) => createVenue(p, fd),
  updateVenueAction: (p: R, fd: FormData) => updateVenue(p, fd),
  deleteVenueAction: (fd: FormData) => deleteVenue(fd),
}));

import PvBookingForm from "@/components/PvBookingForm";
import PvHome from "@/components/PvHome";
import PvVenues from "@/components/PvVenues";
import { PvVenueMenu } from "@/components/PvVenueEdit";
import { PvVenueBody, PvVenuePanel } from "@/components/PvVenueView";
import { SnackbarProvider } from "@/components/Snackbar";
import type { PvBooking } from "@/lib/pvData";

beforeEach(() => {
  for (const f of [createBooking, updateBooking, createVenue, updateVenue]) { f.mockReset(); f.mockImplementation(async () => ({})); }
  deleteVenue.mockReset();
  try { sessionStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); Reflect.deleteProperty(window, "matchMedia"); });

const wrap = (n: React.ReactNode) => <SnackbarProvider>{n}</SnackbarProvider>;
const submit = async (c: HTMLElement) => { await act(async () => { fireEvent.submit(c.querySelector("form")!); }); };
const sent = (m: typeof createBooking, i = 0) => Object.fromEntries((m.mock.calls[i]![1] as FormData).entries()) as Record<string, string>;

/* ---------------------------------------------------------------- fixtures ---------------------------------------------------------------- */
const mk = (o: Partial<PvBooking> & { id: string }): PvBooking => ({
  venue: "Clifton Indoor Arena", address: "Block 4", whenText: "Fri 28 Nov, 8:00 pm", duration: 120, status: "confirmed", total: 12000, contributed: 8500, members: 12, share: 1000, extra: 0, percent: 71,
  verified: 7000, balance: 3500, overBy: 0, refunded: 0, owing: 3,
  toCover: [
    { key: "u:1", name: "Zain Malik", number: 3, guest: false, net: 500, share: 1000, status: "pending" },
    { key: "u:2", name: "Hassan Raza", number: 5, guest: false, net: 0, share: 1000, status: "unpaid" },
    { key: "g:sami", name: "Sami", number: null, guest: true, net: 400, share: 1000, status: "partial" },
  ], ...o,
});
const upcoming: PvBooking[] = [
  mk({ id: "b1" }),
  mk({ id: "b2", venue: "Seaview Sports Complex", whenText: "Sat 29 Nov, 6:00 pm", duration: 90, status: "pending", total: 7500, contributed: 0, members: 10, percent: 0, owing: 10, verified: 0, balance: 7500, toCover: [] }),
  mk({ id: "b4", whenText: "Mon 1 Dec, 8:00 pm", status: "pending", total: 9000, contributed: 9500, members: 9, percent: 100, owing: 0, overBy: 500, toCover: [] }),
];
const past: PvBooking[] = [
  mk({ id: "b5", status: "completed", whenText: "Sat 22 Nov, 8:00 pm", contributed: 12000, percent: 100, owing: 0, verified: 12000, balance: 0, toCover: [] }),
  mk({ id: "b6", status: "cancelled", whenText: "Wed 12 Nov, 8:00 pm", contributed: 6500, percent: 54, owing: 5 }),
];
const home = (p: Partial<React.ComponentProps<typeof PvHome>> = {}) => render(wrap(<PvHome communityId="c1" upcoming={upcoming} past={past} venueCount={3} deleted={false} {...p} />));

/* ====================================================================== Payments home ====================================================================== */
describe("Payments home: bookings that lead with the money (scenario 1)", () => {
  it("each card shows the ring percentage, the money in PKR, the status as a word and one line saying what needs action", () => {
    const { container } = home();
    const cards = container.querySelectorAll("a.pv-card");
    expect(cards).toHaveLength(5);
    const first = cards[0]!;
    expect(within(first as HTMLElement).getByRole("img", { name: "71 percent contributed" })).toBeTruthy();
    expect(first.textContent).toContain("PKR 8,500");
    expect(first.textContent).toContain("of PKR 12,000");
    expect(first.textContent).toContain("CONFIRMED");
    expect(first.textContent).toContain("12 sharing");
    expect(first.textContent).toContain("3 unpaid");
    expect(first.getAttribute("href")).toBe("/c/c1/payments/b1");
    expect(container.textContent).toContain("over by PKR 500");
    expect(container.textContent).toContain("all covered");
    expect(container.textContent).toContain("refunds by hand");
    expect(container.textContent).toContain("COMPLETED");
    expect(container.textContent).toContain("CANCELLED");
  });
  it("upcoming and past sit in their own sections with counts", () => {
    home();
    expect(screen.getByRole("heading", { name: "Upcoming · 3" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Past and cancelled · 2" })).toBeTruthy();
  });
  it("filter tabs: All 5, Upcoming 3, Past and cancelled 2; choosing one hides the other section", () => {
    home();
    const group = screen.getByRole("group", { name: "Show bookings" });
    expect(within(group).getByRole("button", { name: /^All 5/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(group).getByRole("button", { name: /^Upcoming 3/ }));
    expect(screen.queryByRole("heading", { name: /Past and cancelled/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Upcoming · 3" })).toBeTruthy();
    fireEvent.click(within(group).getByRole("button", { name: /^Past and cancelled 2/ }));
    expect(screen.queryByRole("heading", { name: /Upcoming/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Past and cancelled · 2" })).toBeTruthy();
  });
  it("one gold New booking button and a quiet way to Venues are always reachable, and the privacy rule stays visible", () => {
    const { container } = home();
    const fab = Array.from(container.querySelectorAll("a")).filter((a) => a.getAttribute("href") === "/c/c1/payments/new");
    expect(fab.length).toBeGreaterThan(0);
    expect(container.textContent).toContain("never appear on stats pages and never change scores");
  });
  it("the preview lists who still has to cover their share, with the exact status words, grey shirt and name for a guest", () => {
    const { container } = home();
    const prev = container.querySelector("aside.pv-prev") as HTMLElement;
    expect(within(prev).getByText("Zain Malik")).toBeTruthy();
    expect(within(prev).getByText("PENDING CHECK")).toBeTruthy();
    expect(within(prev).getByText("UNPAID")).toBeTruthy();
    expect(within(prev).getByText("PARTLY PAID")).toBeTruthy();
    expect(within(prev).getByText("Sami (guest)")).toBeTruthy();
    expect(within(prev).getByRole("img", { name: "Sami, guest" })).toBeTruthy();
    expect(within(prev).getByText(/Suggested share: PKR 1,000 each/)).toBeTruthy();
    expect(within(prev).getByText(/Only a suggestion/)).toBeTruthy();
    expect(within(prev).getByRole("link", { name: /Open booking/ }).getAttribute("href")).toBe("/c/c1/payments/b1");
    expect(within(prev).getByRole("link", { name: /Record payment/ }).getAttribute("href")).toBe("/c/c1/payments/b1?record=me");
  });
  it("on a wide screen a click selects the booking in the preview instead of leaving the page", () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes("1280"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
    const { container } = home();
    const second = container.querySelectorAll("a.pv-card")[1]!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => { second.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    const prev = container.querySelector("aside.pv-prev") as HTMLElement;
    expect(within(prev).getByRole("heading", { name: "Seaview Sports Complex" })).toBeTruthy();
    expect(second.getAttribute("aria-current")).toBe("true");
  });
  it("on a phone a click is a normal link (matchMedia says narrow)", () => {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
    const { container } = home();
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    container.querySelectorAll("a.pv-card")[1]!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
  it("a booking whose cost is already contributed says all covered and no one is still to cover, even if the shares were not paid one by one", () => {
    const { container } = home({ upcoming: [mk({ id: "z", contributed: 12000, percent: 100, balance: 0, owing: 11 })], past: [] });
    expect(container.querySelector("a.pv-card")!.textContent).toContain("all covered");
    expect(container.querySelector("aside.pv-prev")!.textContent).toContain("Still to cover (0)");
    expect(container.querySelector("aside.pv-prev")!.textContent).toContain("The full cost has been contributed.");
  });
  it("a cancelled booking with money says refunds are done by hand, outside the app", () => {
    const { container } = home({ upcoming: [], past: [past[1]!] });
    expect(container.querySelector("aside.pv-prev")!.textContent).toContain("Refunds are done by hand, outside the app");
  });
});

describe("Payments home: first time (scenario 2)", () => {
  it("no venue yet: a 4-step start with Add your venue as the gold step and Create a booking waiting", () => {
    const { container } = home({ upcoming: [], past: [], venueCount: 0 });
    expect(screen.getByRole("heading", { name: "No bookings yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /1 · Add your venue/ }).getAttribute("href")).toBe("/c/c1/payments/venues");
    expect(screen.queryByRole("link", { name: /Create a booking/ })).toBeNull();
    expect(container.querySelectorAll(".pv-start-steps li")).toHaveLength(4);
    expect(container.querySelector(".pv-start-steps li.now")!.textContent).toBe("Venue");
    expect(container.textContent).toContain("Paying is up to the group: nobody is forced, and one person can cover it all.");
  });
  it("a venue exists but no booking: the step moves on to Create a booking", () => {
    const { container } = home({ upcoming: [], past: [], venueCount: 2 });
    expect(screen.getByRole("link", { name: /Create a booking/ }).getAttribute("href")).toBe("/c/c1/payments/new");
    expect(container.querySelector(".pv-start-steps li.now")!.textContent).toBe("Booking");
  });
});

describe("Payments home: after deleting a booking and only past bookings (scenarios 3 and 4)", () => {
  it("a green banner with the text and a toast, no undo", () => {
    const { container } = home({ upcoming: [upcoming[0]!], past: [], deleted: true });
    expect(container.querySelector(".pv-banner.green")!.textContent).toContain("Booking deleted.");
    expect(screen.getAllByText("Booking deleted.").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("button", { name: /Undo/ })).toBeNull();
  });
  it("only past bookings: nothing upcoming is said plainly and the preview opens the most recent past booking", () => {
    const { container } = home({ upcoming: [], past });
    expect(container.textContent).toContain("Nothing upcoming right now.");
    const prev = container.querySelector("aside.pv-prev") as HTMLElement;
    expect(within(prev).getByRole("heading", { name: "Clifton Indoor Arena" })).toBeTruthy();
    expect(prev.textContent).toContain("COMPLETED");
  });
  it("a completed, fully paid booking says all covered with a full ring", () => {
    const { container } = home({ upcoming: [], past: [past[0]!] });
    const card = container.querySelector("a.pv-card")!;
    expect(card.textContent).toContain("all covered");
    expect(within(card as HTMLElement).getByRole("img", { name: "100 percent contributed" })).toBeTruthy();
  });
});

/* ====================================================================== New booking ====================================================================== */
const venues = [
  { id: "v1", name: "Clifton Indoor Arena", address: "Block 4, Clifton, Karachi" },
  { id: "v2", name: "Seaview Sports Complex", address: "" },
];
const form = (p: Partial<React.ComponentProps<typeof PvBookingForm>> = {}) => render(wrap(<PvBookingForm mode="create" communityId="c1" venues={venues} cancelHref="/c/c1/payments" {...p} />));
const input = (c: HTMLElement, sel: string) => c.querySelector<HTMLInputElement>(sel)!;
const chip = (name: RegExp) => screen.getByRole("button", { name });

function fillValid(c: HTMLElement) {
  fireEvent.click(screen.getByRole("radio", { name: /Clifton Indoor Arena/ }));
  fireEvent.change(input(c, "#pv-date"), { target: { value: "2026-11-28" } });
  fireEvent.change(input(c, "#pv-time"), { target: { value: "20:00" } });
  fireEvent.change(input(c, "#pv-cost"), { target: { value: "12000" } });
}

describe("New booking: the form (scenarios 2 and 3)", () => {
  it("shows the 3 steps with Details first, the venues as a pick list with address, and Add another venue", () => {
    const { container } = form();
    expect(container.querySelector(".pv-steps")!.getAttribute("aria-label")).toBe("Step 1 of 3");
    expect(Array.from(container.querySelectorAll(".pv-steps li")).map((l) => l.textContent)).toEqual(["Details", "Who shares", "Payments"]);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText("Block 4, Clifton, Karachi")).toBeTruthy();
    expect(screen.getByText("No address")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Add another venue/ }).getAttribute("href")).toBe("/c/c1/payments/venues");
  });
  it("posts the SAME field names as before: communityId, venueId, when, durationMinutes, totalCost, reference, notes and tz", async () => {
    const { container } = form();
    fillValid(container);
    fireEvent.change(input(container, "#pv-ref"), { target: { value: "CIA-2291" } });
    fireEvent.change(input(container, "#pv-notes"), { target: { value: "Court 2" } });
    await submit(container);
    expect(createBooking).toHaveBeenCalledTimes(1);
    const f = sent(createBooking);
    expect(f).toMatchObject({ communityId: "c1", venueId: "v1", when: "2026-11-28T20:00", durationMinutes: "60", totalCost: "12000", reference: "CIA-2291", notes: "Court 2" });
    expect("tz" in f).toBe(true);
    expect(updateBooking).not.toHaveBeenCalled();
  });
  it("duration chips: one tap sets the minutes, Other shows a number box and that number wins", async () => {
    const { container } = form();
    expect(chip(/^60 min/).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip(/^45 min/));
    await submit(container);
    expect(sent(createBooking).durationMinutes).toBe("45");
    fireEvent.click(chip(/^Other/));
    const n = screen.getByLabelText("Duration in minutes", { selector: "input" });
    fireEvent.change(n, { target: { value: "100" } });
    expect(chip(/^Other/).getAttribute("aria-pressed")).toBe("true");
    await submit(container);
    expect(sent(createBooking, 1).durationMinutes).toBe("100");
  });
  it("the live example split rounds UP and says it is only an example", () => {
    const { container } = form();
    expect(container.querySelector(".pv-example")).toBeNull();
    fireEvent.change(input(container, "#pv-cost"), { target: { value: "12000" } });
    expect(container.querySelector(".pv-example")!.textContent).toContain("If 10 people share: PKR 1,200 each");
    expect(container.querySelector(".pv-example")!.textContent).toContain("Paying stays up to the group");
    fireEvent.change(input(container, "#pv-cost"), { target: { value: "10001" } });
    expect(container.querySelector(".pv-example")!.textContent).toContain("PKR 1,001 each (rounded up, PKR 9 extra)");
    fireEvent.change(input(container, "#pv-cost"), { target: { value: "12.5" } });
    expect(container.querySelector(".pv-example")).toBeNull();
  });
  it("the notes counter counts to 300 and the hint about choosing who shares afterwards stays", () => {
    const { container } = form();
    expect(container.textContent).toContain("0 / 300");
    fireEvent.change(input(container, "#pv-notes"), { target: { value: "Pay at the counter" } });
    expect(container.textContent).toContain("18 / 300");
    expect(container.textContent).toContain("Choose who shares the cost, and link matches, after saving.");
  });
  it("only a date, or only a time, sends an empty when so the server asks for both", async () => {
    const { container } = form();
    fireEvent.change(input(container, "#pv-date"), { target: { value: "2026-11-28" } });
    await submit(container);
    expect(sent(createBooking).when).toBe("");
  });
  it("Cancel goes back, and the Create button sits in the sticky bar", () => {
    const { container } = form();
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/c/c1/payments");
    expect(container.querySelector(".pv-actions button")!.textContent).toBe("Create booking");
  });
});

describe("New booking: every validation message (scenario 4) and server refusals (scenario 6)", () => {
  const msgs = {
    venueId: "Choose a venue (add one first if the list is empty).", when: "That date and time is in the past. Choose today or a later day.",
    durationMinutes: "Duration must be a whole number of minutes, from 15 to 720.", totalCost: "Total cost must be a whole number of rupees from 0 to 10,000,000.",
    reference: "The booking reference can be at most 40 characters.", notes: "Notes can be at most 300 characters.",
  };
  it("keeps the exact wording, adds an icon and a red ring on each field, and a summary banner on top", async () => {
    createBooking.mockResolvedValueOnce({ error: "Please fix the highlighted fields.", fieldErrors: msgs });
    const { container } = form();
    await submit(container);
    const banner = container.querySelector("[data-pv-summary]")!;
    expect(banner.textContent).toContain("Please fix the highlighted fields.");
    expect(banner.getAttribute("role")).toBe("alert");
    for (const m of Object.values(msgs)) expect(screen.getByText(m)).toBeTruthy();
    expect(container.querySelectorAll(".pv-err svg").length).toBe(6);
    expect(input(container, "#pv-cost").getAttribute("aria-invalid")).toBe("true");
    expect(input(container, "#pv-date").getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".pv-cost.bad")).toBeTruthy();
    expect(container.querySelector(".pv-if.bad")).toBeTruthy();
    expect(container.querySelectorAll(".pv-venue.bad").length).toBe(2);
    expect(document.activeElement).toBe(banner);
  });
  it("typed values survive a refusal", async () => {
    createBooking.mockResolvedValueOnce({ error: "Please fix the highlighted fields.", fieldErrors: { totalCost: msgs.totalCost } });
    const { container } = form();
    fillValid(container);
    fireEvent.change(input(container, "#pv-cost"), { target: { value: "12.5" } });
    await submit(container);
    expect(input(container, "#pv-cost").value).toBe("12.5");
    expect(input(container, "#pv-date").value).toBe("2026-11-28");
    expect((screen.getByRole("radio", { name: /Clifton Indoor Arena/ }) as HTMLInputElement).checked).toBe(true);
  });
  it("the time zone refusal is a red banner at the top with a Reload page button", async () => {
    createBooking.mockResolvedValueOnce({ error: "We could not read your phone's time zone. Please reload the page and try again." });
    const { container } = form();
    await submit(container);
    expect(container.querySelector("[data-pv-summary]")!.textContent).toContain("We could not read your phone's time zone. Please reload the page and try again.");
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  });
  it("the other server refusals are shown the same way", async () => {
    createBooking.mockResolvedValueOnce({ error: "Only members of this community can create bookings." });
    const { container } = form();
    await submit(container);
    expect(container.querySelector("[data-pv-summary]")!.textContent).toContain("Only members of this community can create bookings.");
    expect(screen.queryByRole("button", { name: "Reload page" })).toBeNull();
  });
  it("a venue refusal from the server marks the venue list", async () => {
    createBooking.mockResolvedValueOnce({ error: "Please fix the highlighted fields.", fieldErrors: { venueId: "Choose a venue from this community." } });
    const { container } = form();
    await submit(container);
    expect(screen.getByText("Choose a venue from this community.")).toBeTruthy();
    expect(container.querySelectorAll(".pv-venue.bad").length).toBe(2);
  });
});

describe("New booking: saving in progress (scenario 5)", () => {
  it("the button is disabled and says Saving…, and a second submit does not send a second booking", async () => {
    let release!: () => void;
    createBooking.mockImplementationOnce(() => new Promise<R>((res) => { release = () => res({}); }));
    const { container } = form();
    await submit(container);
    const btn = container.querySelector(".pv-actions button.gold") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("Saving…");
    await submit(container);
    expect(createBooking).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
  });
});

describe("New booking: typed values survive Add another venue", () => {
  it("clicking the link keeps a draft for one round trip, and the next form fills itself from it", () => {
    const first = form();
    fillValid(first.container);
    fireEvent.change(input(first.container, "#pv-notes"), { target: { value: "Court 2" } });
    fireEvent.click(screen.getByRole("link", { name: /Add another venue/ }));
    first.unmount();
    const { container } = form();
    expect(input(container, "#pv-cost").value).toBe("12000");
    expect(input(container, "#pv-date").value).toBe("2026-11-28");
    expect(input(container, "#pv-notes").value).toBe("Court 2");
    expect((screen.getByRole("radio", { name: /Clifton Indoor Arena/ }) as HTMLInputElement).checked).toBe(true);
    cleanup();
    expect(input(form().container, "#pv-cost").value).toBe("");   // used once, then gone
  });
});

/* ====================================================================== Edit booking ====================================================================== */
const defaults = { venueId: "v1", when: "2026-11-28T20:00", durationMinutes: 120, totalCost: 12000, reference: "CIA-2291", notes: "Pay at the counter before play. Court 2." };
const edit = (p: Partial<React.ComponentProps<typeof PvBookingForm>> = {}) => render(wrap(<PvBookingForm mode="edit" communityId="c1" bookingId="b1" venues={venues} defaults={defaults} people={12} cancelHref="/c/c1/payments/b1" {...p} />));

describe("Edit booking: prefilled (scenarios 1 and 2)", () => {
  it("every current field is prefilled and posts to the update action with the booking id", async () => {
    const { container } = edit();
    expect(input(container, "#pv-cost").value).toBe("12000");
    expect(input(container, "#pv-date").value).toBe("2026-11-28");
    expect(input(container, "#pv-time").value).toBe("20:00");
    expect(input(container, "#pv-ref").value).toBe("CIA-2291");
    expect(chip(/^120 min/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Step 1 of 3")).toBeNull();
    // no cost change: saved at once
    await submit(container);
    expect(updateBooking).toHaveBeenCalledTimes(1);
    expect(createBooking).not.toHaveBeenCalled();
    expect(sent(updateBooking)).toMatchObject({ communityId: "c1", bookingId: "b1", venueId: "v1", when: "2026-11-28T20:00", durationMinutes: "120", totalCost: "12000" });
  });
  it("a 100-minute booking selects the Other chip and shows the number instead of an empty-looking select", () => {
    edit({ defaults: { ...defaults, durationMinutes: 100 } });
    expect(chip(/^Other/).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText("Duration in minutes", { selector: "input" }) as HTMLInputElement).value).toBe("100");
    expect(screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true")).toHaveLength(1);
  });
  it("the What this changes panel shows people sharing, the share now and after (rounded up), and the extra, and updates as the cost changes", () => {
    const { container } = edit();
    const panel = container.querySelector("aside.pv-effect") as HTMLElement;
    expect(panel.textContent).toContain("People sharing12");
    expect(panel.textContent).toContain("Suggested share nowPKR 1,000");
    expect(panel.textContent).toContain("Suggested share afterPKR 1,000");
    fireEvent.change(input(container, "#pv-cost"), { target: { value: "14000" } });
    expect(panel.textContent).toContain("Suggested share afterPKR 1,167");
    expect(panel.textContent).toContain("Rounding extraPKR 4");
    expect(panel.textContent).toContain("the people sharing are told");
    fireEvent.change(input(container, "#pv-cost"), { target: { value: "abc" } });
    expect(panel.textContent).toContain("Suggested share after—");
  });
  it("with nobody sharing yet the panel says a cost change tells no one, and the example split is shown instead", () => {
    const { container } = edit({ people: 0 });
    expect(container.querySelector("aside.pv-effect")!.textContent).toContain("Nobody has been chosen to share the cost yet");
    expect(container.querySelector(".pv-example")).toBeTruthy();
  });
  it("Cancel is a link back to the booking", () => {
    edit();
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/c/c1/payments/b1");
  });
});

describe("Edit booking: a cost change is confirmed first (scenario 3)", () => {
  it("names the effect on the people sharing, with the old and new share, and nothing is saved until confirmed", async () => {
    const { container } = edit();
    fireEvent.change(input(container, "#pv-cost"), { target: { value: "14000" } });
    await submit(container);
    expect(updateBooking).not.toHaveBeenCalled();
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByRole("heading", { name: "Change the cost to PKR 14,000?" })).toBeTruthy();
    expect(dlg.textContent).toContain("12 people");
    expect(dlg.textContent).toContain("PKR 1,000");
    expect(dlg.textContent).toContain("PKR 1,167");
    expect(dlg.textContent).toContain("rounded up, PKR 4 extra");
    expect(dlg.textContent).toContain("The members sharing will be told");
    expect(dlg.textContent).toContain("Payments already recorded stay as they are");
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Change the cost" })); });
    expect(updateBooking).toHaveBeenCalledTimes(1);
    expect(sent(updateBooking).totalCost).toBe("14000");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("Keep PKR 12,000 closes the box, puts the old cost back and saves nothing", async () => {
    const { container } = edit();
    fireEvent.change(input(container, "#pv-cost"), { target: { value: "14000" } });
    await submit(container);
    fireEvent.click(screen.getByRole("button", { name: "Keep PKR 12,000" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateBooking).not.toHaveBeenCalled();
    expect(input(container, "#pv-cost").value).toBe("12000");
  });
  it("no confirm when nobody shares yet (nobody is affected), or when the cost is not a valid amount (the server will explain)", async () => {
    const a = edit({ people: 0 });
    fireEvent.change(input(a.container, "#pv-cost"), { target: { value: "14000" } });
    await submit(a.container);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateBooking).toHaveBeenCalledTimes(1);
    cleanup();
    const b = edit();
    fireEvent.change(input(b.container, "#pv-cost"), { target: { value: "12.5" } });
    await submit(b.container);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateBooking).toHaveBeenCalledTimes(2);
  });
});

describe("Edit booking: refusals and saving (scenarios 4 and 5)", () => {
  it("shows every validation message with icons and the summary on top", async () => {
    updateBooking.mockResolvedValueOnce({ error: "Please fix the highlighted fields.", fieldErrors: { venueId: "Choose a venue from this community.", when: "Choose a real date and time.", totalCost: "Total cost must be a whole number of rupees from 0 to 10,000,000." } });
    const { container } = edit();
    fireEvent.change(input(container, "#pv-cost"), { target: { value: "12.5" } });
    await submit(container);
    expect(container.querySelector("[data-pv-summary]")!.textContent).toContain("Please fix the highlighted fields.");
    expect(screen.getByText("Choose a real date and time.")).toBeTruthy();
    expect(container.querySelectorAll(".pv-err svg").length).toBe(3);
  });
  it("the server's other refusals are shown as the banner", async () => {
    updateBooking.mockResolvedValueOnce({ error: "That booking no longer exists." });
    const { container } = edit();
    await submit(container);
    expect(container.querySelector("[data-pv-summary]")!.textContent).toContain("That booking no longer exists.");
  });
  it("saving in progress: disabled Saving… and no double save", async () => {
    let release!: () => void;
    updateBooking.mockImplementationOnce(() => new Promise<R>((res) => { release = () => res({}); }));
    const { container } = edit();
    await submit(container);
    const btn = container.querySelector(".pv-actions button.gold") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("Saving…");
    await submit(container);
    expect(updateBooking).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
  });
});

/* ====================================================================== Venues ====================================================================== */
const vlist = [
  { id: "v1", name: "Clifton Indoor Arena", address: "Block 4, Clifton, Karachi", contact: "0300 1234567", booking_count: 6 },
  { id: "v2", name: "Seaview Sports Complex", address: "", contact: "", booking_count: 3 },
  { id: "v4", name: "Gulshan Sports Hub", address: "Block 13-D, Gulshan-e-Iqbal", contact: "", booking_count: 0 },
];
const venuesPage = (p: Partial<React.ComponentProps<typeof PvVenues>> = {}) => render(wrap(<PvVenues communityId="c1" venues={vlist} added={false} {...p} />));

describe("Venues: the list (scenarios 1 and 2)", () => {
  it("every row has an initials mark, the address (or No address), the contact and a booking-count badge", () => {
    const { container } = venuesPage();
    const rows = container.querySelectorAll("li.pv-vrow");
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain("CI");
    expect(rows[0]!.textContent).toContain("Block 4, Clifton, Karachi · 0300 1234567");
    expect(rows[0]!.textContent).toMatch(/6 bookings/);
    expect(rows[1]!.textContent).toContain("No address");
    expect(rows[2]!.textContent).toMatch(/0 bookings/);
    expect(within(rows[0] as HTMLElement).getAllByRole("link")[0]!.getAttribute("href")).toBe("/c/c1/payments/venues/v1");
  });
  it("edit and delete are on every row: an edit link, and delete that is locked (with the reason) when bookings use the venue", () => {
    const { container } = venuesPage();
    const rows = container.querySelectorAll("li.pv-vrow");
    expect(within(rows[0] as HTMLElement).getByRole("link", { name: "Edit Clifton Indoor Arena" }).getAttribute("href")).toBe("/c/c1/payments/venues/v1");
    const locked = within(rows[0] as HTMLElement).getByRole("button", { name: /Delete Clifton Indoor Arena \(not available: 6 bookings\)/ }) as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    expect(locked.title).toBe("It has 6 bookings, so it stays");
    expect((within(rows[2] as HTMLElement).getByRole("button", { name: "Delete Gulshan Sports Hub" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("the three-dots menu has Edit venue and Delete venue", () => {
    const { container } = venuesPage();
    const row = container.querySelectorAll("li.pv-vrow")[2] as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Actions for Gulshan Sports Hub" }));
    expect(screen.getByRole("menuitem", { name: "Edit venue" }).getAttribute("href")).toBe("/c/c1/payments/venues/v4");
    expect(screen.getByRole("menuitem", { name: "Delete venue" })).toBeTruthy();
  });
  it("the busiest venue's badge stands out", () => {
    const { container } = venuesPage();
    expect(container.querySelectorAll(".pv-badge.top")).toHaveLength(1);
    expect(container.querySelector(".pv-badge.top")!.textContent).toBe("6 bookings");
  });
  it("search narrows the list by name, address or contact and says when nothing matches", () => {
    const { container } = venuesPage();
    const box = screen.getByRole("searchbox", { name: "Search venues" });
    fireEvent.change(box, { target: { value: "gulshan" } });
    expect(container.querySelectorAll("li.pv-vrow")).toHaveLength(1);
    fireEvent.change(box, { target: { value: "zzz" } });
    expect(container.querySelectorAll("li.pv-vrow")).toHaveLength(0);
    expect(container.textContent).toContain("No venue matches “zzz”.");
  });
  it("no venues yet: an icon, the same sentence, an Add button, and the Add card is in the page", () => {
    const { container } = venuesPage({ venues: [] });
    expect(screen.getByRole("heading", { name: "No venues yet" })).toBeTruthy();
    expect(container.textContent).toContain("Add the places your community plays at. Any member can.");
    expect(screen.getByRole("button", { name: /Add a venue/ })).toBeTruthy();
    expect(container.querySelector(".pv-addcard form")).toBeTruthy();
  });
});

describe("Venues: Add a venue (scenarios 3, 4 and 5)", () => {
  it("just added: a green banner and a toast", () => {
    const { container } = venuesPage({ added: true });
    expect(container.querySelector(".pv-banner.green")!.textContent).toContain("Venue added.");
    expect(screen.getAllByText("Venue added.").length).toBeGreaterThanOrEqual(2);
  });
  it("the Add card posts name, address and contact, with the hint shown before anything goes wrong", async () => {
    const { container } = venuesPage();
    const card = container.querySelector(".pv-addcard") as HTMLElement;
    expect(card.textContent).toContain("2 to 60 characters. Each name can be used once.");
    fireEvent.change(card.querySelector("#pv-vc-name")!, { target: { value: "Arena One" } });
    fireEvent.change(card.querySelector("#pv-vc-addr")!, { target: { value: "Street 1" } });
    fireEvent.change(card.querySelector("#pv-vc-contact")!, { target: { value: "0300" } });
    await act(async () => { fireEvent.submit(card.querySelector("form")!); });
    expect(createVenue).toHaveBeenCalledTimes(1);
    expect(sent(createVenue)).toMatchObject({ communityId: "c1", name: "Arena One", address: "Street 1", contact: "0300" });
  });
  it("errors replace the hint with the exact message, with a ring, an icon and a summary banner", async () => {
    createVenue.mockResolvedValueOnce({ error: "Please fix the highlighted fields.", fieldErrors: { name: "A venue with this name already exists in this community.", address: "The address can be at most 120 characters." } });
    const { container } = venuesPage();
    const card = container.querySelector(".pv-addcard") as HTMLElement;
    await act(async () => { fireEvent.submit(card.querySelector("form")!); });
    expect(within(card).getByText("A venue with this name already exists in this community.")).toBeTruthy();
    expect(within(card).getByText("The address can be at most 120 characters.")).toBeTruthy();
    expect(card.textContent).not.toContain("2 to 60 characters");
    expect(card.querySelector("[data-pv-summary]")!.textContent).toContain("Please fix the highlighted fields.");
    expect(card.querySelectorAll(".pv-input.bad, .pv-if.bad")).toHaveLength(2);
    expect(card.querySelector("#pv-vc-name")!.getAttribute("aria-invalid")).toBe("true");
  });
  it("the server refusal for a non-member is shown", async () => {
    createVenue.mockResolvedValueOnce({ error: "Only members of this community can add venues." });
    const { container } = venuesPage();
    const card = container.querySelector(".pv-addcard") as HTMLElement;
    await act(async () => { fireEvent.submit(card.querySelector("form")!); });
    expect(card.querySelector("[data-pv-summary]")!.textContent).toContain("Only members of this community can add venues.");
  });
  it("on a phone the Add form opens as a bottom sheet from the top-bar Add button event, and Escape closes it", async () => {
    venuesPage();
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => { window.dispatchEvent(new Event("pv-add-venue")); });
    const sheet = screen.getByRole("dialog", { name: "Add a venue" });
    expect(sheet.textContent).toContain("Any member can. Your name is kept with it.");
    expect(within(sheet).getByLabelText("Venue name")).toBeTruthy();
    fireEvent.keyDown(sheet, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("the empty state's own button opens the same sheet", () => {
    venuesPage({ venues: [] });
    fireEvent.click(screen.getByRole("button", { name: /Add a venue/ }));
    expect(screen.getByRole("dialog", { name: "Add a venue" })).toBeTruthy();
  });
});

describe("Venues: delete from the list asks for the venue's name", () => {
  it("the confirm button stays off until the name is typed, then submits the delete action with the ids", async () => {
    const { container } = venuesPage();
    const row = container.querySelectorAll("li.pv-vrow")[2] as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Delete Gulshan Sports Hub" }));
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByRole("heading", { name: "Delete Gulshan Sports Hub?" })).toBeTruthy();
    expect(dlg.textContent).toContain("This cannot be undone.");
    const del = within(dlg).getByRole("button", { name: "Delete venue" }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    fireEvent.change(within(dlg).getByRole("textbox"), { target: { value: "gulshan sports hub" } });
    expect(del.disabled).toBe(false);
    await act(async () => { fireEvent.click(del); });
    expect(deleteVenue).toHaveBeenCalledTimes(1);
    const fd = deleteVenue.mock.calls[0]![0];
    expect(fd.get("communityId")).toBe("c1");
    expect(fd.get("venueId")).toBe("v4");
  });
  it("Keep venue closes it without deleting", () => {
    const { container } = venuesPage();
    fireEvent.click(within(container.querySelectorAll("li.pv-vrow")[2] as HTMLElement).getByRole("button", { name: "Delete Gulshan Sports Hub" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep venue" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(deleteVenue).not.toHaveBeenCalled();
  });
});

/* ====================================================================== Venue edit / delete ====================================================================== */
const v0 = { id: "v4", name: "Gulshan Sports Hub", address: "Block 13-D, Gulshan-e-Iqbal", contact: "", booking_count: 0, created_by_name: "Zain Malik", changed_by_name: "Zain Malik" };
const v6 = { id: "v1", name: "Clifton Indoor Arena", address: "Block 4, Clifton, Karachi", contact: "0300 1234567", booking_count: 6, created_by_name: "Ali Raza", changed_by_name: "Ali Raza" };
const bks = [{ id: "b1", whenText: "Fri 28 Nov, 8:00 pm", status: "confirmed" as const, contributed: 8500, total: 12000 }, { id: "b2", whenText: "Wed 12 Nov, 8:00 pm", status: "cancelled" as const, contributed: 0, total: 12000 }];
const venuePage = (v = v0, b: typeof bks = [], inUse = false) => render(wrap(<PvVenueBody communityId="c1" venue={v} bookings={b} inUse={inUse} />));

describe("Venue page: no bookings (scenario 1)", () => {
  it("a header card names the venue, counts bookings and says who added it; the edit form is prefilled; Added by and Changed by are shown", () => {
    const { container } = venuePage();
    expect(container.querySelector(".pv-vhead")!.textContent).toContain("Gulshan Sports Hub");
    expect(container.querySelector(".pv-vhead")!.textContent).toContain("0 bookings · added by Zain Malik");
    expect((container.querySelector("#pv-ve-name") as HTMLInputElement).value).toBe("Gulshan Sports Hub");
    expect((container.querySelector("#pv-ve-addr") as HTMLInputElement).value).toBe("Block 13-D, Gulshan-e-Iqbal");
    expect(container.querySelector(".pv-by")!.textContent).toBe("Added by Zain Malik · Changed by Zain Malik");
  });
  it("saving posts the venue id and the three fields to the update action", async () => {
    const { container } = venuePage();
    fireEvent.change(container.querySelector("#pv-ve-name")!, { target: { value: "Gulshan Hub" } });
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    expect(updateVenue).toHaveBeenCalledTimes(1);
    expect(sent(updateVenue)).toMatchObject({ communityId: "c1", venueId: "v4", name: "Gulshan Hub", address: "Block 13-D, Gulshan-e-Iqbal", contact: "" });
  });
  it("the saved message is shown as a banner", async () => {
    updateVenue.mockResolvedValueOnce({ message: "Saved." });
    const { container } = venuePage();
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    expect(container.querySelector(".pv-banner.green")!.textContent).toContain("Saved.");
  });
  it("the bookings list says No bookings yet and that the venue can be deleted", () => {
    const { container } = venuePage();
    expect(container.textContent).toContain("No bookings yet. This venue can be deleted.");
    const { container: panel } = render(<PvVenuePanel communityId="c1" bookings={[]} />);
    expect(panel.textContent).toContain("No bookings yet. This venue can be deleted.");
  });
  it("delete is one specific confirm that names the venue and the outcome, and asks for the name", async () => {
    const { container } = venuePage();
    expect(container.textContent).toContain("No bookings use this venue, so it can be deleted.");
    fireEvent.click(screen.getByRole("button", { name: /Delete Gulshan Sports Hub/ }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("This venue has no bookings. Its name, address and contact are removed for everyone in the community. This cannot be undone.");
    expect(within(dlg).getByRole("button", { name: "Keep venue" })).toBeTruthy();
    const del = within(dlg).getByRole("button", { name: "Delete venue" }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    fireEvent.change(within(dlg).getByRole("textbox"), { target: { value: "Gulshan Sports Hub" } });
    await act(async () => { fireEvent.click(del); });
    const fd = deleteVenue.mock.calls[0]![0];
    expect(fd.get("venueId")).toBe("v4");
    expect(fd.get("communityId")).toBe("c1");
  });
  it("the top-bar menu opens the same confirm", async () => {
    venuePage();
    render(wrap(<PvVenueMenu name="Gulshan Sports Hub" bookingCount={0} />));
    fireEvent.click(screen.getByRole("button", { name: "More actions for Gulshan Sports Hub" }));
    await act(async () => { fireEvent.click(screen.getByRole("menuitem", { name: "Delete venue" })); });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});

describe("Venue page: with bookings (scenarios 2 and 4)", () => {
  it("delete is locked with the reason in words, and the bookings are listed with links", () => {
    const { container } = venuePage(v6, bks);
    expect(container.textContent).toContain("It has 6 bookings, so it stays. Delete or cancel those bookings first.");
    const btn = screen.getByRole("button", { name: /Delete venue \(not available\)/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(container.querySelector(".pv-bk-inline")!.textContent).toContain("Fri 28 Nov, 8:00 pm");
    expect(within(container.querySelector(".pv-bk-inline") as HTMLElement).getAllByRole("link")[0]!.getAttribute("href")).toBe("/c/c1/payments/b1");
    const { container: panel } = render(<PvVenuePanel communityId="c1" bookings={bks} />);
    expect(panel.textContent).toContain("CONFIRMED");
    expect(panel.textContent).toContain("CANCELLED");
  });
  it("the menu's Delete venue is disabled with the reason", () => {
    render(wrap(<PvVenueMenu name="Clifton Indoor Arena" bookingCount={6} />));
    fireEvent.click(screen.getByRole("button", { name: "More actions for Clifton Indoor Arena" }));
    const item = screen.getByRole("menuitem", { name: /Delete venue/ });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.textContent).toContain("It has 6 bookings, so it stays");
  });
  it("the race banner says why and what to do next", () => {
    const { container } = venuePage(v6, bks, true);
    const banner = container.querySelector("[data-pv-summary]")!;
    expect(banner.getAttribute("role")).toBe("alert");
    expect(banner.textContent).toContain("This venue has bookings, so it cannot be deleted.");
    expect(banner.textContent).toContain("Cancel or delete those bookings first.");
  });
});

describe("Venue page: edit errors (scenario 5)", () => {
  it("duplicate name and a too-long address: same messages, rings and icons, banner on top", async () => {
    updateVenue.mockResolvedValueOnce({ error: "Please fix the highlighted fields.", fieldErrors: { name: "A venue with this name already exists in this community.", address: "The address can be at most 120 characters." } });
    const { container } = venuePage();
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    expect(container.querySelector("[data-pv-summary]")!.textContent).toContain("Please fix the highlighted fields.");
    expect(screen.getByText("A venue with this name already exists in this community.")).toBeTruthy();
    expect(screen.getByText("The address can be at most 120 characters.")).toBeTruthy();
    expect(container.querySelectorAll(".pv-input.bad, .pv-if.bad")).toHaveLength(2);
  });
  it("the server's other refusals are shown", async () => {
    updateVenue.mockResolvedValueOnce({ error: "That venue no longer exists." });
    const { container } = venuePage();
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    expect(container.querySelector("[data-pv-summary]")!.textContent).toContain("That venue no longer exists.");
  });
});
