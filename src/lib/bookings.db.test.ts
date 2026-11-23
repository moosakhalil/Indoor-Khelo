// Phase 7 rules (venues, bookings, sharing, contributions, refunds, reminders, history) against the real Neon database.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import { chooseNumber, createCommunity, requestToJoin } from "@/lib/community";
import { leaveCommunity } from "@/lib/management";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { createMatch } from "@/lib/matches";
import {
  addPayment, createBooking, createVenue, deleteBooking, deletePayment, deleteVenue, getBooking, linkMatches, linkedMatches, listBookings, listHistory, listPayments, listSharing, listVenues,
  moneyView, myPayments, remindUnpaid, setBookingStatus, setSharing, updateBooking, updatePayment, updateVenue, verifyPayment,
} from "@/lib/bookings";
import type { PaymentInput } from "@/lib/payments";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
const communities: string[] = [];
async function newUser(label: string) {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}
let cached: Promise<{ admin: string; id: string; people: string[] }> | null = null;
function world() {
  cached ??= (async () => {
    const admin = await newUser("admin");
    const id = await createCommunity(admin, { name: "TEST Money Club", description: "", location: "", approvalRequired: false });
    communities.push(id);
    const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!.invite_code;
    await chooseNumber(admin, id, 1);
    const people = [admin];
    for (let i = 0; i < 4; i++) { const u = await newUser(`p${i}`); await requestToJoin(u, code); await chooseNumber(u, id, 10 + i); people.push(u); }
    return { admin, id, people };
  })();
  return cached;
}
const when = () => new Date(Date.now() + 3 * 86_400_000);
const input = (venueId: string, over = {}) => ({ venueId, startsAt: when(), durationMinutes: 60, totalCost: 6000, reference: "REF1", notes: "", ...over });
const pay = (payerUserId: string | null, amount: number, over: Partial<PaymentInput> = {}): PaymentInput => ({ kind: "payment", amount, paidOn: new Date().toISOString().slice(0, 10), method: "cash", reference: "", payerUserId, payerName: payerUserId ? "" : "Guest Sami", ...over });
async function newBooking(total = 6000) {
  const w = await world();
  const v = await createVenue(w.admin, w.id, { name: `TEST Arena ${randomUUID().slice(0, 6)}`, address: "Blue Area", contact: "0300" });
  const b = await createBooking(w.people[1]!, w.id, input(v.id!, { totalCost: total }));
  expect(b.outcome).toBe("ok");
  return { ...w, venueId: v.id!, bookingId: b.id! };
}

