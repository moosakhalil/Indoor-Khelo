// @vitest-environment jsdom
// Phase F4 (UI redesign, payments): the booking screen pieces, who shares the cost, link matches, edit a payment record and my payments.
// No database: the pieces are rendered with dummy data and the server actions are mocked.
import "fake-indexeddb/auto";
import { randomUUID, webcrypto } from "node:crypto";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

configure({ asyncUtilTimeout: 5000 });
const A = vi.hoisted(() => ({
  deletePayment: vi.fn(), verifyPayment: vi.fn(), remind: vi.fn(), status: vi.fn(), deleteBooking: vi.fn(), updatePayment: vi.fn(), sharing: vi.fn(), link: vi.fn(), refresh: vi.fn(),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: A.refresh, push: vi.fn() }), usePathname: () => "/c/x/payments" }));
vi.mock("@/app/actions7", () => ({
  createVenueAction: vi.fn(), updateVenueAction: vi.fn(), createBookingAction: vi.fn(), updateBookingAction: vi.fn(),
  updatePaymentAction: A.updatePayment, deletePaymentAction: A.deletePayment, verifyPaymentAction: A.verifyPayment, remindPaymentsAction: A.remind,
  bookingStatusAction: A.status, deleteBookingAction: A.deleteBooking, sharingAction: A.sharing, linkMatchesAction: A.link,
}));

import { BookingBadge, MoneyHero, Notice, RecordSummary, StatusBadge } from "@/components/BookingBits";
import { DeleteBooking, PaymentRecordRow, RecordSheet, RecordTrigger, RemindControl, StatusControl, type FormProps } from "@/components/BookingActions";
import { EditPaymentForm, PaymentForm, QueuedPayments } from "@/components/Forms7";
import LinkMatchesForm from "@/components/LinkMatchesForm";
import MyPaymentsView from "@/components/MyPaymentsView";
import ShareForm from "@/components/ShareForm";
import { SnackbarProvider } from "@/components/Snackbar";
import { flushPayments, queuePayment } from "@/lib/outbox";
import { moneyView } from "@/lib/bookings";
import { summarize, type Contribution } from "@/lib/payments";
import { checkGuestName, heroNumbers, needsCover, payerKey, personLine, refundHolders, remindPlan, reminderWait, splitPreview, splitTeams } from "@/lib/pbBooking";

const COMMUNITY = randomUUID();
const BOOKING = randomUUID();
const ALI = randomUUID();
const ZAIN = randomUUID();

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  Object.values(A).forEach((f) => f.mockReset());
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase("indoor-khelo"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.style.overflow = ""; });

const wrap = (ui: React.ReactElement) => render(<SnackbarProvider>{ui}</SnackbarProvider>);
const list = (...c: [string, "payment" | "refund", number, boolean][]): Contribution[] => c.map(([payerKey, kind, amount, verified]) => ({ payerKey, kind, amount, verified }));

/* ---------------- the numbers (pure) ---------------- */
describe("the money card numbers", () => {
  it("partly paid: checked, waiting for check and still open add up to the cost; the bar is scaled to the cost", () => {
    const s = summarize(12000, list(["a", "payment", 7000, true], ["b", "payment", 1500, false]));
    const h = heroNumbers(s, false);
    expect(h).toMatchObject({ tone: "partial", big: 8500, checked: 7000, waiting: 1500, open: 3500, over: 0, percent: 71 });
    expect(Math.round(h.bar.checked + h.bar.waiting + h.bar.open)).toBe(100);
  });
  it("nothing paid yet: an empty ring that still shows the full cost", () => {
    const h = heroNumbers(summarize(7500, []), false);
    expect(h).toMatchObject({ tone: "empty", big: 0, open: 7500, ofLine: "of PKR 7,500 total cost" });
  });
  it("fully paid is a full ring with nothing open", () => {
    const h = heroNumbers(summarize(12000, list(["a", "payment", 12000, true])), false);
    expect(h).toMatchObject({ tone: "full", open: 0, percent: 100 });
  });
  it("overpaid is its own state: over by PKR 500", () => {
    const h = heroNumbers(summarize(9000, list(["a", "payment", 9500, true])), false);
    expect(h).toMatchObject({ tone: "over", over: 500, open: 0 });
  });
  it("cancelled: the money still held, never 'still open'", () => {
    const s = summarize(8000, list(["a", "payment", 8500, true], ["a", "refund", 2000, true]));
    const h = heroNumbers(s, true);
    expect(h).toMatchObject({ tone: "held", big: 6500, bigLabel: "Held after cancelling", open: 0, refunded: 2000 });
  });
});

