// Phase F3: the small pure helpers behind Payments home, the booking form and Venues.
import { describe, expect, it } from "vitest";
import { bookingsText, bySeverity, cardLine, costEffect, defaultSelected, filterTab, isPresetDuration, joinWhen, parseCost, searchVenues, sharingText, splitExample, splitWhen, venueInitials } from "@/lib/pv";

const b = (status: "pending" | "confirmed" | "completed" | "cancelled") => ({ status });

describe("tabs", () => {
  const all = [b("confirmed"), b("pending"), b("completed"), b("cancelled")];
  it("upcoming is pending and confirmed, past is completed and cancelled", () => {
    expect(filterTab(all, "upcoming").map((x) => x.status)).toEqual(["confirmed", "pending"]);
    expect(filterTab(all, "past").map((x) => x.status)).toEqual(["completed", "cancelled"]);
    expect(filterTab(all, "all")).toHaveLength(4);
  });
  it("the preview opens the first booking of the ordered list (upcoming first, else the latest past one)", () => {
    expect(defaultSelected([{ id: "a" }, { id: "b" }])).toBe("a");
    expect(defaultSelected([])).toBeNull();
  });
});

describe("card line", () => {
  const base = { status: "confirmed" as const, total: 12000, contributed: 8500, members: 12, owing: 3, overBy: 0 };
  it("says how many are unpaid", () => expect(cardLine(base)).toEqual({ text: "3 unpaid", tone: "bad" }));
  it("says all covered when nobody owes", () => expect(cardLine({ ...base, contributed: 12000, owing: 0 }).text).toBe("all covered"));
  it("one person covering it all is all covered, even though the others have not paid (paying is a convenience, not a rule)", () => expect(cardLine({ ...base, contributed: 12000, owing: 11 }).text).toBe("all covered"));
  it("says over by with the PKR label when contributions pass the cost", () => expect(cardLine({ ...base, total: 9000, contributed: 9500, owing: 0, overBy: 500 }).text).toBe("over by PKR 500"));
  it("a cancelled booking never claims to be on track: refunds by hand, or nothing was paid", () => {
    expect(cardLine({ ...base, status: "cancelled" }).text).toBe("refunds by hand");
    expect(cardLine({ ...base, status: "cancelled", contributed: 0 }).text).toBe("nothing was paid");
  });
  it("says nobody is chosen yet when no one shares", () => expect(cardLine({ ...base, members: 0, contributed: 0, owing: 0 }).text).toBe("nobody chosen yet"));
  it("sharing wording", () => { expect(sharingText(1)).toBe("1 sharing"); expect(sharingText(12)).toBe("12 sharing"); });
});

describe("date and time fields", () => {
  it("splits and joins the value the server action expects", () => {
    expect(splitWhen("2026-11-28T20:00")).toEqual({ date: "2026-11-28", time: "20:00" });
    expect(joinWhen("2026-11-28", "20:00")).toBe("2026-11-28T20:00");
  });
  it("sends nothing when either half is missing, so the server says to choose the date and start time", () => {
    expect(joinWhen("2026-11-28", "")).toBe("");
    expect(joinWhen("", "20:00")).toBe("");
    expect(splitWhen(undefined)).toEqual({ date: "", time: "" });
  });
});

describe("duration", () => {
  it("presets are the chips; anything else selects Other", () => {
    expect(isPresetDuration("120")).toBe(true);
    expect(isPresetDuration("100")).toBe(false);
    expect(isPresetDuration("")).toBe(false);
  });
});

describe("cost and the example split (rounded UP, an example only)", () => {
  it("parses whole rupees like the server does", () => {
    expect(parseCost("12,000")).toBe(12000);
    expect(parseCost("12.5")).toBeNull();
    expect(parseCost("")).toBeNull();
    expect(parseCost("10000001")).toBeNull();
  });
  it("PKR 12,000 over 10 people is PKR 1,200 each", () => expect(splitExample("12000")?.text).toBe("If 10 people share: PKR 1,200 each"));
  it("rounds up and reports the extra", () => {
    const s = splitExample("10001")!;
    expect(s.share).toBe(1001);
    expect(s.extra).toBe(9);
  });
  it("shows nothing for an empty, zero or invalid cost", () => {
    expect(splitExample("")).toBeNull();
    expect(splitExample("0")).toBeNull();
    expect(splitExample("abc")).toBeNull();
  });
  it("cost change effect: 12 people, PKR 12,000 to PKR 14,000", () => {
    const e = costEffect(12000, 14000, 12);
    expect(e).toMatchObject({ people: 12, now: 1000, after: 1167, extra: 4, changed: true, valid: true });
  });
  it("an invalid or unchanged cost changes nothing", () => {
    expect(costEffect(12000, null, 12)).toMatchObject({ after: 1000, changed: false, valid: false });
    expect(costEffect(12000, 12000, 12).changed).toBe(false);
    expect(costEffect(12000, 14000, 0)).toMatchObject({ now: 0, after: 0 });
  });
});

describe("venues", () => {
  const list = [{ name: "Clifton Indoor Arena", address: "Block 4, Clifton", contact: "0300 1234567" }, { name: "DHA Cricket Dome", address: "", contact: "Mr Qadir" }];
  it("initials and counts", () => {
    expect(venueInitials("Clifton Indoor Arena")).toBe("CI");
    expect(venueInitials("gulshan")).toBe("G");
    expect(bookingsText(1)).toBe("1 booking");
    expect(bookingsText(0)).toBe("0 bookings");
    expect(bookingsText(6)).toBe("6 bookings");
  });
  it("search looks at name, address and contact, ignoring case", () => {
    expect(searchVenues(list, "dome")).toHaveLength(1);
    expect(searchVenues(list, "BLOCK 4")).toHaveLength(1);
    expect(searchVenues(list, "qadir")).toHaveLength(1);
    expect(searchVenues(list, "  ")).toHaveLength(2);
    expect(searchVenues(list, "zzz")).toHaveLength(0);
  });
});

describe("people to cover", () => {
  it("unpaid first, then partly paid, then pending check", () => {
    const people = [{ status: "pending" as const, name: "A" }, { status: "unpaid" as const, name: "B" }, { status: "partial" as const, name: "C" }, { status: "unpaid" as const, name: "A2" }];
    expect(people.sort(bySeverity).map((p) => p.name)).toEqual(["A2", "B", "C", "A"]);
  });
});
