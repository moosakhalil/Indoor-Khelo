// Phase C3: the rules of the Pick lineups screen that run in the browser (no database).
import { describe, expect, it } from "vitest";
import {
  buildRows, changeCount, changesOf, countsOf, fillWithIn, groupMembers, guestKey, memberKey, overLimit, replyCounts, sameGuestName, sideOfKey, withSide,
  type PickGuest, type PickMember,
} from "./lineupPick";

const mem = (id: string, name: string, number: number | null, answer: PickMember["answer"], saved: 0 | 1 | 2 = 0): PickMember => ({ id, name, number, answer, role: null, saved });
const M = [
  mem("a", "Ali Raza", 7, "in"), mem("b", "Zain Malik", 3, "in"), mem("c", "Bilal Ahmed", 18, "in"), mem("d", "Talha Mehmood", 8, null),
  mem("e", "Hassan Raza", 5, "out", 2), mem("f", "No Number", null, "in"),
];

describe("counts, changes and the limit", () => {
  it("counts people on each side on screen, including saved ones and guests", () => {
    const g: PickGuest = { id: "g1", name: "Sameer", kind: "guest", userId: null, linkedBy: null, saved: 1 };
    const rows = buildRows(M, [g]);
    expect(countsOf(rows, {})).toEqual([1, 1]);
    const d = withSide(rows, {}, memberKey("a"), 1);
    expect(countsOf(rows, d)).toEqual([2, 1]);
    expect(changeCount(rows, d)).toBe(1);
  });
  it("putting someone back on their saved side is no change", () => {
    const rows = buildRows(M, []);
    let d = withSide(rows, {}, memberKey("e"), 0);
    expect(changeCount(rows, d)).toBe(1);
    d = withSide(rows, d, memberKey("e"), 2);
    expect(changeCount(rows, d)).toBe(0);
    expect(changesOf(rows, d)).toEqual({});
  });
  it("a seventh player is over the limit (and an eighth on the other side too)", () => {
    expect(overLimit([6, 6], 6)).toBe(0);
    expect(overLimit([7, 4], 6)).toBe(1);
    expect(overLimit([2, 7], 6)).toBe(2);
  });
  it("people saved on a side who are not in the list still count", () => {
    expect(countsOf(buildRows(M, []), {}, [2, 1])).toEqual([2, 2]);
  });
  it("changesOf sends only the real changes", () => {
    const rows = buildRows(M, []);
    const d = withSide(rows, withSide(rows, {}, memberKey("a"), 1), memberKey("e"), 0);
    expect(changesOf(rows, d)).toEqual({ m_a: 1, m_e: 0 });
  });
});

describe("a guest linked to a member is one entry", () => {
  const linked: PickGuest = { id: "g9", name: "Imran Javed", kind: "linked", userId: "a", linkedBy: "Ali", saved: 1 };
  const m = [mem("a", "Imran Javed", 7, "in", 1), mem("b", "Zain", 3, "in")];
  it("is counted once and both controls move together", () => {
    const rows = buildRows(m, [linked]);
    expect(countsOf(rows, {})).toEqual([1, 0]);
    const d = withSide(rows, {}, guestKey("g9"), 2);
    expect(sideOfKey(rows, memberKey("a"), d)).toBe(2);
    expect(countsOf(rows, d)).toEqual([0, 1]);
    expect(changesOf(rows, d)).toEqual({ g_g9: 2, m_a: 2 });
    expect(changeCount(rows, d)).toBe(1);
  });
});

describe("Add everyone who is in", () => {
  it("adds those who replied In, by player number, until the side is full, and skips the rest", () => {
    const rows = buildRows(M, []);
    const r = fillWithIn(M, rows, {}, 1, 2);
    expect(r.added).toBe(2);
    expect(r.skipped).toBe(2); // c (18) and "No Number" did not fit
    expect(Object.keys(changesOf(rows, r.draft)).sort()).toEqual(["m_a", "m_b"]); // #3 Zain, #7 Ali
    expect(countsOf(rows, r.draft)).toEqual([2, 1]);
  });
  it("skips people already placed and counts guests toward the limit", () => {
    const g: PickGuest = { id: "g1", name: "Sameer", kind: "guest", userId: null, linkedBy: null, saved: 1 };
    const rows = buildRows(M, [g]);
    const r = fillWithIn(M, rows, {}, 1, 2);
    expect(r.added).toBe(1);
    expect(r.skipped).toBe(3);
  });
  it("adds nobody when nobody replied In", () => {
    const none = M.map((m) => ({ ...m, answer: null as PickMember["answer"] }));
    const r = fillWithIn(none, buildRows(none, []), {}, 2, 6);
    expect(r).toMatchObject({ added: 0, skipped: 0 });
  });
  it("a member already on the other side is not moved", () => {
    const placed = [mem("a", "Ali", 1, "in", 2), mem("b", "Zain", 2, "in")];
    const r = fillWithIn(placed, buildRows(placed, []), {}, 1, 6);
    expect(r.added).toBe(1);
    expect(changesOf(buildRows(placed, []), r.draft)).toEqual({ m_b: 1 });
  });
});

describe("groups, filters and search", () => {
  it("orders In, then No reply, then Can't make it, by number inside", () => {
    const g = groupMembers(M, "all", "");
    expect(g.map((x) => x.title)).toEqual(["Said yes", "No reply", "Can’t make it"]);
    expect(g[0]!.items.map((m) => m.name)).toEqual(["Zain Malik", "Ali Raza", "Bilal Ahmed", "No Number"]);
  });
  it("counts replies for the filter chips and narrows by filter and by name", () => {
    expect(replyCounts(M)).toEqual({ all: 6, in: 4, none: 1, out: 1 });
    expect(groupMembers(M, "out", "").map((g) => g.id)).toEqual(["out"]);
    expect(groupMembers(M, "all", "raza").flatMap((g) => g.items.map((m) => m.name))).toEqual(["Ali Raza", "Hassan Raza"]);
    expect(groupMembers(M, "none", "zzz")).toEqual([]);
  });
});

describe("guest names", () => {
  it("same name in any case and spacing is the same guest", () => {
    expect(sameGuestName(" Sameer  Khan ", "sameer khan")).toBe(true);
    expect(sameGuestName("Sameer", "Sameera")).toBe(false);
  });
});