describe("people lines, reminders, refunds, split", () => {
  it("person line: to suggested, over, or just paid", () => {
    expect(personLine({ net: 500, share: 1000 })).toBe("Paid PKR 500 · PKR 500 to suggested");
    expect(personLine({ net: 0, share: 1000 })).toBe("Paid PKR 0 · PKR 1,000 to suggested");
    expect(personLine({ net: 2000, share: 1000 })).toBe("Paid PKR 2,000 · PKR 1,000 over");
    expect(personLine({ net: 1000, share: 1000 })).toBe("Paid PKR 1,000");
  });
  it("the reminder wait is the server's rule: 60 minutes, rounded up", () => {
    const now = Date.parse("2026-11-24T12:00:00Z");
    expect(reminderWait(null, now)).toBe(0);
    expect(reminderWait(new Date(now - 22 * 60000), now)).toBe(38);
    expect(reminderWait(new Date(now - 60 * 60000), now)).toBe(0);
    expect(reminderWait(new Date(now - 1000), now)).toBe(60);
  });
  it("who a reminder reaches: members whose share is not covered, not the person pressing, guests explained", () => {
    const people = [
      { user_id: "u1", name: "Zain", guest: false, net: 500, share: 1000 }, { user_id: "u2", name: "Me", guest: false, net: 0, share: 1000 },
      { user_id: "u3", name: "Ali", guest: false, net: 2000, share: 1000 }, { user_id: null, name: "Kashif", guest: true, net: 0, share: 1000 },
    ];
    const p = remindPlan(people, "u2", 1000);
    expect(p.due.map((d) => d.name)).toEqual(["Zain"]);
    expect(p.guests).toEqual(["Kashif"]);
    expect(p.selfDue).toBe(true);
  });
  it("refund holders: payments minus refunds above zero, members by their name, guests by typed name", () => {
    const h = refundHolders([
      { payer_user_id: ALI, payer_name: "Ali R", kind: "payment", amount: 2000 }, { payer_user_id: ALI, payer_name: "Ali R", kind: "refund", amount: 2000 },
      { payer_user_id: ZAIN, payer_name: "Zain", kind: "payment", amount: 500 }, { payer_user_id: null, payer_name: "Sami", kind: "payment", amount: 1000 }, { payer_user_id: null, payer_name: "sami", kind: "refund", amount: 400 },
    ], (id) => (id === ZAIN ? "Zain Malik" : undefined));
    expect(h).toEqual([{ value: "g:Sami", name: "Sami", held: 600, userId: null }, { value: `u:${ZAIN}`, name: "Zain Malik", held: 500, userId: ZAIN }]);
  });
  it("split: rounded up and the extra shown (6,000 / 7 = 858, extra 6)", () => {
    expect(splitPreview(6000, 7)).toEqual({ count: 7, share: 858, total: 6000, extra: 6 });
    expect(splitPreview(12000, 12)).toMatchObject({ share: 1000, extra: 0 });
    expect(splitPreview(12000, 0)).toMatchObject({ share: 0, extra: 0 });
  });
  it("guest names: 1 to 60 characters, no duplicates (any case), spaces tidied", () => {
    expect(checkGuestName("  Sami  ", [])).toEqual({ ok: true, name: "Sami" });
    expect(checkGuestName("   ", []).ok).toBe(false);
    expect(checkGuestName("x".repeat(61), [])).toEqual({ ok: false, error: "A guest name must be 1 to 60 characters." });
    expect(checkGuestName("sami", ["Sami"]).ok).toBe(false);
  });
  it("team names split from a match name; the payer key matches moneyView's", () => {
    expect(splitTeams("Desert Falcons v Blue Hawks")).toEqual(["Desert Falcons", "Blue Hawks"]);
    expect(splitTeams("Solo")).toBeNull();
    expect(payerKey("g:Sami Khan")).toBe("g:sami khan");
    expect(payerKey(`u:${ALI}`)).toBe(`u:${ALI}`);
  });
  it("to cover means: I share it, it is not cancelled and my share is not reached", () => {
    expect(needsCover({ owner: "member", status: "confirmed", share: 750, paid: 0 })).toBe(true);
    expect(needsCover({ owner: "member", status: "cancelled", share: 750, paid: 0 })).toBe(false);
    expect(needsCover({ owner: "member", status: "confirmed", share: 750, paid: 2000 })).toBe(false);
    expect(needsCover({ owner: "payer", status: "confirmed", share: 0, paid: 1500 })).toBe(false);
  });
  it("moneyView still gives the share and each person's status the screen relies on", () => {
    const v = moneyView({ total_cost: 6000 }, [{ id: "1", user_id: "u1", name: "A", guest: false, player_number: 1 }, { id: "2", user_id: null, name: "Sami", guest: true, player_number: null }],
      [{ payer_user_id: "u1", payer_name: "A", kind: "payment", amount: 3000, verified_at: new Date() } as never]);
    expect(v.share).toBe(3000);
    expect(v.people.map((p) => p.status)).toEqual(["paid", "unpaid"]);
  });
});

/* ---------------- the money card, badges and notices ---------------- */
describe("money card markup", () => {
  const s = summarize(12000, list(["a", "payment", 7000, true], ["b", "payment", 1500, false]));
  it("shows the ring percent, big numbers, the legend and the hint with the round-up rule", () => {
    const html = renderToStaticMarkup(<MoneyHero s={s} status="confirmed" share={858} people={7} surplusAmount={6} actions={<b>ACTIONS</b>} />);
    expect(html).toContain("PKR 8,500");
    expect(html).toContain("of PKR 12,000 total cost");
    expect(html).toContain("Checked");
    expect(html).toContain("Waiting for check");
    expect(html).toContain("Still open");
    expect(html).toContain("Suggested share: PKR 858 each");
    expect(html).toContain("Rounded up, so PKR 6 extra is collected.");
    expect(html).toContain("Only a suggestion");
    expect(html).toContain("ACTIONS");
    expect(html).toContain('aria-label="71 percent contributed"');
  });
  it("cancelled wording: held, not still open; the rule in plain words", () => {
    const c = summarize(8000, list(["a", "payment", 8500, true], ["a", "refund", 2000, true]));
    const html = renderToStaticMarkup(<MoneyHero s={c} status="cancelled" share={1000} people={8} surplusAmount={0} />);
    expect(html).toContain("Held after cancelling");
    expect(html).toContain("PKR 6,500");
    expect(html).not.toContain("Still open");
    expect(html).toContain("Refunded by hand");
  });
  it("overpaid says over by PKR 500; nobody chosen says what to do", () => {
    const o = renderToStaticMarkup(<MoneyHero s={summarize(9000, list(["a", "payment", 9500, true]))} status="completed" share={1000} people={9} surplusAmount={0} />);
    expect(o).toContain("Over by");
    expect(o).toContain("PKR 500");
    expect(o).toContain("COMPLETED");
    expect(renderToStaticMarkup(<MoneyHero s={summarize(7500, [])} status="pending" share={0} people={0} surplusAmount={0} />)).toContain("Choose who shares the cost to see a suggested share");
  });
  it("statuses are an icon and a word", () => {
    for (const [st, word] of [["paid", "PAID"], ["pending", "PENDING CHECK"], ["partial", "PARTLY PAID"], ["unpaid", "UNPAID"]] as const) {
      const html = renderToStaticMarkup(<StatusBadge status={st} />);
      expect(html).toContain(word);
      expect(html).toContain("<svg");
    }
    expect(renderToStaticMarkup(<BookingBadge status="cancelled" />)).toContain("CANCELLED");
  });
  it("notices: refusals are alerts, friendly ones are status", () => {
    expect(renderToStaticMarkup(<Notice tone="red">Nope</Notice>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Notice tone="green">Saved.</Notice>)).toContain('role="status"');
  });
  it("record summary: signed amount, checked state and who recorded it", () => {
    const html = renderToStaticMarkup(<RecordSummary name="Saad Hussain" number={99} guest={false} kind="payment" amount={1000} methodLabel="Bank transfer" paidOn="2026-11-21" checkedBy="Ali Raza" recordedBy="Saad Hussain" changedBy={null} />);
    expect(html).toContain("+PKR 1,000");
    expect(html).toContain("Checked by Ali Raza");
    expect(html).toContain("Bank transfer");
  });
});

