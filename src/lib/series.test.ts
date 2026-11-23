import { describe, expect, it } from "vitest";
import { pointsTable, realDate, seriesStatus, sideIndex, sidesFit, tally, tallyLine, validateSeries, type SeriesMatch, type SeriesSide } from "./series";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const names = new Map([[T1, "Alpha"], [T2, "Bravo"]]);
const two: SeriesSide[] = [{ name: "Alpha", teamId: null }, { name: "Bravo", teamId: null }];
const three: SeriesSide[] = [...two, { name: "Charlie", teamId: null }];

let n = 0;
const m = (a: string, b: string, kind: SeriesMatch["resultKind"], winner: 1 | 2 | null, status = "completed"): SeriesMatch => ({
  matchId: `m${++n}`, status, resultKind: kind, winnerPosition: winner, side1: { name: a, teamId: null }, side2: { name: b, teamId: null },
});

describe("series form", () => {
  const ok = (raw: Record<string, unknown>, sides: { teamId?: string; name?: string }[] = [{ name: "Alpha" }, { name: "Bravo" }]) => validateSeries({ name: "Weekend", format: "open", ...raw }, sides, names);
  it("takes a name, a format, optional dates and notes, and at least two teams", () => {
    expect(ok({})).toMatchObject({ ok: true, value: { name: "Weekend", format: "open", bestOf: null, startsOn: null, endsOn: null, notes: "", sides: [{ name: "Alpha", teamId: null }, { name: "Bravo", teamId: null }] } });
    expect(ok({ format: "best_of", bestOf: "3", startsOn: "2026-12-01", endsOn: "2026-12-03", notes: " fun " })).toMatchObject({ ok: true, value: { format: "best_of", bestOf: 3, startsOn: "2026-12-01", endsOn: "2026-12-03", notes: "fun" } });
  });
  it("a permanent team is used by its real name; blank rows are ignored", () => {
    const r = ok({}, [{ teamId: T1, name: "ignored" }, { teamId: "", name: "  Walk-ins " }, { teamId: "", name: "" }]);
    expect(r).toMatchObject({ ok: true, value: { sides: [{ teamId: T1, name: "Alpha" }, { teamId: null, name: "Walk-ins" }] } });
  });
  it("refuses a bad name, format, best-of, dates, notes and teams, with a message for each", () => {
    expect(ok({ name: "A" })).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
    expect(ok({ name: "x".repeat(61) }).ok).toBe(false);
    expect(ok({ format: "league" })).toMatchObject({ ok: false, errors: { format: expect.any(String) } });
    for (const bad of ["", "0", "22", "2.5", "three", "-1"]) expect(ok({ format: "best_of", bestOf: bad })).toMatchObject({ ok: false, errors: { bestOf: expect.any(String) } });
    expect(ok({ format: "best_of", bestOf: "1" }).ok).toBe(true);
    expect(ok({ format: "best_of", bestOf: "21" }).ok).toBe(true);
    expect(ok({ startsOn: "2026-02-31" })).toMatchObject({ ok: false, errors: { startsOn: expect.any(String) } });
    expect(ok({ endsOn: "soon" }).ok).toBe(false);
    expect(ok({ startsOn: "2026-12-05", endsOn: "2026-12-01" })).toMatchObject({ ok: false, errors: { endsOn: expect.stringMatching(/before/) } });
    expect(ok({ startsOn: "2026-12-05", endsOn: "2026-12-05" }).ok).toBe(true);
    expect(ok({ notes: "n".repeat(301) }).ok).toBe(false);
    expect(ok({}, [{ name: "Alpha" }])).toMatchObject({ ok: false, errors: { sides: expect.stringMatching(/at least 2/) } });
    expect(ok({}, [{ name: "Alpha" }, { name: "alpha" }])).toMatchObject({ ok: false, errors: { sides: expect.any(String) } });
    expect(ok({}, [{ teamId: T1 }, { teamId: T1 }])).toMatchObject({ ok: false });
    expect(ok({}, [{ teamId: "33333333-3333-4333-8333-333333333333" }, { name: "Bravo" }])).toMatchObject({ ok: false, errors: { side0: expect.any(String) } });
    expect(ok({}, [{ name: "A" }, { name: "Bravo" }])).toMatchObject({ ok: false, errors: { side0: expect.any(String) } });
    expect(ok({}, [{ name: "x".repeat(41) }, { name: "Bravo" }]).ok).toBe(false);
    expect(ok({}, Array.from({ length: 9 }, (_, i) => ({ name: `Team ${i}` }))).ok).toBe(false);
    expect(ok({}, Array.from({ length: 8 }, (_, i) => ({ name: `Team ${i}` }))).ok).toBe(true);
  });
  it("only real calendar dates", () => {
    expect(realDate("2026-12-31")).toBe(true);
    expect(realDate("2026-02-29")).toBe(false);
    expect(realDate("2028-02-29")).toBe(true);
    expect(realDate("31-12-2026")).toBe(false);
  });
});

