// Phase F1: the Series actions that answer with a message instead of reloading. The database functions are replaced, so this never touches a database;
// what is tested is that every one keeps the checks of the old actions: signed-in member, same validation, same messages, and that a message (not a redirect) comes back on failure.
import { beforeEach, describe, expect, it, vi } from "vitest";

const C = "11111111-1111-4111-8111-111111111111", S = "22222222-2222-4222-8222-222222222222", M = "33333333-3333-4333-8333-333333333333", T1 = "44444444-4444-4444-8444-444444444441", T2 = "44444444-4444-4444-8444-444444444442";

vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireAcceptedUser: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("@/lib/community", () => ({ isUuid: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) }));
vi.mock("@/lib/matches", () => ({ teamNames: vi.fn(async () => new Map([[T1, "Thunder Strikers"], [T2, "Royal Panthers"]])) }));
vi.mock("@/lib/seriesDb", () => ({
  addMatches: vi.fn(), closeSeries: vi.fn(), createSeries: vi.fn(), createSeriesFromMatches: vi.fn(), removeMatch: vi.fn(), reopenSeries: vi.fn(), updateSeries: vi.fn(),
}));

import { addMatchesF1Action, createSeriesF1Action, groupMatchesF1Action, removeMatchQuietAction, seriesStatusQuietAction, updateSeriesF1Action } from "@/app/actionsF1";
import * as db from "@/lib/seriesDb";

const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x); return f; };
const valid = { communityId: C, name: "Winter Cup", format: "best_of", bestOf: "3", side0Team: T1, side0Name: "", side1Team: T2, side1Name: "" };
const redirectTo = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return (e as Error).message; } };

beforeEach(() => { vi.clearAllMocks(); });

describe("create and change: same answers as before", () => {
  it("validation errors come back per field, nothing is saved", async () => {
    const r = await createSeriesF1Action({}, fd({ communityId: C, name: "A", format: "open", side0Team: T1, side0Name: "" }));
    expect(r.error).toBe("Please fix the highlighted fields.");
    expect(r.fieldErrors?.name).toBe("Give the series a name (at least 2 letters).");
    expect(r.fieldErrors?.sides).toBe("Choose at least 2 teams.");
    expect(db.createSeries).not.toHaveBeenCalled();
  });
  it("a team not of this community is refused with the real message", async () => {
    const r = await createSeriesF1Action({}, fd({ ...valid, side1Team: "44444444-4444-4444-8444-444444444499" }));
    expect(r.fieldErrors?.side1).toBe("That team is not part of this community.");
  });
  it("the form has room for 8 teams and the rule maximum is still checked", async () => {
    const eight = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`side${i}Name`, `Team number ${i}`]));
    vi.mocked(db.createSeries).mockResolvedValue({ outcome: "ok", id: S });
    expect(await redirectTo(createSeriesF1Action({}, fd({ communityId: C, name: "Big cup", format: "open", ...eight })))).toBe(`REDIRECT:/c/${C}/series/${S}?created=1`);
    expect((vi.mocked(db.createSeries).mock.calls[0]![2].sides)).toHaveLength(8);
  });
  it("name taken, bad team, forbidden", async () => {
    vi.mocked(db.createSeries).mockResolvedValueOnce({ outcome: "name_taken" });
    expect((await createSeriesF1Action({}, fd(valid))).fieldErrors?.name).toBe("A series with this name already exists in this community.");
    vi.mocked(db.createSeries).mockResolvedValueOnce({ outcome: "bad_team" });
    expect((await createSeriesF1Action({}, fd(valid))).fieldErrors?.sides).toBe("Choose teams from this community.");
    vi.mocked(db.createSeries).mockResolvedValueOnce({ outcome: "forbidden" });
    expect((await createSeriesF1Action({}, fd(valid))).error).toBe("Only members of this community can create a series.");
  });
  it("success goes to the new series with ?created=1", async () => {
    vi.mocked(db.createSeries).mockResolvedValue({ outcome: "ok", id: S });
    expect(await redirectTo(createSeriesF1Action({}, fd(valid)))).toBe(`REDIRECT:/c/${C}/series/${S}?created=1`);
  });
  it("update: a team with matches cannot be taken out (the server's reason is returned), success goes to ?saved=1", async () => {
    vi.mocked(db.updateSeries).mockResolvedValueOnce({ outcome: "side_in_use", reason: "Royal Panthers is not a team of this series. It already has matches in this series, so it cannot be taken out." });
    const r = await updateSeriesF1Action({}, fd({ ...valid, seriesId: S }));
    expect(r.fieldErrors?.sides).toContain("It already has matches in this series, so it cannot be taken out.");
    vi.mocked(db.updateSeries).mockResolvedValueOnce({ outcome: "ok" });
    expect(await redirectTo(updateSeriesF1Action({}, fd({ ...valid, seriesId: S })))).toBe(`REDIRECT:/c/${C}/series/${S}?saved=1`);
    vi.mocked(db.updateSeries).mockResolvedValueOnce({ outcome: "not_found" });
    expect((await updateSeriesF1Action({}, fd({ ...valid, seriesId: S }))).error).toBe("That series no longer exists.");
    vi.mocked(db.updateSeries).mockResolvedValueOnce({ outcome: "forbidden" });
    expect((await updateSeriesF1Action({}, fd({ ...valid, seriesId: S }))).error).toBe("Only members of this community can change a series.");
  });
  it("a bad series id is refused before anything is read", async () => {
    expect((await updateSeriesF1Action({}, fd({ ...valid, seriesId: "nope" }))).error).toBe("Series not found.");
    expect((await createSeriesF1Action({}, fd({ ...valid, communityId: "nope" }))).error).toBe("Community not found.");
  });
});

