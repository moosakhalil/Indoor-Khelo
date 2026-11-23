import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { validateQuickMatch } from "./quickMatchRules";

const uuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
let n = 0;
const id = () => `${(++n).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
const member = (side: 1 | 2, userId = id()) => ({ id: id(), side, userId, guestName: null });
const guest = (side: 1 | 2, name: string) => ({ id: id(), side, userId: null, guestName: name });
const base = (over: Record<string, unknown> = {}) => ({
  id: id(), sides: [{ id: id(), name: "Alpha" }, { id: id(), name: "Bravo" }], overs: 6, playersPerSide: 6,
  players: [member(1), member(1), member(2), member(2)], ...over,
});

describe("offline quick match rules", () => {
  it("accepts a normal match and uses the traditional rules", () => {
    const r = validateQuickMatch(base(), uuid);
    expect(r.ok && r.value).toMatchObject({ overs: 6, playersPerSide: 6, sides: [{ name: "Alpha" }, { name: "Bravo" }] });
    expect(r.ok && r.value.rules).toEqual(DEFAULT_RULES);
  });
  it("trims names, and accepts guests", () => {
    const r = validateQuickMatch(base({ sides: [{ id: id(), name: "  Alpha " }, { id: id(), name: "Bravo" }], players: [member(1), guest(1, "  Sami "), member(2), guest(2, "Imran")] }), uuid);
    expect(r.ok && r.value.sides[0].name).toBe("Alpha");
    expect(r.ok && r.value.players.filter((p) => p.guestName).map((p) => p.guestName)).toEqual(["Sami", "Imran"]);
  });
  it("refuses bad or equal team names", () => {
    expect(validateQuickMatch(base({ sides: [{ id: id(), name: "A" }, { id: id(), name: "Bravo" }] }), uuid)).toMatchObject({ ok: false, errors: { sideA: expect.any(String) } });
    expect(validateQuickMatch(base({ sides: [{ id: id(), name: "Alpha" }, { id: id(), name: " alpha " }] }), uuid)).toMatchObject({ ok: false, errors: { sideB: expect.stringMatching(/different/) } });
    expect(validateQuickMatch(base({ sides: [{ id: id(), name: "x".repeat(41) }, { id: id(), name: "Bravo" }] }), uuid).ok).toBe(false);
    expect(validateQuickMatch(base({ sides: [{ id: id(), name: "Alpha" }] }), uuid).ok).toBe(false);
  });
  it("refuses bad overs and players per side", () => {
    for (const overs of [0, 51, 2.5, "x", null]) expect(validateQuickMatch(base({ overs }), uuid)).toMatchObject({ ok: false, errors: { overs: expect.any(String) } });
    for (const playersPerSide of [1, 12, "six", null]) expect(validateQuickMatch(base({ playersPerSide }), uuid)).toMatchObject({ ok: false, errors: { playersPerSide: expect.any(String) } });
    expect(validateQuickMatch(base({ overs: "6", playersPerSide: "4" }), uuid).ok).toBe(true);   // numbers typed into a form arrive as text
  });
  it("a member is on one side only, once; a guest name is used once; every lineup entry is a member or a guest", () => {
    const same = id();
    expect(validateQuickMatch(base({ players: [member(1, same), member(2, same), member(1), member(2)] }), uuid)).toMatchObject({ ok: false, errors: { players: expect.stringMatching(/only be in one lineup/) } });
    expect(validateQuickMatch(base({ players: [guest(1, "Sami"), guest(2, "sami"), member(1), member(2)] }), uuid)).toMatchObject({ ok: false, errors: { players: expect.stringMatching(/same name/) } });
    expect(validateQuickMatch(base({ players: [{ id: id(), side: 1, userId: id(), guestName: "Both" }, member(1), member(2), member(2)] }), uuid).ok).toBe(false);
    expect(validateQuickMatch(base({ players: [{ id: id(), side: 1, userId: null, guestName: null }, member(1), member(2), member(2)] }), uuid).ok).toBe(false);
    expect(validateQuickMatch(base({ players: [guest(1, "g".repeat(61)), member(1), member(2), member(2)] }), uuid).ok).toBe(false);
    expect(validateQuickMatch(base({ players: [{ id: "nope", side: 1, userId: id(), guestName: null }, member(1), member(2), member(2)] }), uuid).ok).toBe(false);
    expect(validateQuickMatch(base({ players: [{ id: id(), side: 3, userId: id(), guestName: null }, member(1), member(2), member(2)] }), uuid).ok).toBe(false);
    const dup = id();
    expect(validateQuickMatch(base({ players: [{ id: dup, side: 1, userId: id(), guestName: null }, { id: dup, side: 1, userId: id(), guestName: null }, member(2), member(2)] }), uuid).ok).toBe(false);
  });
  it("each side needs at least 2 players and at most players per side", () => {
    expect(validateQuickMatch(base({ players: [member(1), member(2), member(2)] }), uuid)).toMatchObject({ ok: false, errors: { players_1: expect.stringMatching(/at least 2/) } });
    expect(validateQuickMatch(base({ playersPerSide: 2, players: [member(1), member(1), member(1), member(2), member(2)] }), uuid)).toMatchObject({ ok: false, errors: { players_1: expect.stringMatching(/at most 2/) } });
    expect(validateQuickMatch(base({ players: Array.from({ length: 23 }, () => member(1)) }), uuid).ok).toBe(false);
  });
  it("refuses ids that are not real, and nonsense bodies", () => {
    expect(validateQuickMatch(base({ id: "not-an-id" }), uuid).ok).toBe(false);
    expect(validateQuickMatch(base({ sides: [{ id: "x", name: "Alpha" }, { id: id(), name: "Bravo" }] }), uuid).ok).toBe(false);
    const dupSide = id();
    expect(validateQuickMatch(base({ sides: [{ id: dupSide, name: "Alpha" }, { id: dupSide, name: "Bravo" }] }), uuid).ok).toBe(false);
    for (const junk of [null, 5, "x", [], undefined]) expect(validateQuickMatch(junk, uuid).ok).toBe(false);
  });
});
