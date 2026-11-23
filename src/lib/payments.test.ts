import { describe, expect, it } from "vitest";
import {
  memberStatus, money, netFor, parseWholeAmount, suggestedShare, summarize, surplus, validateBooking, validateGuest, validatePayment, validateVenue, type Contribution,
} from "./payments";

const uuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const V = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-24T10:00:00Z");

describe("the split", () => {
  it("is total divided by people, rounded up to a whole rupee, with the extra shown as a surplus", () => {
    expect(suggestedShare(6000, 10)).toBe(600);
    expect(surplus(6000, 10)).toBe(0);
    expect(suggestedShare(6000, 7)).toBe(858);     // 857.14 rounded up
    expect(surplus(6000, 7)).toBe(6);              // 858 x 7 = 6006
    expect(suggestedShare(1000, 3)).toBe(334);
    expect(suggestedShare(0, 5)).toBe(0);
    expect(suggestedShare(6000, 0)).toBe(0);        // nobody chosen yet: no share, no divide by zero
    expect(surplus(6000, 0)).toBe(0);
    expect(money(6000)).toBe("PKR 6,000");
  });
  it("totals: seven of ten paid 600 leaves 1,800 open, as in the plan's example", () => {
    const list: Contribution[] = Array.from({ length: 7 }, (_, i) => ({ payerKey: `u:${i}`, kind: "payment", amount: 600, verified: true }));
    expect(summarize(6000, list)).toMatchObject({ contributed: 4200, balance: 1800, percent: 70, overBy: 0 });
  });
  it("paying is a convenience: one person can cover everything, or only some can pay", () => {
    const one: Contribution[] = [{ payerKey: "u:ali", kind: "payment", amount: 6000, verified: true }];
    expect(summarize(6000, one)).toMatchObject({ contributed: 6000, balance: 0, percent: 100 });
    expect(memberStatus(600, netFor(one, "u:ali"), netFor(one, "u:ali", true))).toBe("paid");   // paid far more than the share: simply paid
    expect(memberStatus(600, netFor(one, "u:bob"), 0)).toBe("unpaid");                           // others owe nothing in any binding sense
    const five: Contribution[] = Array.from({ length: 5 }, (_, i) => ({ payerKey: `u:${i}`, kind: "payment" as const, amount: 1200, verified: true }));
    expect(summarize(6000, five).balance).toBe(0);                                                // 5 of 10 paid double and the cost is covered
  });
  it("overpaying is shown, not hidden or blocked", () => {
    expect(summarize(6000, [{ payerKey: "u:a", kind: "payment", amount: 6500, verified: false }])).toMatchObject({ balance: 0, overBy: 500, percent: 100 });
  });
  it("a refund takes money back out of what a person has put in, and out of the totals", () => {
    const list: Contribution[] = [
      { payerKey: "u:a", kind: "payment", amount: 600, verified: true }, { payerKey: "u:a", kind: "refund", amount: 200, verified: true }, { payerKey: "u:b", kind: "payment", amount: 600, verified: false },
    ];
    expect(netFor(list, "u:a")).toBe(400);
    expect(summarize(6000, list)).toMatchObject({ contributed: 1000, refunded: 200, verified: 400, balance: 5000 });
    expect(memberStatus(600, 400, 400)).toBe("partial");
  });
  it("statuses in words: unpaid, pending check, partly paid, paid", () => {
    expect(memberStatus(600, 0, 0)).toBe("unpaid");
    expect(memberStatus(600, -50, 0)).toBe("unpaid");
    expect(memberStatus(600, 600, 0)).toBe("pending");
    expect(memberStatus(600, 600, 300)).toBe("partial");
    expect(memberStatus(600, 600, 600)).toBe("paid");
    expect(memberStatus(0, 0, 0)).toBe("unpaid");
  });
  it("a zero-cost booking is allowed and shows nothing owed", () => {
    expect(summarize(0, [])).toMatchObject({ balance: 0, percent: 0 });
  });
});

describe("amounts and venues", () => {
  it("whole rupees only, commas and spaces tolerated, limits enforced", () => {
    expect(parseWholeAmount("6,000", 0, 10_000_000)).toBe(6000);
    expect(parseWholeAmount(" 600 ", 1, 100)).toBeNull();
    expect(parseWholeAmount("12.5", 0, 100)).toBeNull();
    expect(parseWholeAmount("-5", 0, 100)).toBeNull();
    expect(parseWholeAmount("abc", 0, 100)).toBeNull();
    expect(parseWholeAmount("", 0, 100)).toBeNull();
    expect(parseWholeAmount("0", 1, 100)).toBeNull();
    expect(parseWholeAmount("100", 1, 100)).toBe(100);
  });
  it("a venue needs a name; address and contact are optional and limited", () => {
    expect(validateVenue({ name: "  Arena One ", address: "Blue Area", contact: "0300 1234567" })).toEqual({ ok: true, value: { name: "Arena One", address: "Blue Area", contact: "0300 1234567" } });
    expect(validateVenue({ name: "A" }).ok).toBe(false);
    expect(validateVenue({ name: "x".repeat(61) }).ok).toBe(false);
    expect(validateVenue({ name: "Arena", address: "a".repeat(121) }).ok).toBe(false);
    expect(validateVenue({ name: "Arena", contact: "c".repeat(61) }).ok).toBe(false);
  });
});