describe("group matches: the message comes back and nothing is lost", () => {
  it("a name of one letter or over 60 is refused with the real message", async () => {
    expect((await groupMatchesF1Action({}, fd({ communityId: C, name: "A", match: [M] }))).error).toBe("Type a name of 2 to 60 characters, or leave it empty for an automatic name.");
    expect((await groupMatchesF1Action({}, fd({ communityId: C, name: "x".repeat(61), match: [M] }))).error).toContain("2 to 60 characters");
    expect(db.createSeriesFromMatches).not.toHaveBeenCalled();
  });
  it("'in another series' returns the server's sentence", async () => {
    vi.mocked(db.createSeriesFromMatches).mockResolvedValue({ outcome: "in_other_series", reason: "A match can be in only one series. One of these is already in another series." });
    expect(await groupMatchesF1Action({}, fd({ communityId: C, name: "", match: [M] }))).toEqual({ error: "A match can be in only one series. One of these is already in another series." });
  });
  it("without a server sentence the known message for the outcome is used", async () => {
    vi.mocked(db.createSeriesFromMatches).mockResolvedValue({ outcome: "bad_match" });
    expect((await groupMatchesF1Action({}, fd({ communityId: C, name: "", match: [] }))).error).toBe("Choose at least one match.");
    vi.mocked(db.createSeriesFromMatches).mockResolvedValue({ outcome: "too_few" });
    expect((await groupMatchesF1Action({}, fd({ communityId: C, name: "", match: [M] }))).error).toBe("A series needs at least two teams.");
    vi.mocked(db.createSeriesFromMatches).mockResolvedValue({ outcome: "sides" });
    expect((await groupMatchesF1Action({}, fd({ communityId: C, name: "", match: [M] }))).error).toBe("Those matches have too many different teams for one series.");
    vi.mocked(db.createSeriesFromMatches).mockResolvedValue({ outcome: "forbidden" });
    expect((await groupMatchesF1Action({}, fd({ communityId: C, name: "", match: [M] }))).error).toBe("Only members of this community can create a series.");
  });
  it("success passes the typed name (or null) and the ticked matches, then goes to ?created=1", async () => {
    vi.mocked(db.createSeriesFromMatches).mockResolvedValue({ outcome: "ok", id: S });
    expect(await redirectTo(groupMatchesF1Action({}, fd({ communityId: C, name: " Mix ", match: [M, T1] })))).toBe(`REDIRECT:/c/${C}/series/${S}?created=1`);
    expect(vi.mocked(db.createSeriesFromMatches).mock.calls[0]!.slice(1)).toEqual([C, "Mix", [M, T1]]);
    await redirectTo(groupMatchesF1Action({}, fd({ communityId: C, name: "", match: [M] })));
    expect(vi.mocked(db.createSeriesFromMatches).mock.calls[1]![2]).toBeNull();
  });
});

