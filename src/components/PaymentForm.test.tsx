// @vitest-environment jsdom
// Recording a payment on a phone: online it is saved at once; with no signal it is kept on the phone, marked "not synced",
// and sent later. The same record sent twice is saved once.
import "fake-indexeddb/auto";
import { randomUUID, webcrypto } from "node:crypto";
import { cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

configure({ asyncUtilTimeout: 5000 });
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/app/actions7", () => ({ createVenueAction: vi.fn(), updateVenueAction: vi.fn(), createBookingAction: vi.fn(), updateBookingAction: vi.fn(), updatePaymentAction: vi.fn() }));

import { PaymentForm, QueuedPayments } from "@/components/Forms7";
import { flushPayments, readQueuedPayments } from "@/lib/outbox";

const COMMUNITY = randomUUID();
const BOOKING = randomUUID();
const ALI = randomUUID();
const people = [{ value: `u:${ALI}`, label: "Ali Raza" }, { value: "g:Sami", label: "Sami (guest)" }];

let online = true;
let saved: Record<string, unknown>[] = [];
let calls = 0;
function installFetch() {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
    calls++;
    if (!online) throw new TypeError("Failed to fetch");
    const body = JSON.parse(init.body) as { payment: { id: string } & Record<string, unknown> };
    const dup = saved.some((p) => p.id === body.payment.id);
    if (!dup) saved.push(body.payment);
    return { ok: true, status: 200, redirected: false, headers: { get: () => "application/json" }, json: async () => ({ ok: true, duplicate: dup }) };
  }));
}
function setOnline(v: boolean) {
  online = v;
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
  window.dispatchEvent(new Event(v ? "online" : "offline"));
}

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  online = true; saved = []; calls = 0; refresh.mockClear();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  installFetch();
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase("indoor-khelo"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const fill = (who: string, amount: string) => {
  fireEvent.change(screen.getByLabelText("Who paid?"), { target: { value: who } });
  fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: amount } });
};

describe("recording a payment", () => {
  it("online: validated, saved at once, form cleared, the page refreshed", async () => {
    render(<PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={600} />);
    fireEvent.click(screen.getByRole("button", { name: "Record the payment" }));
    expect(screen.getByText("Choose who paid.")).toBeTruthy();             // nothing is sent until it is valid
    expect(screen.getByText(/Amount must be a whole number/)).toBeTruthy();
    expect(calls).toBe(0);
    fill(`u:${ALI}`, "600");
    fireEvent.click(screen.getByRole("button", { name: "Record the payment" }));
    await screen.findByText("Recorded.");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ amount: "600", payer: `u:${ALI}`, method: "cash", kind: "payment" });
    expect(refresh).toHaveBeenCalled();
    expect(await readQueuedPayments(BOOKING)).toEqual([]);                    // nothing left waiting
  });

  it("someone else can be typed by name, a refund is its own kind, and bad input shows words", async () => {
    render(<PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Refund given back" }));
    fireEvent.change(screen.getByLabelText("Refunded to"), { target: { value: "__other" } });
    fireEvent.change(screen.getByLabelText("Name of the person"), { target: { value: "Zed Guest" } });
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "12.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Record the refund" }));
    expect(screen.getByText(/Amount must be a whole number/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Record the refund" }));
    await screen.findByText("Recorded.");
    expect(saved[0]).toMatchObject({ kind: "refund", payer: "g:Zed Guest", amount: "250" });
  });

  it("with no signal: kept on the phone, marked not synced, sent when the signal returns, saved once", async () => {
    setOnline(false);
    render(<><PaymentForm communityId={COMMUNITY} bookingId={BOOKING} people={people} share={600} /><QueuedPayments bookingId={BOOKING} /></>);
    fill(`u:${ALI}`, "700");
    fireEvent.click(screen.getByRole("button", { name: "Record the payment" }));
    await screen.findByText(/marked “not synced”/);
    expect(saved).toHaveLength(0);
    const queued = await readQueuedPayments(BOOKING);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ status: "waiting", payment: { amount: "700" } });
    await screen.findByText(/Not synced yet \(1\)/);                              // shown on the booking screen, clearly marked
    expect(screen.getByText(/waiting to sync/)).toBeTruthy();
    // the signal returns: everything waiting is sent
    setOnline(true);
    const r = await flushPayments();
    expect(r).toEqual({ sent: 1, left: 0 });
    expect(saved).toHaveLength(1);
    expect(await readQueuedPayments(BOOKING)).toEqual([]);
    // sending the very same record again (a lost answer) changes nothing
    const again = { ...queued[0]! };
    const { sendPayment } = await import("@/lib/outbox");
    expect((await sendPayment(again)).kind).toBe("duplicate");
    expect(saved).toHaveLength(1);
  });

  it("a record the server refuses stays on the phone, marked, and can be discarded; it is never lost silently", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 422, redirected: false, headers: { get: () => "application/json" }, json: async () => ({ ok: false, message: "A refund cannot be more than that person has paid in." }) })));
    const { queuePayment } = await import("@/lib/outbox");
    await queuePayment({ id: randomUUID(), communityId: COMMUNITY, bookingId: BOOKING, createdAt: Date.now(), status: "waiting", reason: null, payment: { kind: "refund", amount: "900", paidOn: "2026-11-24", method: "cash", reference: "", payer: `u:${ALI}` } });
    render(<QueuedPayments bookingId={BOOKING} />);
    await screen.findByText(/Not synced yet \(1\)/);
    await flushPayments();
    await screen.findByText(/Send now/);
    fireEvent.click(screen.getByRole("button", { name: "Send now" }));
    await screen.findByText(/The server did not accept it: A refund cannot be more than/);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByText(/Not synced yet/)).toBeNull());
    expect(await readQueuedPayments(BOOKING)).toEqual([]);
  });
});