describe("a booking", () => {
  const ok = (raw: Record<string, unknown>) => validateBooking({ venueId: V, when: "2026-11-28T19:00", durationMinutes: "60", totalCost: "6000", ...raw }, "Asia/Karachi", NOW, uuid);
  it("takes a venue, a date and time in the viewer's zone, a duration, a cost, a reference and notes", () => {
    expect(ok({ reference: " REF-77 ", notes: "Bring balls" })).toMatchObject({ ok: true, value: { venueId: V, durationMinutes: 60, totalCost: 6000, reference: "REF-77", notes: "Bring balls", startsAt: new Date("2026-11-28T14:00:00Z") } });
  });
  it("refuses a missing venue, a missing or impossible date, a past date, a wrong duration, a bad cost, and over-long text", () => {
    expect(ok({ venueId: "" })).toMatchObject({ ok: false, errors: { venueId: expect.any(String) } });
    expect(ok({ when: "" })).toMatchObject({ ok: false, errors: { when: expect.any(String) } });
    expect(ok({ when: "2026-02-31T10:00" }).ok).toBe(false);
    expect(ok({ when: "2020-01-01T10:00" })).toMatchObject({ ok: false, errors: { when: expect.stringMatching(/past/) } });
    expect(ok({ durationMinutes: "10" }).ok).toBe(false);
    expect(ok({ durationMinutes: "721" }).ok).toBe(false);
    expect(ok({ durationMinutes: "1h" }).ok).toBe(false);
    expect(ok({ totalCost: "-1" }).ok).toBe(false);
    expect(ok({ totalCost: "99999999" }).ok).toBe(false);
    expect(ok({ totalCost: "" }).ok).toBe(false);
    expect(ok({ totalCost: "0" }).ok).toBe(true);
    expect(ok({ reference: "r".repeat(41) }).ok).toBe(false);
    expect(ok({ notes: "n".repeat(301) }).ok).toBe(false);
  });
});

describe("a payment record", () => {
  const ok = (raw: Record<string, unknown>) => validatePayment({ kind: "payment", amount: "600", paidOn: "2026-11-24", method: "cash", payer: `u:${V}`, ...raw }, NOW, uuid);
  it("takes who paid (a member or a guest by name), the amount, date, method and reference", () => {
    expect(ok({ reference: " TX-1 " })).toEqual({ ok: true, value: { kind: "payment", amount: 600, paidOn: "2026-11-24", method: "cash", reference: "TX-1", payerUserId: V, payerName: "" } });
    expect(ok({ payer: "g:Sami Guest", method: "easypaisa" })).toMatchObject({ ok: true, value: { payerUserId: null, payerName: "Sami Guest", method: "easypaisa" } });
    expect(ok({ kind: "refund" })).toMatchObject({ ok: true, value: { kind: "refund" } });
  });
  it("refuses a missing payer, a bad amount, a future or impossible date, an unknown method, and over-long text", () => {
    expect(ok({ payer: "" })).toMatchObject({ ok: false, errors: { payer: expect.any(String) } });
    expect(ok({ payer: "u:not-an-id" }).ok).toBe(false);
    expect(ok({ payer: "g:" }).ok).toBe(false);
    expect(ok({ payer: `g:${"g".repeat(61)}` }).ok).toBe(false);
    expect(ok({ amount: "0" })).toMatchObject({ ok: false, errors: { amount: expect.any(String) } });
    expect(ok({ amount: "6.5" }).ok).toBe(false);
    expect(ok({ amount: "-6" }).ok).toBe(false);
    expect(ok({ paidOn: "2026-12-30" })).toMatchObject({ ok: false, errors: { paidOn: expect.stringMatching(/future/) } });
    expect(ok({ paidOn: "yesterday" }).ok).toBe(false);
    expect(ok({ paidOn: "2026-02-31" }).ok).toBe(false);
    expect(ok({ paidOn: "2010-01-01" }).ok).toBe(false);
    expect(ok({ method: "barter" })).toMatchObject({ ok: false, errors: { method: expect.any(String) } });
    expect(ok({ reference: "r".repeat(61) }).ok).toBe(false);
  });
  it("a guest's name must be 1 to 60 characters", () => {
    expect(validateGuest("  Sami ")).toEqual({ ok: true, value: "Sami" });
    expect(validateGuest("   ").ok).toBe(false);
    expect(validateGuest("g".repeat(61)).ok).toBe(false);
  });
});