/* ---------------- recording a payment: the new parts ---------------- */
const people = [{ value: `u:${ALI}`, label: "Ali Raza", number: 7 }, { value: `u:${ZAIN}`, label: "Zain Malik", number: 3 }, { value: "g:Sami", label: "Sami (guest)", number: null }];
const suggest = { [`u:${ALI}`]: { still: 0, paidIn: 2000 }, [`u:${ZAIN}`]: { still: 500, paidIn: 500 }, "g:Sami": { still: 1000, paidIn: 0 } };

describe("the record form", () => {
  it("choosing a person fills in their remaining share; the amount can still be changed", () => {
    render(<PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={1000} suggest={suggest} remaining={3500} />);
    fireEvent.change(screen.getByLabelText("Who paid?"), { target: { value: `u:${ZAIN}` } });
    expect((screen.getByLabelText(/Amount/) as HTMLInputElement).value).toBe("500");
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "700" } });
    fireEvent.change(screen.getByLabelText("Who paid?"), { target: { value: "g:Sami" } });
    expect((screen.getByLabelText(/Amount/) as HTMLInputElement).value).toBe("700");   // typed amounts are never overwritten
  });
  it("quick chips: suggested share, still to suggested, rest of the booking", () => {
    render(<PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={1000} suggest={suggest} remaining={3500} />);
    fireEvent.change(screen.getByLabelText("Who paid?"), { target: { value: `u:${ZAIN}` } });
    fireEvent.click(screen.getByRole("button", { name: /Rest of the booking/ }));
    expect((screen.getByLabelText(/Amount/) as HTMLInputElement).value).toBe("3500");
    fireEvent.click(screen.getByRole("button", { name: /Suggested share/ }));
    expect((screen.getByLabelText(/Amount/) as HTMLInputElement).value).toBe("1000");
    fireEvent.click(screen.getByRole("button", { name: /Still to suggested/ }));
    expect((screen.getByLabelText(/Amount/) as HTMLInputElement).value).toBe("500");
  });
  it("method chips replace the dropdown; the reference label follows the method", () => {
    render(<PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={600} />);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("radio", { name: "Cash" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("Note (optional)")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Bank transfer" }));
    expect(screen.getByLabelText("Transaction ID (optional)")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Bank transfer" }).getAttribute("aria-checked")).toBe("true");
  });
  it("refund is a mode of the same form: Refunded to, quick 'All they paid in', Record refund", () => {
    render(<PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={1000} suggest={suggest} initial={{ kind: "refund", payer: `u:${ALI}`, amount: "2000" }} />);
    expect(screen.getByLabelText("Refunded to")).toBeTruthy();
    expect((screen.getByLabelText(/Amount/) as HTMLInputElement).value).toBe("2000");
    expect(screen.getByRole("button", { name: "Record refund" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /All they paid in/ })).toBeTruthy();
  });
  it("empty form: every exact message, nothing is sent", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={600} />);
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    expect(screen.getByText("Choose who paid.")).toBeTruthy();
    expect(screen.getByText(/Amount must be a whole number of rupees from 1 to 10,000,000/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2999-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    expect(screen.getByText("The date cannot be in the future.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Who paid?"), { target: { value: "__other" } });
    fireEvent.change(screen.getByLabelText("Name of the person"), { target: { value: "x".repeat(61) } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("recorded online: the note names the payment and the host is told (for the Undo snackbar)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, redirected: false, headers: { get: () => "application/json" }, json: async () => ({ ok: true }) })));
    const onRecorded = vi.fn();
    render(<PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={600} onRecorded={onRecorded} />);
    fireEvent.change(screen.getByLabelText("Who paid?"), { target: { value: `u:${ALI}` } });
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    await screen.findByText("Recorded.");
    expect(screen.getByText(/PKR 600 from Ali Raza/)).toBeTruthy();
    expect(onRecorded).toHaveBeenCalledWith({ id: expect.any(String), text: "Payment recorded: PKR 600 from Ali Raza." });
    expect((screen.getByLabelText(/Amount/) as HTMLInputElement).value).toBe("");   // form cleared
  });
  it("a refusal from the server is a red alert above the button and nothing stays queued", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 422, redirected: false, headers: { get: () => "application/json" }, json: async () => ({ ok: false, message: "A refund cannot be more than that person has paid in." }) })));
    render(<PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={600} initial={{ kind: "refund", payer: `u:${ALI}`, amount: "900" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Record refund" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("A refund cannot be more than that person has paid in.");
  });
  it("no signal and the phone could not save it either: red, keep the screen open", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    const orig = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new Error("blocked"); });
    render(<PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={600} />);
    fireEvent.change(screen.getByLabelText("Who paid?"), { target: { value: `u:${ALI}` } });
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    await screen.findByText(/this phone could not save it. Keep this screen open/);
    vi.restoreAllMocks();
    void orig;
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });
});