describe.skipIf(!run)("Phase 7: venues, bookings and money in the real database", () => {
  afterAll(async () => {
    if (communities.length) await query("delete from community where id = any($1::uuid[])", [communities]);
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("any member can add, change and delete a venue; names are unique; a venue with bookings stays", { timeout: 120_000 }, async () => {
    const w = await world();
    const stranger = await newUser("stranger");
    expect((await createVenue(stranger, w.id, { name: "Nope Hall", address: "", contact: "" })).outcome).toBe("forbidden");
    const v = await createVenue(w.people[2]!, w.id, { name: "TEST Hall A", address: "Main road", contact: "0300 1" });
    expect(v.outcome).toBe("ok");
    expect((await createVenue(w.admin, w.id, { name: "  test hall a ", address: "", contact: "" })).outcome).toBe("name_taken");
    expect(await updateVenue(w.admin, w.id, v.id!, { name: "TEST Hall A2", address: "New road", contact: "" })).toBe("ok");
    const row = (await listVenues(w.id)).find((x) => x.id === v.id)!;
    expect(row).toMatchObject({ name: "TEST Hall A2", created_by_name: "TEST p1", changed_by_name: "TEST admin", booking_count: 0 });
    expect(await updateVenue(stranger, w.id, v.id!, { name: "X Y", address: "", contact: "" })).toBe("forbidden");
    expect(await updateVenue(w.admin, w.id, randomUUID(), { name: "X Y", address: "", contact: "" })).toBe("not_found");
    const b = await createBooking(w.admin, w.id, input(v.id!));
    expect(await deleteVenue(w.admin, w.id, v.id!)).toBe("in_use");
    expect(await deleteBooking(w.admin, w.id, b.id!)).toBe("ok");
    expect(await deleteVenue(w.admin, w.id, v.id!)).toBe("ok");
  });

  it("a booking shows who added and changed it, keeps a history of what changed, and checks the venue is the community's", { timeout: 120_000 }, async () => {
    const w = await newBooking();
    const b = (await getBooking(w.id, w.bookingId))!;
    expect(b).toMatchObject({ status: "pending", total_cost: 6000, duration_minutes: 60, reference: "REF1", created_by_name: "TEST p0", changed_by_name: "TEST p0", contributed: 0, member_count: 0 });
    expect((await createBooking(w.admin, w.id, input(randomUUID()))).outcome).toBe("bad_venue");
    expect((await createBooking(await newUser("stranger"), w.id, input(w.venueId))).outcome).toBe("forbidden");
    expect(await updateBooking(w.people[3]!, w.id, w.bookingId, input(w.venueId, { totalCost: 7000, reference: "REF2", durationMinutes: 90 }))).toBe("ok");
    const after = (await getBooking(w.id, w.bookingId))!;
    expect(after).toMatchObject({ total_cost: 7000, reference: "REF2", duration_minutes: 90, changed_by_name: "TEST p2" });
    const h = await listHistory(w.bookingId);
    expect(h[0]).toMatchObject({ action: "changed", actor_name: "TEST p2" });
    const fields = (h[0]!.details.changes as { field: string }[]).map((x) => x.field).sort();
    expect(fields).toEqual(expect.arrayContaining(["duration_minutes", "reference", "total_cost"]));
    expect(h.at(-1)).toMatchObject({ action: "created", actor_name: "TEST p0" });
    expect(await updateBooking(w.admin, w.id, randomUUID(), input(w.venueId))).toBe("not_found");
    expect(await updateBooking(w.admin, w.id, w.bookingId, input(randomUUID()))).toBe("bad_venue");
  });

  it("status changes are logged; a booking with money on it can be cancelled but not deleted", { timeout: 120_000 }, async () => {
    const w = await newBooking();
    expect(await setBookingStatus(w.admin, w.id, w.bookingId, "confirmed")).toBe("ok");
    expect(await setBookingStatus(w.admin, w.id, w.bookingId, "confirmed")).toBe("bad_state");
    expect(await setBookingStatus(w.admin, w.id, w.bookingId, "nonsense")).toBe("bad_state");
    expect((await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(w.people[1]!, 600))).outcome).toBe("ok");
    expect(await deleteBooking(w.admin, w.id, w.bookingId)).toBe("bad_state");
    expect(await setBookingStatus(w.people[2]!, w.id, w.bookingId, "cancelled")).toBe("ok");
    expect((await listHistory(w.bookingId)).find((x) => x.action === "status")!.details).toMatchObject({ from: "confirmed", to: "cancelled" });
    expect((await getBooking(w.id, w.bookingId))!.contributed).toBe(600);       // a cancelled booking keeps its payment records
    expect(await setBookingStatus(w.admin, w.id, w.bookingId, "pending")).toBe("ok");   // and can be brought back
  });

  it("sharing: members and guests, the suggested share rounds up, people are told, changing the cost recalculates and tells them", { timeout: 180_000 }, async () => {
    const w = await newBooking(6000);
    const [a, b, c] = [w.people[1]!, w.people[2]!, w.people[3]!];
    const stranger = await newUser("stranger");
    expect(await setSharing(w.admin, w.id, w.bookingId, [stranger], [])).toBe("bad_person");
    expect(await setSharing(w.admin, w.id, w.bookingId, [a, b, c, w.people[4]!, w.admin], ["Sami", "sami", "Hamza"])).toBe("ok");   // 5 members + 2 distinct guests
    const sharing = await listSharing(w.bookingId);
    expect(sharing).toHaveLength(7);
    expect(sharing.filter((s) => s.guest).map((s) => s.name).sort()).toEqual(["Hamza", "Sami"]);
    const view = moneyView({ total_cost: 6000 }, sharing, []);
    expect(view.share).toBe(858);                       // 6000 / 7 = 857.14, rounded up
    expect(view.people.every((p) => p.status === "unpaid")).toBe(true);
    // the people who were added are told their share (not the person who made the change)
    const alerts = await query<{ message: string; kind: string }>("select message, kind from app_alert where user_id = $1 and booking_id = $2", [a, w.bookingId]);
    expect(alerts[0]).toMatchObject({ kind: "booking_share" });
    expect(alerts[0]!.message).toContain("PKR 858");
    expect(await query("select 1 from app_alert where user_id = $1 and booking_id = $2", [w.admin, w.bookingId])).toHaveLength(0);
    // the cost changes: new share, history, alert
    expect(await updateBooking(w.admin, w.id, w.bookingId, input(w.venueId, { totalCost: 7000 }))).toBe("ok");
    expect((await listHistory(w.bookingId)).find((x) => x.action === "share_recalculated")!.details).toMatchObject({ from: 858, to: 1000, people: 7 });
    expect((await query<{ message: string }>("select message from app_alert where user_id = $1 and kind = 'booking_changed'", [a]))[0]!.message).toContain("PKR 1,000");
    // fewer people share: it changes again, removed people are simply out
    expect(await setSharing(w.admin, w.id, w.bookingId, [a, b], [])).toBe("ok");
    expect(moneyView({ total_cost: 7000 }, await listSharing(w.bookingId), []).share).toBe(3500);
  });

  it("paying is a convenience: any amount from anyone, statuses in words, one person can cover the rest, nothing is blocked", { timeout: 180_000 }, async () => {
    const w = await newBooking(6000);
    const [a, b, c, d] = [w.people[1]!, w.people[2]!, w.people[3]!, w.people[4]!];
    await setSharing(w.admin, w.id, w.bookingId, [a, b, c, d, w.admin], []);        // 5 people: share 1200
    const id1 = randomUUID();
    expect((await addPayment(w.admin, w.id, w.bookingId, id1, pay(a, 3000))).outcome).toBe("ok");     // one person pays half
    expect((await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(b, 500))).outcome).toBe("ok");  // another pays part of their share
    expect((await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(null, 1000, { payerName: "Zed Guest" }))).outcome).toBe("ok");   // a guest pays, not in the list
    let view = moneyView({ total_cost: 6000 }, await listSharing(w.bookingId), await listPayments(w.bookingId));
    expect(view.summary).toMatchObject({ contributed: 4500, balance: 1500, percent: 75 });
    const status = (u: string) => view.people.find((p) => p.user_id === u)!.status;
    expect([status(a), status(b), status(c)]).toEqual(["pending", "pending", "unpaid"]);       // recorded but nobody has checked yet
    // someone checks the first payment
    expect(await verifyPayment(c, w.id, w.bookingId, id1, true)).toBe("ok");
    view = moneyView({ total_cost: 6000 }, await listSharing(w.bookingId), await listPayments(w.bookingId));
    expect(view.people.find((p) => p.user_id === a)!.status).toBe("paid");                   // 3000 verified, far above the 1200 share
    expect(view.summary.verified).toBe(3000);
    expect((await listPayments(w.bookingId)).find((p) => p.id === id1)).toMatchObject({ verified_by_name: "TEST p2", created_by_name: "TEST admin" });
    // overpaying is allowed and shown
    expect((await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(d, 4000))).outcome).toBe("ok");
    view = moneyView({ total_cost: 6000 }, await listSharing(w.bookingId), await listPayments(w.bookingId));
    expect(view.summary).toMatchObject({ contributed: 8500, balance: 0, overBy: 2500 });
    // history names everything
    const acts = (await listHistory(w.bookingId)).map((h) => h.action);
    expect(acts.filter((x) => x === "payment_recorded")).toHaveLength(4);
    expect(acts).toContain("payment_checked");
    // rules about who and what
    expect((await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(await newUser("stranger"), 100))).outcome).toBe("bad_person");
    expect((await addPayment(await newUser("stranger2"), w.id, w.bookingId, randomUUID(), pay(a, 100))).outcome).toBe("forbidden");
    expect((await addPayment(w.admin, w.id, randomUUID(), randomUUID(), pay(a, 100))).outcome).toBe("not_found");
  });

  it("a record sent twice (after a lost signal) is saved once", { timeout: 120_000 }, async () => {
    const w = await newBooking();
    const id = randomUUID();
    expect(await addPayment(w.admin, w.id, w.bookingId, id, pay(w.people[1]!, 600))).toEqual({ outcome: "ok" });
    expect(await addPayment(w.admin, w.id, w.bookingId, id, pay(w.people[1]!, 600))).toEqual({ outcome: "ok", duplicate: true });
    expect(await listPayments(w.bookingId)).toHaveLength(1);
    const other = await newBooking();
    expect((await addPayment(w.admin, other.id, other.bookingId, id, pay(w.people[1]!, 600))).outcome).toBe("duplicate");   // the same id cannot be reused on another booking
  });

  it("refunds are recorded by hand, limited to what the person put in, and the balance shows", { timeout: 180_000 }, async () => {
    const w = await newBooking(6000);
    const a = w.people[1]!;
    await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(a, 1000));
    expect((await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(a, 1500, { kind: "refund" }))).outcome).toBe("too_much");
    const r = randomUUID();
    expect((await addPayment(w.admin, w.id, w.bookingId, r, pay(a, 400, { kind: "refund" }))).outcome).toBe("ok");
    expect((await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(a, 700, { kind: "refund" }))).outcome).toBe("too_much");   // only 600 left to refund
    await setBookingStatus(w.admin, w.id, w.bookingId, "cancelled");
    const view = moneyView({ total_cost: 6000 }, await listSharing(w.bookingId), await listPayments(w.bookingId));
    expect(view.summary).toMatchObject({ contributed: 600, refunded: 400, balance: 5400 });
    expect((await listHistory(w.bookingId)).map((h) => h.action)).toContain("refund_recorded");
    // a guest's refund is tracked by name too
    await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(null, 300, { payerName: "Zed Guest" }));
    expect((await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(null, 301, { payerName: "zed guest", kind: "refund" }))).outcome).toBe("too_much");
    expect((await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(null, 300, { payerName: "zed guest", kind: "refund" }))).outcome).toBe("ok");
  });

  it("editing a payment is logged with from and to and needs a fresh check; removing one is logged too", { timeout: 120_000 }, async () => {
    const w = await newBooking();
    const a = w.people[1]!;
    const id = randomUUID();
    await addPayment(w.admin, w.id, w.bookingId, id, pay(a, 600));
    await verifyPayment(w.people[2]!, w.id, w.bookingId, id, true);
    expect(await updatePayment(w.people[3]!, w.id, w.bookingId, id, pay(a, 650, { method: "bank_transfer", reference: "TX9" }))).toBe("ok");
    const p = (await listPayments(w.bookingId))[0]!;
    expect(p).toMatchObject({ amount: 650, method: "bank_transfer", reference: "TX9", verified_by_name: null, changed_by_name: "TEST p2", created_by_name: "TEST admin" });
    const change = (await listHistory(w.bookingId)).find((h) => h.action === "payment_changed")!;
    expect(change.actor_name).toBe("TEST p2");
    expect(change.details.changes).toEqual(expect.arrayContaining([{ field: "amount", from: 600, to: 650 }, { field: "method", from: "cash", to: "bank_transfer" }]));
    expect(await verifyPayment(w.admin, w.id, w.bookingId, id, false)).toBe("ok");
    expect(await deletePayment(w.people[2]!, w.id, w.bookingId, id)).toBe("ok");
    expect(await listPayments(w.bookingId)).toHaveLength(0);
    expect((await listHistory(w.bookingId))[0]).toMatchObject({ action: "payment_removed" });
    expect(await deletePayment(w.admin, w.id, w.bookingId, id)).toBe("not_found");
  });

  it("'Remind everyone who has not paid' goes to people whose share is not covered, not the sender, and at most once an hour", { timeout: 180_000 }, async () => {
    const w = await newBooking(6000);
    const [a, b, c] = [w.people[1]!, w.people[2]!, w.people[3]!];
    expect((await remindUnpaid(w.admin, w.id, w.bookingId)).outcome).toBe("nobody");          // nobody is in the list yet
    await setSharing(w.admin, w.id, w.bookingId, [a, b, c], ["Sami"]);                          // 4 people: share 1500
    await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(a, 1500));                   // a covered their share
    await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(b, 700));                    // b paid part
    const r = await remindUnpaid(a, w.id, w.bookingId);
    expect(r).toMatchObject({ outcome: "ok", sent: 2 });                                         // b (part) and c (nothing); a is the sender; Sami has no account
    expect((await query<{ message: string }>("select message from app_alert where user_id = $1 and kind = 'payment_reminder'", [c]))[0]!.message).toContain("PKR 3,800");
    expect(await query("select 1 from app_alert where user_id = $1 and kind = 'payment_reminder'", [a])).toHaveLength(0);
    expect((await remindUnpaid(a, w.id, w.bookingId)).outcome).toBe("too_soon");
    await setBookingStatus(w.admin, w.id, w.bookingId, "cancelled");
    await query("update booking set last_reminder_at = null where id = $1", [w.bookingId]);
    expect((await remindUnpaid(a, w.id, w.bookingId)).outcome).toBe("bad_state");               // no reminders for a cancelled booking
  });

  it("a booking can be linked to one match or several, and unlinked", { timeout: 180_000 }, async () => {
    const w = await newBooking();
    const mk = async (n: string) => (await createMatch(w.admin, w.id, { sides: [{ teamId: null, name: n }, { teamId: null, name: `${n}x` }], scheduledAt: when(), venue: "", overs: 4, playersPerSide: 4, rules: DEFAULT_RULES, umpire: "", notes: "", warning: null })).id!;
    const [m1, m2] = [await mk("Alpha"), await mk("Bravo")];
    expect(await linkMatches(w.admin, w.id, w.bookingId, [m1, m2, randomUUID()])).toBe("ok");   // an unknown id is simply ignored
    expect((await linkedMatches(w.bookingId)).map((m) => m.id).sort()).toEqual([m1, m2].sort());
    expect(await linkMatches(w.admin, w.id, w.bookingId, [m1])).toBe("ok");
    expect(await linkedMatches(w.bookingId)).toHaveLength(1);
    expect((await listHistory(w.bookingId)).find((h) => h.action === "matches")).toBeTruthy();
    expect(await linkMatches(await newUser("stranger"), w.id, w.bookingId, [m1])).toBe("forbidden");
    // deleting the match drops the link but keeps the booking
    await query("delete from cricket_match where id = $1", [m1]);
    expect(await linkedMatches(w.bookingId)).toHaveLength(0);
    expect(await getBooking(w.id, w.bookingId)).not.toBeNull();
  });

  it("leaving takes a person out of open sharing lists but keeps the money they recorded; the list of bookings shows totals", { timeout: 180_000 }, async () => {
    const w = await newBooking(5000);
    const leaver = await newUser("leaver");
    const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [w.id]))[0]!.invite_code;
    await requestToJoin(leaver, code); await chooseNumber(leaver, w.id, 60);
    await setSharing(w.admin, w.id, w.bookingId, [leaver, w.people[1]!], []);
    await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(leaver, 800));
    await leaveCommunity(leaver, w.id);
    expect((await listSharing(w.bookingId)).map((s) => s.user_id)).toEqual([w.people[1]]);
    expect((await listPayments(w.bookingId))[0]).toMatchObject({ payer_name: "TEST leaver", amount: 800 });
    const row = (await listBookings(w.id)).find((b) => b.id === w.bookingId)!;
    expect(row).toMatchObject({ contributed: 800, member_count: 1, total_cost: 5000 });
  });

  it("my payments: what I paid and my suggested share across bookings, with a cancelled booking suggesting nothing", { timeout: 180_000 }, async () => {
    const w = await newBooking(6000);
    const me = w.people[2]!;
    const other = await newBooking(3000);
    const base = await myPayments(w.id, me);                                            // this person may already have records from other tests in the shared community
    const [a, b] = [w.people[1]!, w.people[3]!];
    await setSharing(w.admin, w.id, w.bookingId, [me, a, b], []);                       // 3 people: share 2000
    await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(me, 500));
    const pid = randomUUID();
    await addPayment(w.admin, w.id, w.bookingId, pid, pay(me, 700));
    await verifyPayment(a, w.id, w.bookingId, pid, true);
    let mine = await myPayments(w.id, me);
    const row = mine.rows.find((r) => r.bookingId === w.bookingId)!;
    expect(row).toMatchObject({ share: 2000, paid: 1200, checked: 700, owner: "member" });
    expect(mine.paid - base.paid).toBe(1200);
    expect(mine.stillSuggested - base.stillSuggested).toBe(800);                       // 2000 - 1200
    expect(await myPayments(w.id, await newUser("nobody"))).toEqual({ rows: [], paid: 0, stillSuggested: 0 });
    // paying for others, without being in the list, still shows
    await addPayment(w.admin, w.id, w.bookingId, randomUUID(), pay(w.people[4]!, 900));
    expect((await myPayments(w.id, w.people[4]!)).rows[0]).toMatchObject({ owner: "payer", paid: 900, share: 0 });
    // a cancelled booking suggests nothing more
    await setBookingStatus(w.admin, w.id, w.bookingId, "cancelled");
    mine = await myPayments(w.id, me);
    expect(mine.stillSuggested).toBe(base.stillSuggested);                              // the cancelled booking adds nothing to what is suggested
    expect(mine.paid - base.paid).toBe(1200);
    void other;
  });

  it("the database refuses what the app should never send", { timeout: 120_000 }, async () => {
    const w = await newBooking();
    await expect(query("update booking set total_cost = -1 where id = $1", [w.bookingId])).rejects.toThrow();
    await expect(query("update booking set duration_minutes = 5 where id = $1", [w.bookingId])).rejects.toThrow();
    await expect(query("update booking set status = 'lost' where id = $1", [w.bookingId])).rejects.toThrow();
    await expect(query("insert into booking_payment (id, booking_id, payer_name, kind, amount, paid_on, method, created_by, changed_by) values ($1, $2, 'X', 'payment', 0, now(), 'cash', $3, $3)", [randomUUID(), w.bookingId, w.admin])).rejects.toThrow();
    await expect(query("insert into booking_payment (id, booking_id, payer_name, kind, amount, paid_on, method, created_by, changed_by) values ($1, $2, 'X', 'payment', 5, now(), 'barter', $3, $3)", [randomUUID(), w.bookingId, w.admin])).rejects.toThrow();
    await expect(query("insert into booking_member (booking_id, added_by) values ($1, $2)", [w.bookingId, w.admin])).rejects.toThrow();
    await expect(query("insert into app_alert (community_id, user_id, kind, message) values ($1, $2, 'made_up', 'x')", [w.id, w.admin])).rejects.toThrow();
  });

  it("deleting the community removes its venues, bookings, payments and history", { timeout: 120_000 }, async () => {
    const admin = await newUser("admin");
    const id = await createCommunity(admin, { name: "TEST Gone Club", description: "", location: "", approvalRequired: false });
    communities.push(id);
    const v = await createVenue(admin, id, { name: "Gone Hall", address: "", contact: "" });
    const b = await createBooking(admin, id, input(v.id!));
    await addPayment(admin, id, b.id!, randomUUID(), pay(admin, 100));
    await query("delete from community where id = $1", [id]);
    expect(await query("select 1 from venue where community_id = $1", [id])).toHaveLength(0);
    expect(await query("select 1 from booking where id = $1", [b.id!])).toHaveLength(0);
    expect(await query("select 1 from booking_payment where booking_id = $1", [b.id!])).toHaveLength(0);
    expect(await query("select 1 from booking_history where booking_id = $1", [b.id!])).toHaveLength(0);
  });
});
