// Phase C3: the new server actions, with the database layers replaced. The real engine is used for the correction preview.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RULES } from "@/lib/matchRules";
import type { PlayerEntry, ScoreEvent, Side } from "@/lib/engine/types";

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const COMM = UUID(1);
const MATCH = UUID(2);
const ENTRY = UUID(3);

const redirect = vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); });
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireAcceptedUser: async () => ({ id: "u1", name: "Ali" }) }));
const getMembership = vi.fn();
vi.mock("@/lib/community", () => ({ getMembership: (...a: unknown[]) => getMembership(...a), isUuid: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) }));
const setLineup = vi.fn();
const addGuest = vi.fn();
const getMatch = vi.fn();
const listLineup = vi.fn();
vi.mock("@/lib/matches", () => ({
  setLineup: (...a: unknown[]) => setLineup(...a), addGuest: (...a: unknown[]) => addGuest(...a),
  getMatch: (...a: unknown[]) => getMatch(...a), listLineup: (...a: unknown[]) => listLineup(...a),
}));
const loadEvents = vi.fn();
vi.mock("@/lib/scoring", () => ({ loadEvents: (...a: unknown[]) => loadEvents(...a) }));

import { addGuestC3, previewCorrectionC3, removeGuestC3, saveLineupC3 } from "./actionsC3";

beforeEach(() => { redirect.mockClear(); getMembership.mockReset(); setLineup.mockReset(); addGuest.mockReset(); getMatch.mockReset(); listLineup.mockReset(); loadEvents.mockReset(); });