describe("the tally", () => {
  it("counts wins for each team: Alpha 2, Bravo 1, one tied", () => {
    const t = tally(two, [m("Alpha", "Bravo", "win", 1), m("Bravo", "Alpha", "win", 2), m("Alpha", "Bravo", "win", 2), m("Alpha", "Bravo", "tie", null)]);
    expect(t.rows.map((r) => [r.name, r.won, r.lost, r.tied, r.points])).toEqual([["Alpha", 2, 1, 1, 5], ["Bravo", 1, 2, 1, 3]]);
    expect(tallyLine(t)).toBe("Alpha 2 – Bravo 1 (1 tied)");
    expect(t.counted).toBe(4);
  });
  it("a team is found whichever side of the match it was on, by name without capitals or by its permanent team", () => {
    expect(sideIndex(two, { name: " bravo ", teamId: null })).toBe(1);
    expect(sideIndex([{ name: "Alpha", teamId: T1 }, { name: "Bravo", teamId: T2 }], { name: "Renamed Later", teamId: T2 })).toBe(1);
    expect(sideIndex(two, { name: "Zulu", teamId: null })).toBe(-1);
  });
  it("abandoned matches are not counted; matches not finished yet are not counted; no result gives a point each", () => {
    const t = tally(two, [m("Alpha", "Bravo", "win", 1), m("Alpha", "Bravo", null, null, "scheduled"), m("Alpha", "Bravo", "abandoned", null, "abandoned"), m("Alpha", "Bravo", "no_result", null), m("Alpha", "Bravo", null, null, "live")]);
    expect(t).toMatchObject({ counted: 2, abandoned: 1, unfinished: 2, noResult: 1 });
    expect(t.rows.map((r) => r.points)).toEqual([3, 1]);
    expect(tallyLine(t)).toBe("Alpha 1 – Bravo 0 (1 no result)");
  });
  it("a match with a team that is not in the series, or the same team twice, is ignored", () => {
    const t = tally(two, [m("Alpha", "Zulu", "win", 1), m("Alpha", "alpha", "win", 1)]);
    expect(t.counted).toBe(0);
  });
  it("points table: win 2, tie 1, no result 1; ordered by points then wins then name", () => {
    const t = tally(three, [m("Alpha", "Bravo", "win", 1), m("Bravo", "Charlie", "win", 1), m("Charlie", "Alpha", "tie", null), m("Alpha", "Charlie", "win", 1)]);
    expect(pointsTable(t).map((r) => [r.name, r.played, r.points])).toEqual([["Alpha", 3, 5], ["Bravo", 2, 2], ["Charlie", 3, 1]]);
    expect(tallyLine(t)).toBe("Points: Alpha 5 · Bravo 2 · Charlie 1");
    expect(tallyLine(tally(three, []))).toBe("No finished matches yet");
  });
});