describe("the sheet", () => {
  const form: FormProps = { communityId: COMMUNITY, bookingId: BOOKING, people, share: 1000, suggest, remaining: 3500 };
  it("a trigger opens the sheet set to that person; Escape closes it", async () => {
    wrap(<><RecordTrigger detail={{ payer: `u:${ZAIN}`, amount: 500 }}>Plus</RecordTrigger><RecordSheet mode="sheet" form={form} /></>);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("Plus"));
    const dlg = await screen.findByRole("dialog");
    expect((within(dlg).getByLabelText("Who paid?") as HTMLSelectElement).value).toBe(`u:${ZAIN}`);
    expect((within(dlg).getByLabelText(/Amount/) as HTMLInputElement).value).toBe("500");
    fireEvent.keyDown(dlg, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("a refund trigger opens the same form already on Refund", async () => {
    wrap(<><RecordTrigger detail={{ kind: "refund", payer: `u:${ALI}`, amount: 2000 }}>Refund</RecordTrigger><RecordSheet mode="sheet" form={form} /></>);
    fireEvent.click(screen.getByText("Refund"));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByLabelText("Refunded to")).toBeTruthy();
    expect(within(dlg).getByRole("button", { name: "Record refund" })).toBeTruthy();
  });
  it("saved online: the sheet closes and a snackbar offers Undo; Undo removes the record just made", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, redirected: false, headers: { get: () => "application/json" }, json: async () => ({ ok: true }) })));
    wrap(<><RecordTrigger detail={{ payer: `u:${ZAIN}`, amount: 500 }}>Plus</RecordTrigger><RecordSheet mode="sheet" form={form} /></>);
    fireEvent.click(screen.getByText("Plus"));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Record payment" }));
    await screen.findByText("Payment recorded: PKR 500 from Zain Malik.");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(A.deletePayment).toHaveBeenCalledTimes(1);
    const fd = A.deletePayment.mock.calls[0]![0] as FormData;
    expect(fd.get("communityId")).toBe(COMMUNITY);
    expect(fd.get("bookingId")).toBe(BOOKING);
    expect(String(fd.get("paymentId"))).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("the panel on a wide screen is always there, with the same form", () => {
    wrap(<RecordSheet mode="panel" form={form} />);
    expect(screen.getByText("Record a payment or refund")).toBeTruthy();
    expect(screen.getByLabelText("Who paid?")).toBeTruthy();
  });
});

