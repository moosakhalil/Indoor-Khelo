// Phase F3: what Payments home reads about each booking. The database is replaced by fixtures; the money figures must come from the existing
// money functions (contributions not bills, rounded UP, refunds subtract).
import { describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const bookingRow = (o: Row): Row => ({
  community_id: "c1", venue_id: "v1", venue_name: "Clifton Indoor Arena", venue_address: "Block 4", venue_contact: "", duration_minutes: 120, reference: "", notes: "",
  created_by_name: "Ali", changed_by_name: "Ali", created_at: new Date(), updated_at: new Date(), last_reminder_at: null, ...o,
});
const rows = {
  bookings: [
    bookingRow({ id: "late", starts_at: new Date("2026-12-10T15:00:00Z"), total_cost: 7000, status: "confirmed", contributed: 2000, member_count: 7 }),
    bookingRow({ id: "soon", starts_at: new Date("2026-11-28T15:00:00Z"), total_cost: 6000, status: "pending", contributed: 1000, member_count: 7 }),
    bookingRow({ id: "done", starts_at: new Date("2026-11-01T15:00:00Z"), total_cost: 3000, status: "completed", contributed: 3000, member_count: 2 }),
    bookingRow({ id: "off", starts_at: new Date("2026-11-02T15:00:00Z"), total_cost: 3000, status: "cancelled", contributed: 1500, member_count: 2 }),
  ],
  sharing: [
    ...["a", "b", "c", "d", "e", "f"].map((n, i) => ({ id: `m${n}`, booking_id: "soon", user_id: `u-${n}`, name: `Person ${n}`, guest: false, player_number: i + 1 })),
    { id: "mg", booking_id: "soon", user_id: null, name: "Sami", guest: true, player_number: null },
    { id: "d1", booking_id: "done", user_id: "u-a", name: "Person a", guest: false, player_number: 1 }, { id: "d2", booking_id: "done", user_id: "u-b", name: "Person b", guest: false, player_number: 2 },
  ],
  payments: [
    { id: "p1", booking_id: "soon", payer_user_id: "u-a", payer_name: "Person a", kind: "payment", amount: 858, verified_at: new Date() },
    { id: "p2", booking_id: "soon", payer_user_id: "u-b", payer_name: "Person b", kind: "payment", amount: 858, verified_at: null },
    { id: "p3", booking_id: "soon", payer_user_id: null, payer_name: "Sami", kind: "payment", amount: 300, verified_at: new Date() },
    { id: "p4", booking_id: "done", payer_user_id: "u-a", payer_name: "Person a", kind: "payment", amount: 3000, verified_at: new Date() },
  ] as Row[],
};
vi.mock("@/lib/db", () => ({
  query: async (sql: string) => (sql.includes("join venue v") ? rows.bookings : sql.includes("from booking_member") ? rows.sharing : rows.payments),
  one: async () => null, tx: async () => null, isUniqueViolation: () => false,
}));

import { listBookingsWithMoney } from "@/lib/pvData";

describe("listBookingsWithMoney", () => {
  it("upcoming (pending, confirmed) come soonest first; completed and cancelled go to past", async () => {
    const r = await listBookingsWithMoney("c1", "Asia/Karachi");
    expect(r.upcoming.map((b) => b.id)).toEqual(["soon", "late"]);
    expect(r.past.map((b) => b.id).sort()).toEqual(["done", "off"]);
    expect(r.all).toBe(4);
  });
  it("the suggested share is total over people rounded UP, with the rounding extra (PKR 6,000 over 7 is PKR 858, PKR 6 extra)", async () => {
    const soon = (await listBookingsWithMoney("c1", "UTC")).upcoming[0]!;
    expect(soon.members).toBe(7);
    expect(soon.share).toBe(858);
    expect(soon.extra).toBe(6);
  });
  it("totals come from the payments: contributed, checked (verified) and what is still open", async () => {
    const soon = (await listBookingsWithMoney("c1", "UTC")).upcoming[0]!;
    expect(soon.contributed).toBe(858 + 858 + 300);
    expect(soon.verified).toBe(858 + 300);
    expect(soon.balance).toBe(6000 - 2016);
    expect(soon.percent).toBe(34);
    expect(soon.overBy).toBe(0);
  });
  it("who still has to cover: unpaid first, then partly paid, then pending check; paid people are left out; guests keep a name and no number", async () => {
    const soon = (await listBookingsWithMoney("c1", "UTC")).upcoming[0]!;
    const names = soon.toCover.map((p) => `${p.name}:${p.status}`);
    expect(names).toEqual(["Person c:unpaid", "Person d:unpaid", "Person e:unpaid", "Person f:unpaid", "Sami:partial", "Person b:pending"]);
    expect(soon.toCover.find((p) => p.name === "Sami")).toMatchObject({ guest: true, number: null });
    expect(soon.toCover.find((p) => p.name === "Person c")).toMatchObject({ guest: false, number: 3 });
    expect(soon.toCover.some((p) => p.name === "Person a")).toBe(false);   // paid and checked
  });
  it("the unpaid count is the people whose recorded money is below their share (unpaid or partly paid)", async () => {
    const soon = (await listBookingsWithMoney("c1", "UTC")).upcoming[0]!;
    expect(soon.owing).toBe(5);   // c, d, e, f unpaid + Sami partly paid; Person b is pending check but has paid a full share
  });
  it("a booking nobody shares yet has no people to cover and no share", async () => {
    const late = (await listBookingsWithMoney("c1", "UTC")).upcoming[1]!;
    expect(late).toMatchObject({ id: "late", members: 0, share: 0, extra: 0, owing: 0, toCover: [] });
    expect(late.contributed).toBe(0);
  });
  it("a fully contributed completed booking is at 100 percent even if one person covered it all", async () => {
    const done = (await listBookingsWithMoney("c1", "UTC")).past.find((b) => b.id === "done")!;
    expect(done).toMatchObject({ percent: 100, balance: 0, overBy: 0 });
    expect(done.owing).toBe(1);   // Person b paid nothing, but Person a covered it all: the booking is covered, one person's own share is not
    expect(done.toCover.map((p) => p.name)).toEqual(["Person b"]);
  });
});