describe("add matches", () => {
  it("a server sentence comes back as the message (the ticks stay on the page)", async () => {
    vi.mocked(db.addMatches).mockResolvedValue({ outcome: "sides", reason: "Desert Falcons is not a team of this series. Add the team to the series first." });
    expect(await addMatchesF1Action({}, fd({ communityId: C, seriesId: S, match: [M] }))).toEqual({ error: "Desert Falcons is not a team of this series. Add the team to the series first." });
  });
  it("closed series: the real sentence", async () => {
    vi.mocked(db.addMatches).mockResolvedValue({ outcome: "bad_state", reason: "This series is closed. Reopen it to add matches." });
    expect((await addMatchesF1Action({}, fd({ communityId: C, seriesId: S, match: [M] }))).error).toBe("This series is closed. Reopen it to add matches.");
  });
  it("a forbidden answer has a message too", async () => {
    vi.mocked(db.addMatches).mockResolvedValue({ outcome: "forbidden" });
    expect((await addMatchesF1Action({}, fd({ communityId: C, seriesId: S, match: [M] }))).error).toBe("Only members of this community can do that.");
  });
  it("success goes to ?added=N", async () => {
    vi.mocked(db.addMatches).mockResolvedValue({ outcome: "ok", ids: [M, T1] });
    expect(await redirectTo(addMatchesF1Action({}, fd({ communityId: C, seriesId: S, match: [M, T1] })))).toBe(`REDIRECT:/c/${C}/series/${S}?added=2`);
  });
  it("bad ids are refused", async () => {
    expect((await addMatchesF1Action({}, fd({ communityId: C, seriesId: "x", match: [M] }))).error).toBe("Series not found.");
    expect(db.addMatches).not.toHaveBeenCalled();
  });
});

describe("close, reopen and remove answer without leaving the page", () => {
  it("close and reopen", async () => {
    vi.mocked(db.closeSeries).mockResolvedValue("ok");
    vi.mocked(db.reopenSeries).mockResolvedValue("ok");
    expect(await seriesStatusQuietAction(fd({ communityId: C, seriesId: S, to: "closed" }))).toEqual({ ok: true });
    expect(db.closeSeries).toHaveBeenCalledWith("u1", C, S);
    expect(await seriesStatusQuietAction(fd({ communityId: C, seriesId: S, to: "open" }))).toEqual({ ok: true });
    expect(db.reopenSeries).toHaveBeenCalledWith("u1", C, S);
  });
  it("the real error wording", async () => {
    vi.mocked(db.closeSeries).mockResolvedValue("bad_state");
    expect(await seriesStatusQuietAction(fd({ communityId: C, seriesId: S, to: "closed" }))).toEqual({ ok: false, error: "That cannot be done in the series' current state." });
    vi.mocked(db.reopenSeries).mockResolvedValue("forbidden");
    expect(await seriesStatusQuietAction(fd({ communityId: C, seriesId: S, to: "open" }))).toEqual({ ok: false, error: "Only members of this community can do that." });
    vi.mocked(db.reopenSeries).mockResolvedValue("not_found");
    expect(await seriesStatusQuietAction(fd({ communityId: C, seriesId: S, to: "open" }))).toEqual({ ok: false, error: "That could not be found." });
  });
  it("remove from series keeps the match (only the link is removed by the database function)", async () => {
    vi.mocked(db.removeMatch).mockResolvedValue("ok");
    expect(await removeMatchQuietAction(fd({ communityId: C, seriesId: S, matchId: M }))).toEqual({ ok: true });
    expect(db.removeMatch).toHaveBeenCalledWith("u1", C, S, M);
    vi.mocked(db.removeMatch).mockResolvedValue("not_in_series");
    expect(await removeMatchQuietAction(fd({ communityId: C, seriesId: S, matchId: M }))).toEqual({ ok: false, error: "That match is not in this series." });
    expect(await removeMatchQuietAction(fd({ communityId: C, seriesId: S, matchId: "bad" }))).toEqual({ ok: false, error: "That could not be found." });
  });
});
