// Phase 8 (series) against the real Neon database with temporary people. Everything created is deleted at the end.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import { chooseNumber, createCommunity, requestToJoin } from "@/lib/community";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { createMatch, getMatch, setLineup } from "@/lib/matches";
import { playerLines } from "@/lib/reports";
import { applyEvents, startSnapshot, takeScoring, type SyncResult } from "@/lib/scoring";
import { addMatches, closeSeries, createSeries, createSeriesFromMatches, deleteSeries, getSeries, listSeries, makeSeriesFromRematch, matchesAvailable, playAnother, removeMatch, reopenSeries, seriesOfMatch, updateSeries } from "@/lib/seriesDb";
import { createTeam } from "@/lib/teams";
import { createRematch } from "@/lib/matches";
import type { SeriesInput } from "@/lib/series";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
const communities: string[] = [];
async function newUser(label: string) {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}
async function newCommunity(label: string, extra = 0) {
  const admin = await newUser(`${label} admin`);
  const id = await createCommunity(admin, { name: `TEST ${label} Club`, description: "", location: "", approvalRequired: false });
  communities.push(id);
  const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!.invite_code;
  await chooseNumber(admin, id, 1);
  const people = [admin];
  for (let i = 0; i < extra; i++) { const u = await newUser(`${label} p${i}`); await requestToJoin(u, code); await chooseNumber(u, id, 10 + i); people.push(u); }
  return { admin, id, people };
}
let cached: ReturnType<typeof newCommunity> | null = null;
const world = () => (cached ??= newCommunity("Series", 5));

const input = (over: Partial<SeriesInput> = {}): SeriesInput => ({
  name: `TEST Series ${randomUUID().slice(0, 6)}`, format: "open", bestOf: null, startsOn: null, endsOn: null, notes: "",
  sides: [{ name: "Alpha", teamId: null }, { name: "Bravo", teamId: null }], ...over,
});

let seq = 0;
const ev = (type: string, payload: Record<string, unknown> = {}) => ({ id: randomUUID(), seq: ++seq, type, payload });
const ball = (p: Record<string, unknown>) => ev("ball", p);