/* ---------------- offline: not synced ---------------- */
describe("not synced yet", () => {
  it("a waiting record is orange with the person's name and the limit stated; a refused one is red with Discard", async () => {
    await queuePayment({ id: randomUUID(), communityId: COMMUNITY, bookingId: BOOKING, createdAt: 1, status: "waiting", reason: null, payment: { kind: "payment", amount: "700", paidOn: "2026-11-23", method: "cash", reference: "", payer: `u:${ZAIN}` } });
    await queuePayment({ id: randomUUID(), communityId: COMMUNITY, bookingId: BOOKING, createdAt: 2, status: "refused", reason: "A refund cannot be more than that person has paid in.", payment: { kind: "refund", amount: "900", paidOn: "2026-11-23", method: "cash", reference: "", payer: `u:${ALI}` } });
    render(<QueuedPayments bookingId={BOOKING} people={people} />);
    await screen.findByText(/2 on this phone/);
    expect(screen.getByText("NOT SYNCED")).toBeTruthy();
    expect(screen.getByText("Payment PKR 700 · Zain Malik")).toBeTruthy();
    expect(screen.getByText("Refund PKR 900 · Ali Raza")).toBeTruthy();
    expect(screen.getByText(/waiting to sync/)).toBeTruthy();
    expect(screen.getByText(/The server did not accept it: A refund cannot be more than that person has paid in\./)).toBeTruthy();
    expect(screen.getByText(/Do not close this booking page until it has sent/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    fireEvent.click(screen.getByRole("button", { name: "Send now" }));
    await screen.findByText("Still waiting for a signal.");
    void flushPayments;
  });
  it("nothing on the phone: nothing is shown", async () => {
    const { container } = render(<QueuedPayments bookingId={BOOKING} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.innerHTML).toBe("");
  });
});

/* ---------------- remind everyone ---------------- */
describe("remind everyone", () => {
  const base = { communityId: COMMUNITY, bookingId: BOOKING, venue: "Clifton Indoor Arena", share: 1000, balance: 3500, guests: [] as string[], selfDue: false, waitMinutes: 0, noPeople: false };
  const due = [{ name: "Zain Malik", net: 500 }, { name: "Hassan Raza", net: 0 }];
  it("says how many will be reminded, asks first, lists names and the message, then sends", () => {
    render(<RemindControl {...base} due={due} guests={["Kashif"]} selfDue />);
    fireEvent.click(screen.getByRole("button", { name: "Remind 2" }));
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("Remind 2 people?")).toBeTruthy();
    expect(dlg.textContent).toContain("Reminder: Clifton Indoor Arena still has PKR 3,500 open. Your suggested share is PKR 1,000. Paying is up to you and the group.");
    expect(dlg.textContent).toContain("At most once an hour");
    expect(dlg.textContent).toContain("Paid PKR 500 of PKR 1,000");
    expect(dlg.textContent).toContain("Kashif is a guest and has no account, so cannot be alerted.");
    expect(dlg.textContent).toContain("You are not alerted yourself.");
    expect(A.remind).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Send 2 reminders" }));
    expect(A.remind).toHaveBeenCalledTimes(1);
    const fd = A.remind.mock.calls[0]![0] as FormData;
    expect([fd.get("communityId"), fd.get("bookingId")]).toEqual([COMMUNITY, BOOKING]);
  });
  it("Not now sends nothing", () => {
    render(<RemindControl {...base} due={due} />);
    fireEvent.click(screen.getByRole("button", { name: "Remind 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(A.remind).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("the one-hour rule is visible before pressing: Again in 38 min, disabled", () => {
    render(<RemindControl {...base} due={due} waitMinutes={38} />);
    const b = screen.getByRole("button", { name: "Again in 38 min" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(screen.getByText(/once an hour/)).toBeTruthy();
  });
  it("everyone covered: All covered, disabled, with the reason; nobody chosen says so", () => {
    const { unmount } = render(<RemindControl {...base} due={[]} />);
    expect((screen.getByRole("button", { name: "All covered" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Everyone’s suggested share is covered/)).toBeTruthy();
    unmount();
    render(<RemindControl {...base} due={[]} noPeople />);
    expect(screen.getByText(/Nobody is chosen yet/)).toBeTruthy();
  });
});

/* ---------------- one payment record ---------------- */
const rec = { id: randomUUID(), payerName: "Zain Malik", payerHref: "/c/x/players/z", number: 3, guest: false, kind: "payment" as const, amount: 500, methodLabel: "Cash", paidOn: "2026-11-23", reference: "", recordedBy: "Ali Raza", changedBy: null, checkedBy: null };

describe("a payment record row", () => {
  const open = (name: RegExp) => { fireEvent.click(screen.getByRole("button", { name: /Actions for the PKR 500 record/ })); fireEvent.click(screen.getByRole("menuitem", { name })); };
  it("shows the signed amount, a labelled check state and a 44px 'Mark checked'", () => {
    wrap(<PaymentRecordRow communityId={COMMUNITY} bookingId={BOOKING} base="/c/x/payments/b" r={rec} />);
    expect(screen.getByText("+PKR 500")).toBeTruthy();
    expect(screen.getByText("Not checked yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark checked" })).toBeTruthy();
    expect(screen.getByText(/Recorded by Ali Raza/)).toBeTruthy();
  });
  it("a checked record says who checked it and offers 'Mark not checked' in the menu", () => {
    wrap(<PaymentRecordRow communityId={COMMUNITY} bookingId={BOOKING} base="/c/x/payments/b" r={{ ...rec, checkedBy: "Ali Raza" }} />);
    expect(screen.getByText("Checked by Ali Raza")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark checked" })).toBeNull();
    open(/Mark not checked/);
    expect(A.verifyPayment).toHaveBeenCalledTimes(1);
    expect((A.verifyPayment.mock.calls[0]![0] as FormData).get("on")).toBe("0");
  });
  it("a refund is red with a minus sign; the menu has Edit / Mark checked / Remove", () => {
    wrap(<PaymentRecordRow communityId={COMMUNITY} bookingId={BOOKING} base="/c/x/payments/b" r={{ ...rec, kind: "refund" }} />);
    expect(screen.getByText("−PKR 500")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Actions for the PKR 500 record/ }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Edit record", "Mark checked", "Remove record"]);
    expect(screen.getByRole("menuitem", { name: "Edit record" }).getAttribute("href")).toBe(`/c/x/payments/b/pay/${rec.id}`);
  });
  it("removing an unchecked record is instant with Undo; the real delete waits 8 seconds", () => {
    vi.useFakeTimers();
    wrap(<PaymentRecordRow communityId={COMMUNITY} bookingId={BOOKING} base="/c/x/payments/b" r={rec} />);
    open(/Remove record/);
    expect(screen.queryByText("+PKR 500")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText("Payment of PKR 500 removed.")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(7000); });
    expect(A.deletePayment).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(A.deletePayment).toHaveBeenCalledTimes(1);
    expect((A.deletePayment.mock.calls[0]![0] as FormData).get("paymentId")).toBe(rec.id);
  });
  it("Undo brings the row back and deletes nothing", () => {
    vi.useFakeTimers();
    wrap(<PaymentRecordRow communityId={COMMUNITY} bookingId={BOOKING} base="/c/x/payments/b" r={rec} />);
    open(/Remove record/);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("+PKR 500")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(20000); });
    expect(A.deletePayment).not.toHaveBeenCalled();
  });
  it("removing a checked record asks first, names the effect, and the button repeats the verb", () => {
    wrap(<PaymentRecordRow communityId={COMMUNITY} bookingId={BOOKING} base="/c/x/payments/b" r={{ ...rec, checkedBy: "Hamza Khan" }} />);
    open(/Remove record/);
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("Hamza Khan checked this PKR 500 payment.");
    expect(dlg.textContent).toContain("takes it off Zain Malik’s paid amount and changes the checked total");
    expect(A.deletePayment).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Remove this payment" }));
    expect(A.deletePayment).toHaveBeenCalledTimes(1);
  });
});

/* ---------------- status and delete ---------------- */
describe("booking status and delete", () => {
  it("one segmented control: Pending, Confirmed, Completed, Cancelled; a plain change goes straight through", () => {
    render(<StatusControl communityId={COMMUNITY} bookingId={BOOKING} status="confirmed" />);
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Pending", "Confirmed", "Completed", "Cancelled"]);
    expect(screen.getByRole("radio", { name: "Confirmed" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Completed" }));
    expect((A.status.mock.calls[0]![0] as FormData).get("status")).toBe("completed");
  });
  it("cancelling explains what happens next and only then changes it", () => {
    render(<StatusControl communityId={COMMUNITY} bookingId={BOOKING} status="confirmed" />);
    fireEvent.click(screen.getByRole("radio", { name: "Cancelled" }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("Reminders stop");
    expect(dlg.textContent).toContain("Every payment record is kept");
    expect(A.status).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Mark cancelled" }));
    expect((A.status.mock.calls[0]![0] as FormData).get("status")).toBe("cancelled");
  });
  it("the current status does nothing when tapped", () => {
    render(<StatusControl communityId={COMMUNITY} bookingId={BOOKING} status="confirmed" />);
    fireEvent.click(screen.getByRole("radio", { name: "Confirmed" }));
    expect(A.status).not.toHaveBeenCalled();
  });
  it("delete names the booking and the outcome", () => {
    render(<DeleteBooking communityId={COMMUNITY} bookingId={BOOKING} venue="Clifton Indoor Arena" when="Fri 28 Nov, 8:00 pm" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete booking" }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("Clifton Indoor Arena on Fri 28 Nov, 8:00 pm");
    expect(dlg.textContent).toContain("no payment records");
    fireEvent.click(within(dlg).getByRole("button", { name: "Delete booking" }));
    expect(A.deleteBooking).toHaveBeenCalledTimes(1);
  });
});

/* ---------------- edit a payment record ---------------- */
describe("edit a payment record", () => {
  const cur = { payer: `u:${ZAIN}`, kind: "payment" as const, amount: 500, paidOn: "2026-11-23", method: "cash", reference: "" };
  const props = { communityId: COMMUNITY, bookingId: BOOKING, paymentId: randomUUID(), people, current: cur, suggest, share: 1000, payerLabel: "Zain Malik" };
  it("a checked record warns BEFORE editing that saving clears the check", () => {
    wrap(<EditPaymentForm {...props} checkedBy="Ali Raza" />);
    expect(screen.getByText("Saving will mark this as not checked again.")).toBeTruthy();
    expect(screen.getByText(/Ali Raza checked it earlier\./)).toBeTruthy();
  });
  it("an unchecked record has no such banner", () => {
    wrap(<EditPaymentForm {...props} checkedBy={null} />);
    expect(screen.queryByText(/Saving will mark/)).toBeNull();
  });
  it("same fields as the sheet: tabs, person, big amount, method chips, date, note; the method follows into the reference label", () => {
    wrap(<EditPaymentForm {...props} checkedBy={null} />);
    expect((screen.getByLabelText("Who paid?") as HTMLSelectElement).value).toBe(`u:${ZAIN}`);
    expect((screen.getByLabelText(/Amount/) as HTMLInputElement).value).toBe("500");
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    fireEvent.click(screen.getByRole("radio", { name: "JazzCash" }));
    expect(screen.getByLabelText("Transaction ID (optional)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refund given back" }));
    expect(screen.getByLabelText("Refunded to")).toBeTruthy();
  });
  it("validation: exact messages, nothing is sent to the server", () => {
    wrap(<EditPaymentForm {...props} checkedBy={null} />);
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2999-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText(/Amount must be a whole number of rupees from 1 to 10,000,000/)).toBeTruthy();
    expect(screen.getByText("The date cannot be in the future.")).toBeTruthy();
    expect(A.updatePayment).not.toHaveBeenCalled();
  });
  it("a valid save posts the same fields as before (kind, payer, amount, date, method, reference)", async () => {
    A.updatePayment.mockResolvedValue({});
    wrap(<EditPaymentForm {...props} checkedBy={null} />);
    fireEvent.click(screen.getByRole("radio", { name: "Bank transfer" }));
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "650" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(A.updatePayment).toHaveBeenCalled());
    const fd = A.updatePayment.mock.calls[0]![1] as FormData;
    expect(Object.fromEntries(Array.from(fd.entries()).map(([k, v]) => [k, String(v)]))).toMatchObject({
      communityId: COMMUNITY, bookingId: BOOKING, paymentId: props.paymentId, kind: "payment", payer: `u:${ZAIN}`, amount: "650", method: "bank_transfer", paidOn: "2026-11-23", reference: "",
    });
  });
  it("a server refusal sits at its field (limit under the amount, person under the person)", async () => {
    A.updatePayment.mockResolvedValue({ error: "Please fix the highlighted fields.", fieldErrors: { amount: "A refund cannot be more than that person has paid in.", payer: "That person is not a member of this community." } });
    wrap(<EditPaymentForm {...props} checkedBy={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("A refund cannot be more than that person has paid in.");
    expect(screen.getByText("That person is not a member of this community.")).toBeTruthy();
    expect(screen.getByText("Please fix the highlighted fields.")).toBeTruthy();
  });
  it("saving shows 'Saving…' and disables the button", async () => {
    let release: (v: unknown) => void = () => {};
    A.updatePayment.mockImplementation(() => new Promise((r) => { release = r; }));
    wrap(<EditPaymentForm {...props} checkedBy={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const b = (await screen.findByRole("button", { name: "Saving…" })) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    release({});
  });
  it("remove an unchecked record: Undo for 8 seconds, then the real delete", () => {
    vi.useFakeTimers();
    wrap(<EditPaymentForm {...props} checkedBy={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove record" }));
    expect(screen.getByText(/This record is being removed/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();     // saving while a delete waits could not be allowed
    act(() => { vi.advanceTimersByTime(7000); });
    expect(A.deletePayment).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(A.deletePayment).toHaveBeenCalledTimes(1);
  });
  it("Undo on the edit page puts the form back", () => {
    wrap(<EditPaymentForm {...props} checkedBy={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove record" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(A.deletePayment).not.toHaveBeenCalled();
  });
  it("remove a checked record: a specific confirm first", () => {
    wrap(<EditPaymentForm {...props} checkedBy="Ali Raza" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove record" }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("Ali Raza checked this payment.");
    expect(A.deletePayment).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Remove this payment" }));
    expect(A.deletePayment).toHaveBeenCalledTimes(1);
  });
});

/* ---------------- who shares the cost ---------------- */
const members = Array.from({ length: 6 }, (_, i) => ({ user_id: `m${i}`, name: ["Ali Raza", "Hamza Khan", "Bilal Ahmed", "Usman Tariq", "Zain Malik", "Faizan Ali"][i]!, number: i + 1 }));
const hidden = (c: HTMLElement, name: string) => Array.from(c.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)).map((i) => i.value);

describe("who shares the cost", () => {
  const base = { communityId: COMMUNITY, bookingId: BOOKING, total: 12000, members, selected: ["m0", "m1"], guests: ["Kashif"], last: null, error: null };
  it("the live summary uses the real number chosen and the rounding rule", () => {
    render(<ShareForm {...base} total={6000} selected={["m0", "m1", "m2", "m3", "m4", "m5"]} guests={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(screen.getAllByText("Choose at least one person to see a suggested share.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Select all/ }));
    expect(screen.getAllByText("6 people · PKR 1,000 each").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
    ["Ali Raza", "Hamza Khan", "Bilal Ahmed", "Usman Tariq", "Zain Malik"].forEach((n) => fireEvent.click(screen.getByLabelText(new RegExp(n))));
    fireEvent.change(screen.getByLabelText("Guest name"), { target: { value: "Sami" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByLabelText("Guest name"), { target: { value: "Hamza G" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getAllByText("7 people · PKR 858 each").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rounded up, so PKR 6 extra is collected/).length).toBeGreaterThan(0);
  });
  it("what is posted is what the old form posted: member ids and guests one per line", () => {
    const { container } = render(<ShareForm {...base} />);
    expect(hidden(container, "member")).toEqual(["m0", "m1"]);
    expect(hidden(container, "guests")).toEqual(["Kashif"]);
    fireEvent.click(screen.getByLabelText(/Bilal Ahmed/));
    fireEvent.change(screen.getByLabelText("Guest name"), { target: { value: "Sami" } });
    fireEvent.keyDown(screen.getByLabelText("Guest name"), { key: "Enter" });
    expect(hidden(container, "member")).toEqual(["m0", "m1", "m2"]);
    expect(hidden(container, "guests")).toEqual(["Kashif\nSami"]);
  });
  it("search narrows the list; select all applies to what is shown", () => {
    render(<ShareForm {...base} selected={[]} guests={[]} />);
    fireEvent.change(screen.getByLabelText("Search members"), { target: { value: "ali" } });
    expect(screen.getByLabelText(/Ali Raza/)).toBeTruthy();
    expect(screen.getByLabelText(/Faizan Ali/)).toBeTruthy();
    expect(screen.queryByLabelText(/Hamza Khan/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Select all \(3\)/ }));
    expect(screen.getByText(/\(3 of 6 chosen\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search members"), { target: { value: "nobody here" } });
    expect(screen.getByText(/Nobody matches/)).toBeTruthy();
  });
  it("Same as last booking copies the last booking's people (only those still members)", () => {
    render(<ShareForm {...base} selected={[]} guests={[]} last={{ label: "Fri 21 Nov", members: ["m2", "m3", "gone"], guests: ["Sami"] }} />);
    fireEvent.click(screen.getByRole("button", { name: /Same as last booking/ }));
    expect(screen.getByText(/\(2 of 6 chosen\)/)).toBeTruthy();
    expect(screen.getByText("Sami")).toBeTruthy();
    expect(screen.getAllByText("3 people · PKR 4,000 each").length).toBeGreaterThan(0);
  });
  it("guests are named chips; the 1 to 60 rule is checked as you add; duplicates and commas refused; a chip can be removed", () => {
    render(<ShareForm {...base} guests={[]} selected={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("A guest name must be 1 to 60 characters.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Guest name"), { target: { value: "x".repeat(61) } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("A guest name must be 1 to 60 characters.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Guest name"), { target: { value: "Sami" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByLabelText("Guest name"), { target: { value: "sami" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("sami is already in the list.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Guest name"), { target: { value: "A, B" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText(/cannot contain a comma/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove guest Sami" }));
    expect(screen.queryByText("Sami")).toBeNull();
  });
  it("?e=guest puts the exact message at the guest field; ?e=bad_person says how to fix it", () => {
    const { unmount } = render(<ShareForm {...base} error="guest" />);
    expect(screen.getByText("A guest name must be 1 to 60 characters.")).toBeTruthy();
    unmount();
    render(<ShareForm {...base} error="bad_person" />);
    expect(screen.getByText("Someone in the list is not a member of this community any more. Untick them, then save again.")).toBeTruthy();
  });
  it("someone who left is not kept: saving leaves them out", () => {
    const { container } = render(<ShareForm {...base} selected={["m0", "left-the-community"]} />);
    expect(hidden(container, "member")).toEqual(["m0"]);
  });
  it("members show the shirt with their number", () => {
    const { container } = render(<ShareForm {...base} />);
    expect(container.querySelectorAll(".shirt").length).toBeGreaterThanOrEqual(6);
  });
});

/* ---------------- link matches ---------------- */
const matches = [
  { id: "a", name: "Desert Falcons v Blue Hawks", status: "scheduled", statusLabel: "Scheduled", when: "Fri 28 Nov, 8:00 pm" },
  { id: "b", name: "Thunder Strikers v Royal Panthers", status: "scheduled", statusLabel: "Scheduled", when: "Fri 28 Nov, 9:00 pm" },
  { id: "c", name: "Royal Panthers v Blue Hawks", status: "completed", statusLabel: "Completed", when: "Sat 22 Nov" },
  { id: "d", name: "Blue Hawks v Thunder Strikers", status: "live", statusLabel: "Live", when: "Sat 8 Nov" },
];
describe("link matches", () => {
  const props = { communityId: COMMUNITY, bookingId: BOOKING, createHref: "/c/x/matches/new" };
  it("team badges, status badges, tabs with counts, and a running count with the reassurance", () => {
    const { container } = render(<LinkMatchesForm {...props} matches={matches} linked={["a", "b"]} />);
    expect(container.querySelectorAll(".team-badge").length).toBe(8);
    expect(screen.getByRole("tab", { name: /All 4/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Scheduled 2/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Completed 1/ })).toBeTruthy();
    expect(screen.getByText("2 matches linked")).toBeTruthy();
    expect(screen.getByText(/Linking never changes a score or statistic\./)).toBeTruthy();
    expect(screen.getAllByText("SCHEDULED").length).toBe(2);
    expect(screen.getByText("COMPLETED")).toBeTruthy();
    expect(hidden(container, "match")).toEqual(["a", "b"]);
  });
  it("the filter hides rows but keeps what is ticked", () => {
    const { container } = render(<LinkMatchesForm {...props} matches={matches} linked={["a"]} />);
    fireEvent.click(screen.getByRole("tab", { name: /Completed/ }));
    expect(screen.queryByText("Desert Falcons v Blue Hawks")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Royal Panthers v Blue Hawks/ }));
    expect(screen.getByText("2 matches linked")).toBeTruthy();
    expect(hidden(container, "match").sort()).toEqual(["a", "c"]);
  });
  it("nothing linked yet: the bar says 0 and that saving clears the links", () => {
    render(<LinkMatchesForm {...props} matches={matches} linked={[]} />);
    expect(screen.getByText("0 matches linked")).toBeTruthy();
    expect(screen.getByText(/Saving with nothing ticked clears the links/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Desert Falcons v Blue Hawks/ }));
    expect(screen.getByText("1 match linked")).toBeTruthy();
  });
  it("no matches at all: an empty state with a Create a match button", () => {
    render(<LinkMatchesForm {...props} matches={[]} linked={[]} />);
    expect(screen.getByText("No matches yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Create a match/ }).getAttribute("href")).toBe("/c/x/matches/new");
  });
});

/* ---------------- my payments ---------------- */
const mine = [
  { bookingId: "1", venue: "Clifton Indoor Arena", when: "Fri 28 Nov", status: "confirmed" as const, owner: "member" as const, share: 1000, paid: 2000, checked: 2000 },
  { bookingId: "2", venue: "Seaview Sports Complex", when: "Sat 29 Nov", status: "confirmed" as const, owner: "member" as const, share: 750, paid: 0, checked: 0 },
  { bookingId: "3", venue: "DHA Cricket Dome", when: "Sun 30 Nov", status: "confirmed" as const, owner: "member" as const, share: 858, paid: 858, checked: 0 },
  { bookingId: "4", venue: "Clifton Indoor Arena", when: "Sat 22 Nov", status: "completed" as const, owner: "member" as const, share: 1200, paid: 800, checked: 800 },
  { bookingId: "5", venue: "Seaview Sports Complex", when: "Sat 6 Nov", status: "completed" as const, owner: "payer" as const, share: 0, paid: 1500, checked: 1500 },
  { bookingId: "6", venue: "Clifton Indoor Arena", when: "Wed 12 Nov", status: "cancelled" as const, owner: "member" as const, share: 1000, paid: 2000, checked: 2000 },
];
describe("my payments", () => {
  it("badges with icon and word for every state, including paid for others, completed and cancelled", () => {
    render(<MyPaymentsView communityId={COMMUNITY} rows={mine} />);
    for (const w of ["PAID", "UNPAID", "PENDING CHECK", "PARTLY PAID", "PAID FOR OTHERS", "COMPLETED", "CANCELLED"]) expect(screen.getAllByText(w).length).toBeGreaterThan(0);
  });
  it("tabs: All / To cover / Paid with counts (a cancelled booking never needs covering)", () => {
    render(<MyPaymentsView communityId={COMMUNITY} rows={mine} />);
    expect(screen.getByRole("tab", { name: /All 6/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /To cover 2/ })).toBeTruthy();
  });
  it("the To cover tab lists only what still needs a payment, each with a link that opens the record form", () => {
    render(<MyPaymentsView communityId={COMMUNITY} rows={mine} />);
    fireEvent.click(screen.getByRole("tab", { name: /To cover/ }));
    expect(screen.getByText("Seaview Sports Complex")).toBeTruthy();
    expect(screen.queryByText("DHA Cricket Dome")).toBeNull();
    expect(screen.getAllByRole("link", { name: /Record my payment/ })[0]!.getAttribute("href")).toBe(`/c/${COMMUNITY}/payments/2?record=me`);
  });
  it("nothing to cover says so", () => {
    render(<MyPaymentsView communityId={COMMUNITY} rows={mine.slice(0, 1)} />);
    fireEvent.click(screen.getByRole("tab", { name: /To cover/ }));
    expect(screen.getByText("Nothing left to cover.")).toBeTruthy();
  });
});