describe("saveLineupC3", () => {
  it("sends members and guests to setLineup with the same rule as the old action, then goes to the match page", async () => {
    setLineup.mockResolvedValue({ outcome: "ok" });
    await expect(saveLineupC3(COMM, MATCH, { [`m_${UUID(9)}`]: "1", [`g_${ENTRY}`]: "0", junk: "1", [`m_${UUID(8)}`]: "7" })).rejects.toThrow(`REDIRECT:/c/${COMM}/matches/${MATCH}?e=lineup_saved`);
    const [user, c, m, members, guests] = setLineup.mock.calls[0]!;
    expect([user, c, m]).toEqual(["u1", COMM, MATCH]);
    expect(Array.from((members as Map<string, number>).entries())).toEqual([[UUID(9), 1]]);
    expect(Array.from((guests as Map<string, number>).entries())).toEqual([[ENTRY, 0]]);
  });
  it("answers (does not redirect) with the real sentence when a side is over the limit", async () => {
    setLineup.mockResolvedValue({ outcome: "too_many", tooMany: { side: "Thunder Strikers", max: 6 } });
    const r = await saveLineupC3(COMM, MATCH, { [`m_${UUID(9)}`]: "1" });
    expect(r).toMatchObject({ ok: false, code: "too_many" });
    expect(!r.ok && r.text).toBe("Thunder Strikers can have at most 6 players. Raise “players per side” in Edit match first, or take someone out.");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("answers with the locked sentence when the match has started", async () => {
    setLineup.mockResolvedValue({ outcome: "locked" });
    const r = await saveLineupC3(COMM, MATCH, {});
    expect(!r.ok && r.text).toBe("This match has already started, so this can no longer be changed here.");
  });
  it("refuses ids that are not ids", async () => {
    const r = await saveLineupC3("nope", MATCH, {});
    expect(r).toMatchObject({ ok: false, code: "not_found" });
    expect(setLineup).not.toHaveBeenCalled();
  });
});

describe("addGuestC3 and removeGuestC3", () => {
  it("adds a guest and returns its id; the name is trimmed", async () => {
    addGuest.mockResolvedValue({ outcome: "ok" });
    listLineup.mockResolvedValue([{ id: ENTRY, kind: "guest", guest_name: "Sameer" }]);
    const r = await addGuestC3(COMM, MATCH, 2, "  Sameer ");
    expect(addGuest).toHaveBeenCalledWith("u1", COMM, MATCH, 2, "Sameer");
    expect(r).toEqual({ ok: true, guestId: ENTRY });
  });
  it("blank or too long names come back as the guest-name sentence for the field, before the database", async () => {
    const blank = await addGuestC3(COMM, MATCH, 1, "   ");
    const long = await addGuestC3(COMM, MATCH, 1, "x".repeat(61));
    for (const r of [blank, long]) expect(r).toMatchObject({ ok: false, field: "guest", text: "Type the guest's name (up to 60 characters)." });
    expect(addGuest).not.toHaveBeenCalled();
  });
  it("a repeated name, a full side and a started match each give their own sentence", async () => {
    addGuest.mockResolvedValueOnce({ outcome: "duplicate_guest" });
    expect(await addGuestC3(COMM, MATCH, 1, "Sameer")).toMatchObject({ ok: false, field: "guest", text: "A guest with that name is already in this match. Use a slightly different name." });
    addGuest.mockResolvedValueOnce({ outcome: "too_many", tooMany: { side: "Royal Panthers", max: 6 } });
    expect(await addGuestC3(COMM, MATCH, 2, "Sameer")).toMatchObject({ ok: false, code: "too_many" });
    addGuest.mockResolvedValueOnce({ outcome: "locked" });
    expect(await addGuestC3(COMM, MATCH, 2, "Sameer")).toMatchObject({ ok: false, code: "locked" });
    addGuest.mockResolvedValueOnce({ outcome: "bad_side" });
    expect(await addGuestC3(COMM, MATCH, 5, "Sameer")).toMatchObject({ ok: false, text: "Choose a side." });
  });
  it("Undo takes only that guest out", async () => {
    setLineup.mockResolvedValue({ outcome: "ok" });
    expect(await removeGuestC3(COMM, MATCH, ENTRY)).toEqual({ ok: true });
    const [, , , members, guests] = setLineup.mock.calls[0]!;
    expect((members as Map<string, number>).size).toBe(0);
    expect(Array.from((guests as Map<string, number>).entries())).toEqual([[ENTRY, 0]]);
  });
});

/* ---- correction preview: the real engine on a tiny finished match ---- */
const players = (): PlayerEntry[] => [
  ...[1, 2].map((i) => ({ id: `a${i}`, side: 1 as Side, name: `Alpha${i}`, number: i, kind: "member" as const, userId: `ua${i}` })),
  ...[1, 2].map((i) => ({ id: `b${i}`, side: 2 as Side, name: `Bravo${i}`, number: i + 10, kind: "member" as const, userId: `ub${i}` })),
];
const events = (): ScoreEvent[] => [
  { id: "e1", seq: 1, type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs: 4, playersPerSide: 2, rules: DEFAULT_RULES, players: players(), toss: null, battingFirst: 1 } },
  { id: "e2", seq: 2, type: "innings_start", payload: { striker: "a1", nonStriker: "a2", bowler: "b1" } },
  { id: "e3", seq: 3, type: "ball", payload: { runs: 1 } },
  { id: "e4", seq: 4, type: "ball", payload: { runs: 2 } },
] as ScoreEvent[];
const ids = { communityId: COMM, matchId: MATCH, ballId: UUID(77) };
const input = (over: Record<string, unknown> = {}) => ({ ...ids, extra: "", runs: 4, wicket: "", out: "", fielder: "", ...over });

describe("previewCorrectionC3", () => {
  beforeEach(() => {
    getMembership.mockResolvedValue({ status: "approved" });
    getMatch.mockResolvedValue({ status: "completed" });
    loadEvents.mockResolvedValue(events().map((e) => (e.id === "e3" ? { ...e, id: ids.ballId } : e)));
  });
  it("shows the innings score before and after, and writes nothing", async () => {
    const r = await previewCorrectionC3(input());
    expect(r).toMatchObject({ ok: true, changed: true, innings: { label: "Alpha innings 1", before: "3/0", after: "6/0" } });
  });
  it("says nothing changed when the values are the same as recorded", async () => {
    const r = await previewCorrectionC3(input({ runs: 1 }));
    expect(r).toMatchObject({ ok: true, changed: false, innings: { before: "3/0", after: "3/0" } });
  });
  it("only an approved member may ask (same rule as the real correction)", async () => {
    getMembership.mockResolvedValue({ status: "pending" });
    expect(await previewCorrectionC3(input())).toMatchObject({ ok: false, kind: "forbidden", error: "Only members of this community can correct a match." });
    getMembership.mockResolvedValue(null);
    expect(await previewCorrectionC3(input())).toMatchObject({ ok: false, kind: "forbidden" });
  });
  it("only for a finished match", async () => {
    getMatch.mockResolvedValue({ status: "live" });
    expect(await previewCorrectionC3(input())).toMatchObject({ ok: false, kind: "not_finished", error: "Only a finished match can be corrected here. While it is being scored, use the scoring pad." });
  });
  it("a missing match or ball is not found", async () => {
    getMatch.mockResolvedValue(null);
    expect(await previewCorrectionC3(input())).toMatchObject({ ok: false, kind: "not_found" });
    getMatch.mockResolvedValue({ status: "completed" });
    expect(await previewCorrectionC3(input({ ballId: "nope" }))).toMatchObject({ ok: false, kind: "not_found" });
  });
  it("bad input (runs far too high) is reported, and a change the engine refuses is reported as refused", async () => {
    expect(await previewCorrectionC3(input({ runs: 50 }))).toMatchObject({ ok: false, kind: "invalid" });
    const r = await previewCorrectionC3(input({ ballId: UUID(5), runs: 1 }));
    expect(r).toMatchObject({ ok: false });
  });
});