/** A finished match: side 1 bats first and wins 15 to 5. */
async function playMatch(w: { admin: string; id: string; people: string[] }, side1: string, side2: string) {
  seq = 0;
  const m = await createMatch(w.admin, w.id, { sides: [{ teamId: null, name: side1 }, { teamId: null, name: side2 }], scheduledAt: new Date(Date.now() + 3600_000), venue: "", overs: 2, playersPerSide: 3, rules: DEFAULT_RULES, umpire: "", notes: "", warning: null });
  const matchId = m.id!;
  await setLineup(w.admin, w.id, matchId, new Map([[w.people[0]!, 1], [w.people[1]!, 1], [w.people[2]!, 1], [w.people[3]!, 2], [w.people[4]!, 2], [w.people[5]!, 2]]), new Map());
  const scorer = w.people[1]!;
  await takeScoring(scorer, w.id, matchId, "dev");
  const snap = (await startSnapshot(w.id, matchId))!;
  const [p1, p2, p3] = snap.base.players.filter((p) => p.side === 1).map((p) => p.id) as [string, string, string];
  const [q1, q2] = snap.base.players.filter((p) => p.side === 2).map((p) => p.id) as [string, string, string];
  const events = [
    ev("match_start", { ...snap.base, toss: null, battingFirst: 1 }),
    ev("innings_start", { striker: p1, nonStriker: p2, bowler: q1 }),
    ball({ runs: 4 }), ball({ runs: 1 }), ball({ runs: 6 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 2 }),
    ev("bowler", { player: q2 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
    ev("innings_start", { striker: q1, nonStriker: q2, bowler: p3 }),
    ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 0 }),
    ev("bowler", { player: p2 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
    ev("finish"),
  ];
  const r = (await applyEvents(scorer, w.id, matchId, "dev", events)) as SyncResult;
  if (r.rejected.length) throw new Error(`setup refused: ${JSON.stringify(r.rejected)}`);
  return matchId;
}
let playedP: Promise<[string, string, string]> | null = null;
/** Three finished matches between Alpha and Bravo: Alpha, Bravo, Alpha win. */
const played = async () => (playedP ??= (async () => {
  const w = await world();
  return [await playMatch(w, "Alpha", "Bravo"), await playMatch(w, "Bravo", "Alpha"), await playMatch(w, "Alpha", "Bravo")] as [string, string, string];
})());
const quickMatch = async (w: { admin: string; id: string }, a: string, b: string) =>
  (await createMatch(w.admin, w.id, { sides: [{ teamId: null, name: a }, { teamId: null, name: b }], scheduledAt: new Date(Date.now() + 86_400_000), venue: "", overs: 2, playersPerSide: 3, rules: DEFAULT_RULES, umpire: "", notes: "", warning: null })).id!;

describe.skipIf(!run)("Phase 8: series in the real database", () => {
  afterAll(async () => {
    if (communities.length) await query("delete from community where id = any($1::uuid[])", [communities]);
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("any member can create, change (including the format) and close a series; names are unique; strangers cannot", { timeout: 240_000 }, async () => {
    const w = await world();
    const other = await newCommunity("Other");
    const stranger = await newUser("stranger");
    const team = await createTeam(w.admin, w.id, { name: "TEST Alpha Team", description: "", captainId: null, viceCaptainId: null });
    const i = input({ sides: [{ name: "TEST Alpha Team", teamId: team.id! }, { name: "Bravo", teamId: null }], notes: "Weekend", startsOn: "2026-12-01", endsOn: "2026-12-03" });
    const r = await createSeries(w.people[2]!, w.id, i);
    expect(r.outcome).toBe("ok");
    expect((await createSeries(w.admin, w.id, { ...i, name: `  ${i.name.toLowerCase()}  ` })).outcome).toBe("name_taken");
    expect((await createSeries(stranger, w.id, input())).outcome).toBe("forbidden");
    const foreign = await createTeam(other.admin, other.id, { name: "TEST Foreign", description: "", captainId: null, viceCaptainId: null });
    expect((await createSeries(w.admin, w.id, input({ sides: [{ name: "TEST Foreign", teamId: foreign.id! }, { name: "Bravo", teamId: null }] }))).outcome).toBe("bad_team");

    let s = (await getSeries(w.id, r.id!))!;
    expect(s).toMatchObject({ name: i.name, format: "open", best_of: null, starts_on: "2026-12-01", ends_on: "2026-12-03", notes: "Weekend", status: "open", created_by_name: "TEST Series p1", changed_by_name: "TEST Series p1", match_count: 0 });
    expect(s.sides.map((x) => x.name).sort()).toEqual(["Bravo", "TEST Alpha Team"]);
    expect(s.sides.find((x) => x.teamId)).toBeTruthy();
    expect(s.status_view.text).toBe("no finished matches yet");

    // change the format later: open-ended to best of 3, then best of 5
    expect((await updateSeries(w.people[3]!, w.id, r.id!, { ...i, format: "best_of", bestOf: 3 })).outcome).toBe("ok");
    s = (await getSeries(w.id, r.id!))!;
    expect(s).toMatchObject({ format: "best_of", best_of: 3, changed_by_name: "TEST Series p2", created_by_name: "TEST Series p1" });
    expect((await updateSeries(w.admin, w.id, r.id!, { ...i, format: "best_of", bestOf: 5, name: `${i.name} II` })).outcome).toBe("ok");
    expect((await getSeries(w.id, r.id!))!).toMatchObject({ best_of: 5, name: `${i.name} II` });
    expect((await updateSeries(w.admin, w.id, randomUUID(), i)).outcome).toBe("not_found");
    expect((await updateSeries(stranger, w.id, r.id!, i)).outcome).toBe("forbidden");
    const other2 = await createSeries(w.admin, w.id, input());
    expect((await updateSeries(w.admin, w.id, other2.id!, { ...i, name: `${i.name} II` })).outcome).toBe("name_taken");   // cannot take another series' name
  });

  it("close and reopen, with the record kept; deleting a series keeps its matches", { timeout: 240_000 }, async () => {
    const w = await world();
    const [m1, m2, m3] = await played();
    const r = await createSeriesFromMatches(w.admin, w.id, "TEST Close Series", [m1, m2, m3]);
    expect(r).toMatchObject({ outcome: "ok" });
    expect((await closeSeries(w.people[1]!, w.id, r.id!))).toBe("ok");
    expect((await closeSeries(w.admin, w.id, r.id!))).toBe("bad_state");
    let s = (await getSeries(w.id, r.id!))!;
    expect(s.status).toBe("closed");
    expect(s.status_view).toMatchObject({ winner: "Alpha", text: "Alpha won 2–1" });
    expect(s.matches).toHaveLength(3);                                    // a closed series keeps its record
    expect((await addMatches(w.admin, w.id, r.id!, [await quickMatch(w, "Alpha", "Bravo")])).outcome).toBe("bad_state");   // closed: reopen first
    expect((await playAnother(w.admin, w.id, r.id!, new Date(Date.now() + 86_400_000))).outcome).toBe("bad_state");
    expect(await reopenSeries(w.admin, w.id, r.id!)).toBe("ok");
    expect(await reopenSeries(w.admin, w.id, r.id!)).toBe("bad_state");
    s = (await getSeries(w.id, r.id!))!;
    expect(s.status_view.text).toBe("Alpha leads 2–1");
    expect(await deleteSeries(await newUser("stranger"), w.id, r.id!)).toBe("forbidden");
    expect(await deleteSeries(w.admin, w.id, r.id!)).toBe("ok");
    expect(await getSeries(w.id, r.id!)).toBeNull();
    for (const m of [m1, m2, m3]) expect(await getMatch(w.id, m, w.admin)).not.toBeNull();       // matches are kept
    expect(await seriesOfMatch(w.id, m1)).toBeNull();
    expect(await deleteSeries(w.admin, w.id, r.id!)).toBe("not_found");
  });

  it("group matches already played, the tally, one series per match, wrong community and wrong teams refused, remove keeps the match", { timeout: 300_000 }, async () => {
    const w = await world();
    const other = await newCommunity("Elsewhere");
    const [m1, m2, m3] = await played();
    const r = await createSeriesFromMatches(w.people[2]!, w.id, null, [m1, m2, m3]);
    expect(r.outcome).toBe("ok");
    let s = (await getSeries(w.id, r.id!))!;
    expect(s.name).toMatch(/^Alpha v Bravo|^Bravo v Alpha/);              // an automatic name from the teams
    expect(s.sides.map((x) => x.name).sort()).toEqual(["Alpha", "Bravo"]);
    expect(s.tally.rows.map((x) => [x.name, x.won, x.lost, x.points]).sort()).toEqual([["Alpha", 2, 1, 4], ["Bravo", 1, 2, 2]]);
    expect(s.status_view).toMatchObject({ text: "Alpha leads 2–1", inProgress: true });
    expect(s.created_by_name).toBe("TEST Series p1");
    expect(await seriesOfMatch(w.id, m1)).toMatchObject({ id: r.id, status: "open" });

    // one series per match
    expect((await createSeriesFromMatches(w.admin, w.id, "TEST Another", [m1])).outcome).toBe("in_other_series");
    const second = await createSeries(w.admin, w.id, input());
    expect((await addMatches(w.admin, w.id, second.id!, [m2])).outcome).toBe("in_other_series");
    expect(await query("select 1 from series where name = 'TEST Another'")).toHaveLength(0);         // nothing half-made
    // a match from another community, and one with a team that is not in the series
    const foreign = await quickMatch(other, "Alpha", "Bravo");
    expect((await addMatches(w.admin, w.id, second.id!, [foreign])).outcome).toBe("bad_match");
    const zulu = await quickMatch(w, "Alpha", "Zulu");
    const z = await addMatches(w.admin, w.id, second.id!, [zulu]);
    expect(z).toMatchObject({ outcome: "sides", reason: expect.stringContaining("Zulu is not a team of this series") });
    expect((await addMatches(w.admin, w.id, second.id!, [])).outcome).toBe("bad_match");
    expect((await addMatches(await newUser("stranger"), w.id, second.id!, [zulu])).outcome).toBe("forbidden");
    // a team of the series that already has matches cannot be taken out; a new team can be added
    const withoutBravo = { name: s.name, format: "open" as const, bestOf: null, startsOn: null, endsOn: null, notes: "", sides: [{ name: "Alpha", teamId: null }, { name: "Charlie", teamId: null }] };
    expect(await updateSeries(w.admin, w.id, r.id!, withoutBravo)).toMatchObject({ outcome: "side_in_use", reason: expect.stringContaining("Bravo") });
    expect((await updateSeries(w.admin, w.id, r.id!, { ...withoutBravo, sides: [{ name: "Alpha", teamId: null }, { name: "Bravo", teamId: null }, { name: "Charlie", teamId: null }] })).outcome).toBe("ok");
    expect((await addMatches(w.admin, w.id, r.id!, [zulu])).outcome).toBe("sides");
    // what could be added: the ones that fit, with a reason for the ones that do not
    const avail = await matchesAvailable(w.id, r.id!);
    expect(avail.find((x) => x.id === zulu)).toMatchObject({ fits: false, reason: expect.stringContaining("Zulu") });
    expect(avail.some((x) => x.id === m1)).toBe(false);                    // already in a series
    // best of: the format changes the words, never the record
    expect((await updateSeries(w.admin, w.id, r.id!, { ...withoutBravo, sides: [{ name: "Alpha", teamId: null }, { name: "Bravo", teamId: null }, { name: "Charlie", teamId: null }], format: "best_of", bestOf: 3 })).outcome).toBe("ok");
    s = (await getSeries(w.id, r.id!))!;
    expect(s.tally.rows.find((x) => x.name === "Alpha")!.won).toBe(2);
    // remove keeps the match
    expect(await removeMatch(w.admin, w.id, r.id!, m3)).toBe("ok");
    expect(await removeMatch(w.admin, w.id, r.id!, m3)).toBe("not_in_series");
    expect(await getMatch(w.id, m3, w.admin)).not.toBeNull();
    expect((await getSeries(w.id, r.id!))!.matches).toHaveLength(2);
    expect((await addMatches(w.admin, w.id, second.id!, [m3])).outcome).toBe("ok");          // free again, joins another series
    // clean up for later tests
    await deleteSeries(w.admin, w.id, r.id!); await deleteSeries(w.admin, w.id, second.id!);
    expect((await listSeries(w.id)).filter((x) => x.name === s.name)).toHaveLength(0);
  });

  it("a drawn series stays drawn; best of 3 is clinched by 2 wins and unclinched by changing to best of 5", { timeout: 300_000 }, async () => {
    const w = await world();
    const [m1, m2, m3] = await played();
    const r = await createSeriesFromMatches(w.admin, w.id, "TEST Drawn Series", [m1, m2]);            // Alpha 1, Bravo 1
    expect((await getSeries(w.id, r.id!))!.status_view).toMatchObject({ text: "level at 1–1", drawn: false });
    await closeSeries(w.admin, w.id, r.id!);
    expect((await getSeries(w.id, r.id!))!.status_view).toMatchObject({ drawn: true, winner: null, text: "Drawn 1–1" });   // no tie-break, no manual winner
    await reopenSeries(w.admin, w.id, r.id!);
    const full = (await getSeries(w.id, r.id!))!;
    const base = { name: full.name, startsOn: null, endsOn: null, notes: "", sides: full.sides.map((s) => ({ name: s.name, teamId: s.teamId })) };
    expect((await addMatches(w.admin, w.id, r.id!, [m3])).outcome).toBe("ok");
    await updateSeries(w.admin, w.id, r.id!, { ...base, format: "best_of", bestOf: 3 });
    expect((await getSeries(w.id, r.id!))!.status_view).toMatchObject({ winner: "Alpha", clinched: true });
    await updateSeries(w.admin, w.id, r.id!, { ...base, format: "best_of", bestOf: 5 });
    expect((await getSeries(w.id, r.id!))!.status_view).toMatchObject({ clinched: false, text: "Best of 5: Alpha leads 2–1" });
    await deleteSeries(w.admin, w.id, r.id!);
  });

  it("Play another match in this series, and Make this a series from a rematch", { timeout: 300_000 }, async () => {
    const w = await world();
    const [m1, m2] = await played();
    const empty = await createSeries(w.admin, w.id, input());
    expect((await playAnother(w.admin, w.id, empty.id!, new Date(Date.now() + 86_400_000))).outcome).toBe("bad_match");   // needs a match to copy
    const s = await createSeriesFromMatches(w.admin, w.id, "TEST Play On", [m1]);
    const next = await playAnother(w.people[2]!, w.id, s.id!, new Date(Date.now() + 2 * 86_400_000));
    expect(next.outcome).toBe("ok");
    const got = (await getSeries(w.id, s.id!))!;
    expect(got.matches).toHaveLength(2);
    const nm = (await getMatch(w.id, next.id!, w.admin))!;
    expect(nm).toMatchObject({ status: "scheduled", rematch_of: m1, side1_name: "Alpha", side2_name: "Bravo", created_by_name: "TEST Series p1" });
    expect((await seriesOfMatch(w.id, next.id!))!.id).toBe(s.id);
    expect(got.tally.counted).toBe(1);                                    // the new match is not finished, so it is not counted yet
    expect(got.status_view.text).toBe("Alpha leads 1–0");
    // "Make this a series" on a rematch of a match that is not in a series
    const re = await createRematch(w.admin, w.id, m2, new Date(Date.now() + 3 * 86_400_000));
    const made = await makeSeriesFromRematch(w.admin, w.id, m2, re.id!);
    expect(made.outcome).toBe("ok");
    const ms = (await getSeries(w.id, made.id!))!;
    expect(ms.matches.map((x) => x.id).sort()).toEqual([m2, re.id!].sort());
    expect(ms.name).toMatch(/^(Alpha v Bravo|Bravo v Alpha)( \(\d+\))?$/);
    // and the name stays free of clashes when it is made again from other matches
    const re2 = await createRematch(w.admin, w.id, re.id!, new Date(Date.now() + 4 * 86_400_000));
    expect((await makeSeriesFromRematch(w.admin, w.id, re.id!, re2.id!)).outcome).toBe("in_other_series");   // the first rematch is already in the new series
    await deleteSeries(w.admin, w.id, s.id!); await deleteSeries(w.admin, w.id, empty.id!); await deleteSeries(w.admin, w.id, made.id!);
  });

  it("being in a series does not change anyone's stats; the series filter shows only that series' matches", { timeout: 300_000 }, async () => {
    const w = await world();
    const [m1, m2, m3] = await played();
    const p = (await query<{ user_id: string }>("select user_id from match_player where match_id = $1 and user_id is not null limit 1", [m1]))[0]!.user_id;
    const before = await playerLines(w.id, p);
    expect(before.length).toBeGreaterThanOrEqual(1);
    const r = await createSeriesFromMatches(w.admin, w.id, "TEST Stats Series", [m1, m2]);
    const after = await playerLines(w.id, p);
    expect(after.map((l) => [l.matchId, l.bat, l.bowl, l.points])).toEqual(before.map((l) => [l.matchId, l.bat, l.bowl, l.points]));   // identical
    const inSeries = await playerLines(w.id, p, { seriesId: r.id! });
    expect(inSeries.every((l) => [m1, m2].includes(l.matchId))).toBe(true);
    expect(inSeries.length).toBeLessThanOrEqual(before.length);
    expect(inSeries.some((l) => l.matchId === m3)).toBe(false);
    const none = await createSeries(w.admin, w.id, input());
    expect(await playerLines(w.id, p, { seriesId: none.id! })).toEqual([]);                  // an empty series has no lines
    expect(await playerLines(w.id, p, { seriesId: "not-an-id" })).toHaveLength(before.length);   // a bad filter value is ignored, not an error
    const { communityCareers } = await import("@/lib/reports");
    const all = await communityCareers(w.id);
    const filtered = await communityCareers(w.id, { seriesId: r.id! });
    const total = (m: Map<string, { batting: { runs: number } }>) => Array.from(m.values()).reduce((a, c) => a + c.batting.runs, 0);
    expect(total(filtered)).toBeLessThan(total(all));                                         // m3 is outside the series
    expect(total(await communityCareers(w.id, { seriesId: none.id! }))).toBe(0);
    await deleteSeries(w.admin, w.id, r.id!); await deleteSeries(w.admin, w.id, none.id!);
  });

  it("the list of series, newest open first, with status in words", { timeout: 240_000 }, async () => {
    const w = await world();
    const a = await createSeries(w.admin, w.id, input({ name: "TEST List A" }));
    const b = await createSeries(w.admin, w.id, input({ name: "TEST List B" }));
    await closeSeries(w.admin, w.id, a.id!);
    const list = await listSeries(w.id);
    const ia = list.findIndex((x) => x.id === a.id), ib = list.findIndex((x) => x.id === b.id);
    expect(ib).toBeLessThan(ia);                                           // open before closed
    expect(list[ia]!.status_view.text).toBe("Closed with no finished matches");
    await deleteSeries(w.admin, w.id, a.id!); await deleteSeries(w.admin, w.id, b.id!);
  });

  it("deleting the community removes its series, teams of the series and links, even with a permanent team in it", { timeout: 240_000 }, async () => {
    const c = await newCommunity("Cascade");
    const team = await createTeam(c.admin, c.id, { name: "TEST Cascade Team", description: "", captainId: null, viceCaptainId: null });
    const m = await quickMatch(c, "TEST Cascade Team", "Bravo");
    const r = await createSeries(c.admin, c.id, input({ sides: [{ name: "TEST Cascade Team", teamId: team.id! }, { name: "Bravo", teamId: null }] }));
    expect((await addMatches(c.admin, c.id, r.id!, [m])).outcome).toBe("ok");
    await query("delete from community where id = $1", [c.id]);
    expect(await query("select 1 from series where id = $1", [r.id!])).toHaveLength(0);
    expect(await query("select 1 from series_side where series_id = $1", [r.id!])).toHaveLength(0);
    expect(await query("select 1 from series_match where series_id = $1", [r.id!])).toHaveLength(0);
  });

  it("the database refuses what the app should never send", { timeout: 240_000 }, async () => {
    const w = await world();
    const r = await createSeries(w.admin, w.id, input());
    const id = r.id!;
    await expect(query("update series set best_of = 3 where id = $1", [id])).rejects.toThrow();                 // best of needs the best-of format
    await expect(query("update series set format = 'best_of' where id = $1", [id])).rejects.toThrow();          // and the format needs a number
    await expect(query("update series set format = 'best_of', best_of = 22 where id = $1", [id])).rejects.toThrow();
    await expect(query("update series set format = 'best_of', best_of = 0 where id = $1", [id])).rejects.toThrow();
    await expect(query("update series set starts_on = '2026-12-05', ends_on = '2026-12-01' where id = $1", [id])).rejects.toThrow();
    await expect(query("update series set status = 'paused' where id = $1", [id])).rejects.toThrow();
    await expect(query("update series set name = 'x' where id = $1", [id])).rejects.toThrow();
    await expect(query("update series set notes = $2 where id = $1", [id, "n".repeat(301)])).rejects.toThrow();
    await expect(query("insert into series_side (series_id, name) values ($1, 'alpha')", [id])).rejects.toThrow();     // same name as Alpha
    await expect(query("insert into series_side (series_id, name) values ($1, 'x')", [id])).rejects.toThrow();
    const m = await quickMatch(w, "Alpha", "Bravo");
    await query("insert into series_match (match_id, series_id, added_by) values ($1, $2, $3)", [m, id, w.admin]);
    const r2 = await createSeries(w.admin, w.id, input());
    await expect(query("insert into series_match (match_id, series_id, added_by) values ($1, $2, $3)", [m, r2.id!, w.admin])).rejects.toThrow();   // one series per match
    await deleteSeries(w.admin, w.id, id); await deleteSeries(w.admin, w.id, r2.id!);
  });
});