describe("the series in words", () => {
  const wins = (a: number, b: number, ties = 0) => tally(two, [
    ...Array.from({ length: a }, () => m("Alpha", "Bravo", "win", 1)), ...Array.from({ length: b }, () => m("Alpha", "Bravo", "win", 2)), ...Array.from({ length: ties }, () => m("Alpha", "Bravo", "tie", null)),
  ]);
  it("open-ended: leads, level, and nothing forced", () => {
    expect(seriesStatus("open", null, false, wins(0, 0)).text).toBe("no finished matches yet");
    expect(seriesStatus("open", null, false, wins(2, 1))).toMatchObject({ text: "Alpha leads 2–1", inProgress: true, winner: null });
    expect(seriesStatus("open", null, false, wins(1, 1))).toMatchObject({ text: "level at 1–1", inProgress: true });
  });
  it("best of 3: the first to 2 has won it, even while the series is open", () => {
    const s = seriesStatus("best_of", 3, false, wins(2, 0));
    expect(s).toMatchObject({ winner: "Alpha", clinched: true, drawn: false });
    expect(s.text).toContain("Alpha won the series 2–0 (best of 3)");
    expect(s.text).toContain("still open");
    expect(seriesStatus("best_of", 3, false, wins(1, 0)).text).toBe("Best of 3: Alpha leads 1–0");
    expect(seriesStatus("best_of", 3, false, wins(1, 1)).clinched).toBe(false);
    expect(seriesStatus("best_of", 3, true, wins(1, 2))).toMatchObject({ winner: "Bravo", clinched: true });
  });
  it("changing best of 3 to best of 5 un-clinches a 2–0 lead", () => {
    expect(seriesStatus("best_of", 3, false, wins(2, 0)).clinched).toBe(true);
    expect(seriesStatus("best_of", 5, false, wins(2, 0))).toMatchObject({ clinched: false, text: "Best of 5: Alpha leads 2–0" });
    expect(seriesStatus("best_of", 5, false, wins(3, 0)).clinched).toBe(true);
    expect(seriesStatus("best_of", 1, false, wins(1, 0)).clinched).toBe(true);
  });
  it("closed: the tally decides; a level series is DRAWN, never forced to a winner", () => {
    expect(seriesStatus("open", null, true, wins(2, 2))).toMatchObject({ drawn: true, winner: null, text: "Drawn 2–2" });
    expect(seriesStatus("open", null, true, wins(1, 1, 2)).text).toBe("Drawn 1–1 (2 tied)");
    expect(seriesStatus("best_of", 5, true, wins(2, 2))).toMatchObject({ drawn: true, winner: null });
    expect(seriesStatus("open", null, true, wins(3, 1))).toMatchObject({ drawn: false, winner: "Alpha", text: "Alpha won 3–1" });
    expect(seriesStatus("open", null, true, wins(0, 0)).text).toBe("Closed with no finished matches");
  });
  it("three or more teams: decided on points when closed, drawn when the top is level", () => {
    const t = tally(three, [m("Alpha", "Bravo", "win", 1), m("Bravo", "Charlie", "win", 1), m("Charlie", "Alpha", "win", 1)]);
    expect(seriesStatus("open", null, true, t)).toMatchObject({ drawn: true, winner: null });          // each has 1 win: level at the top
    const t2 = tally(three, [m("Alpha", "Bravo", "win", 1), m("Alpha", "Charlie", "win", 1)]);
    expect(seriesStatus("open", null, true, t2)).toMatchObject({ winner: "Alpha", text: "Alpha won on points" });
    expect(seriesStatus("open", null, false, t2)).toMatchObject({ inProgress: true, text: "Alpha leads" });
  });
  it("a series with fewer than two teams says it is not set up", () => {
    expect(seriesStatus("open", null, false, tally([{ name: "Alpha", teamId: null }], [])).text).toBe("Not set up yet");
  });
});

describe("which matches can join", () => {
  const side = (name: string) => ({ name, teamId: null });
  it("both sides must be teams of the series", () => {
    expect(sidesFit(two, { side1: side("Alpha"), side2: side("Bravo") })).toEqual({ ok: true });
    expect(sidesFit(two, { side1: side("Alpha"), side2: side("Zulu") })).toEqual({ ok: false, reason: "Zulu is not a team of this series. Add the team to the series first." });
    expect(sidesFit(two, { side1: side("Yak"), side2: side("Zulu") })).toMatchObject({ ok: false, reason: expect.stringContaining("Yak and Zulu are not a team") });
  });
});
