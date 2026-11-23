// Phase 6 (statistics, corrections, leaderboards data, team records) against the real Neon database with temporary people.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import { chooseNumber, createCommunity, requestToJoin } from "@/lib/community";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { createMatch, setLineup } from "@/lib/matches";
import { communityCareers, correctBall, matchByShareToken, playerLines, setShare, shareTokenOf, teamContributors, teamRecord, teamTable } from "@/lib/reports";
import { applyEvents, loadEvents, startSnapshot, takeScoring, type SyncResult } from "@/lib/scoring";
import { createTeam } from "@/lib/teams";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
const communities: string[] = [];
async function newUser(label: string) {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}

let seq = 0;
const ev = (type: string, payload: Record<string, unknown> = {}) => ({ id: randomUUID(), seq: ++seq, type, payload });
const ball = (p: Record<string, unknown>) => ev("ball", p);

/** Alpha 15 in 2 overs; Bravo 5. Alpha wins by 10. */
async function playedMatch(opts: { finish?: boolean; teamId?: string } = {}) {
  seq = 0;
  const admin = await newUser("admin");
  const id = await createCommunity(admin, { name: "TEST Stats Club", description: "", location: "", approvalRequired: false });
  communities.push(id);
  const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!.invite_code;
  await chooseNumber(admin, id, 1);
  const people = [admin];
  for (let i = 0; i < 5; i++) {
    const u = await newUser(`p${i}`);
    await requestToJoin(u, code); await chooseNumber(u, id, 10 + i); people.push(u);
  }
  let teamId = opts.teamId;
  if (opts.teamId === "make") teamId = (await createTeam(admin, id, { name: "TEST Alpha", description: "", captainId: null, viceCaptainId: null })).id!;
  const m = await createMatch(admin, id, {
    sides: [{ teamId: teamId ?? null, name: teamId ? "TEST Alpha" : "Alpha" }, { teamId: null, name: "Bravo" }], scheduledAt: new Date(Date.now() + 3600_000), venue: "", overs: 2, playersPerSide: 3,
    rules: DEFAULT_RULES, umpire: "", notes: "", warning: null,
  });
  const matchId = m.id!;
  await setLineup(admin, id, matchId, new Map([[people[0]!, 1], [people[1]!, 1], [people[2]!, 1], [people[3]!, 2], [people[4]!, 2], [people[5]!, 2]]), new Map());
  const scorer = people[1]!;
  await takeScoring(scorer, id, matchId, "dev");
  const snap = (await startSnapshot(id, matchId))!;
  const [p1, p2, p3] = snap.base.players.filter((p) => p.side === 1).map((p) => p.id) as [string, string, string];
  const [q1, q2] = snap.base.players.filter((p) => p.side === 2).map((p) => p.id) as [string, string, string];
  const events = [
    ev("match_start", { ...snap.base, toss: null, battingFirst: 1 }),
    ev("innings_start", { striker: p1, nonStriker: p2, bowler: q1 }),
    ball({ runs: 4, extra: null }), ball({ runs: 1 }), ball({ runs: 6 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 2 }),
    ev("bowler", { player: q2 }),
    ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
    ev("innings_start", { striker: q1, nonStriker: q2, bowler: p3 }),
    ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 0 }),
    ev("bowler", { player: p2 }),
    ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
  ];
  if (opts.finish !== false) events.push(ev("finish"));
  const r = (await applyEvents(scorer, id, matchId, "dev", events)) as SyncResult;
  if (r.rejected.length) throw new Error(`setup refused: ${JSON.stringify(r.rejected)}`);
  const p1User = (await query<{ user_id: string }>("select user_id from match_player where id = $1", [p1]))[0]!.user_id;
  return { admin, people, id, matchId, p1, q1, teamId, scorer, p1User };
}

describe.skipIf(!run)("Phase 6: finished matches, figures and corrections in the real database", () => {
  afterAll(async () => {
    if (communities.length) await query("delete from community where id = any($1::uuid[])", [communities]);
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("finishing a match writes every player's figures, the result and the scores", async () => {
    const w = await playedMatch();
    const m = (await query<{ status: string; result: { text: string }; scores: { runs: number }[] }>("select status, result, scores from cricket_match where id = $1", [w.matchId]))[0]!;
    expect(m.status).toBe("completed");
    expect(m.result.text).toBe("Alpha won by 10 runs");
    expect(m.scores.map((s) => s.runs)).toEqual([15, 5]);
    const rows = await query<{ pom: boolean; points: number }>("select pom, points from match_stat where match_id = $1", [w.matchId]);
    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => r.pom).length).toBeGreaterThanOrEqual(1);
    const lines = await playerLines(w.id, w.p1User);
    expect(lines).toHaveLength(1);
    expect(lines[0]!).toMatchObject({ result: "win", teamName: "Alpha", opponent: "Bravo" });
    expect(lines[0]!.bat[0]).toMatchObject({ runs: 6, fours: 1 });      // the four, and the runs that came with the strike
  });

  it("a person who was not in the lineup gets nothing; abandoned and unfinished matches are not counted", { timeout: 240_000 }, async () => {
    const w = await playedMatch();
    const outsider = await newUser("outsider");
    expect(await playerLines(w.id, outsider)).toEqual([]);
    const live = await playedMatch({ finish: false });
    expect(await query("select 1 from match_stat where match_id = $1", [live.matchId])).toHaveLength(0);
    expect(await playerLines(live.id, live.p1User)).toEqual([]);
    // abandon a fresh one
    seq = 0;
    const a = await playedMatch({ finish: false });
    seq = (await loadEvents(a.matchId)).length;
    const r = (await applyEvents(a.scorer, a.id, a.matchId, "dev", [ev("match_end", { kind: "abandoned" })])) as SyncResult;
    expect(r.rejected).toEqual([]);
    expect(await query("select 1 from match_stat where match_id = $1", [a.matchId])).toHaveLength(0);
    expect(await playerLines(a.id, a.p1User)).toEqual([]);
  });

  it("the community's careers list every member who played, and the figures agree with the match", async () => {
    const w = await playedMatch();
    const careers = await communityCareers(w.id);
    expect(careers.size).toBe(6);
    const total = Array.from(careers.values()).reduce((a, c) => a + c.batting.runs, 0);
    expect(total).toBe(15 + 5);
    expect(Array.from(careers.values()).reduce((a, c) => a + c.bowling.balls, 0)).toBe(24);   // 4 overs of six balls
    expect(Array.from(careers.values()).filter((c) => c.awards.count > 0).length).toBeGreaterThanOrEqual(1);
  });

  it("any member can correct a ball of a finished match; everything is worked out again and their name is on it", async () => {
    const w = await playedMatch();
    const events = await loadEvents(w.matchId);
    const first = events.find((e) => e.type === "ball")!;       // the first ball: 4 runs
    const before = (await playerLines(w.id, w.p1User))[0]!.bat[0]!.runs;
    const res = await correctBall(w.people[3]!, w.id, w.matchId, first.id, { runs: 6 }, "scorer mis-tapped");
    expect(res).toEqual({ outcome: "ok" });
    const after = (await playerLines(w.id, w.p1User))[0]!.bat[0]!.runs;
    expect(after).toBe(before + 2);
    const m = (await query<{ result: { text: string }; scores: { runs: number }[] }>("select result, scores from cricket_match where id = $1", [w.matchId]))[0]!;
    expect(m.scores.map((s) => s.runs)).toEqual([17, 5]);
    expect(m.result.text).toBe("Alpha won by 12 runs");
    const log = (await loadEvents(w.matchId)).at(-1)!;
    expect(log).toMatchObject({ type: "edit", by: "TEST p2", reason: "scorer mis-tapped" });
    expect(await query("select 1 from audit_log where community_id = $1 and action = 'match_corrected'", [w.id])).toHaveLength(1);
    // the log only grows: the original ball is still there
    expect((await loadEvents(w.matchId)).filter((e) => e.type === "ball")).toHaveLength(24);
  });

  it("a correction that would break the balls after it is refused and changes nothing; strangers and unfinished matches cannot correct", { timeout: 240_000 }, async () => {
    const w = await playedMatch();
    const events = await loadEvents(w.matchId);
    const bravoFirst = events.filter((e) => e.type === "ball")[12]!;           // Bravo's first ball
    const bad = await correctBall(w.people[1]!, w.id, w.matchId, bravoFirst.id, { runs: 12 }, "");   // 12 + 4 more would pass the target mid-innings
    expect(bad.outcome).toBe("refused");
    expect(bad.error).toBeTruthy();
    expect((await loadEvents(w.matchId)).length).toBe(events.length);
    const stranger = await newUser("stranger");
    expect((await correctBall(stranger, w.id, w.matchId, bravoFirst.id, { runs: 1 }, "")).outcome).toBe("forbidden");
    expect((await correctBall(w.people[1]!, w.id, w.matchId, randomUUID(), { runs: 1 }, "")).outcome).toBe("refused");
    expect((await correctBall(w.people[1]!, w.id, w.matchId, bravoFirst.id, { runs: 99 }, "")).outcome).toBe("bad_input");
    expect((await correctBall(w.people[1]!, w.id, w.matchId, bravoFirst.id, {}, "")).outcome).toBe("bad_input");
    const live = await playedMatch({ finish: false });
    const liveFirst = (await loadEvents(live.matchId)).find((e) => e.type === "ball")!;
    expect((await correctBall(live.people[1]!, live.id, live.matchId, liveFirst.id, { runs: 1 }, "")).outcome).toBe("not_finished");
  });

  it("a public link can be made for a finished match only, by a member, opens by code, and stops when switched off", { timeout: 240_000 }, async () => {
    const live = await playedMatch({ finish: false });
    expect((await setShare(live.people[1]!, live.id, live.matchId, true)).outcome).toBe("not_finished");
    const w = await playedMatch();
    expect(await matchByShareToken("not-a-real-code-at-all-0000")).toBeNull();
    expect((await setShare(await newUser("stranger"), w.id, w.matchId, true)).outcome).toBe("forbidden");
    expect(await shareTokenOf(w.id, w.matchId)).toBeNull();
    const on = await setShare(w.people[2]!, w.id, w.matchId, true);
    expect(on.outcome).toBe("ok");
    expect(on.token).toMatch(/^[A-Za-z0-9_-]{20,40}$/);
    const found = await matchByShareToken(on.token!);
    expect(found).toMatchObject({ id: w.matchId, side1: "Alpha", side2: "Bravo", community_id: w.id });
    expect((await setShare(w.people[2]!, w.id, w.matchId, true)).token).toBe(on.token);      // switching on again keeps the same link
    expect((await setShare(w.people[2]!, w.id, w.matchId, false)).outcome).toBe("ok");
    expect(await matchByShareToken(on.token!)).toBeNull();                                    // the old link stops working
    const again = await setShare(w.people[2]!, w.id, w.matchId, true);
    expect(again.token).not.toBe(on.token);                                                   // a new code, so the old one stays dead
  });

  it("a team's record, head to head and contributors come from finished matches", async () => {
    const w = await playedMatch({ teamId: "make" });
    const rec = await teamRecord(w.id, w.teamId!);
    expect(rec).toMatchObject({ played: 1, won: 1, lost: 0, tied: 0, winPercent: 100, totalRuns: 15, highest: 15, lowest: 15 });
    expect(rec.headToHead).toEqual([{ opponent: "Bravo", played: 1, won: 1, lost: 0, tied: 0 }]);
    expect(rec.recent[0]).toMatchObject({ opponent: "Bravo", result: "win", runsFor: 15, runsAgainst: 5 });
    const table = await teamTable(w.id, [{ id: w.teamId!, name: "TEST Alpha" }]);
    expect(table[0]).toMatchObject({ name: "TEST Alpha", won: 1 });
    const who = await teamContributors(w.id, w.teamId!);
    expect(who.reduce((a, x) => a + x.runs, 0)).toBe(15);
  });

  it("linking a guest to a member moves that guest's figures to the member's career, and undoing the link takes them away", async () => {
    // a match with a guest in it (added before the start), played and finished
    seq = 0;
    const admin = await newUser("admin");
    const id = await createCommunity(admin, { name: "TEST Link Club", description: "", location: "", approvalRequired: false });
    communities.push(id);
    const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!.invite_code;
    await chooseNumber(admin, id, 1);
    const people = [admin];
    for (let i = 0; i < 3; i++) { const u = await newUser(`p${i}`); await requestToJoin(u, code); await chooseNumber(u, id, 10 + i); people.push(u); }
    const m = await createMatch(admin, id, { sides: [{ teamId: null, name: "Alpha" }, { teamId: null, name: "Bravo" }], scheduledAt: new Date(Date.now() + 3600_000), venue: "", overs: 1, playersPerSide: 2, rules: DEFAULT_RULES, umpire: "", notes: "", warning: null });
    await setLineup(admin, id, m.id!, new Map([[people[0]!, 1], [people[2]!, 2], [people[3]!, 2]]), new Map());
    const { addGuest, linkGuest, unlinkGuest, listLineup } = await import("@/lib/matches");
    await addGuest(admin, id, m.id!, 1, "Sami Guest");
    await takeScoring(people[1]!, id, m.id!, "dev");
    const snap = (await startSnapshot(id, m.id!))!;
    const a = snap.base.players.filter((p) => p.side === 1), b = snap.base.players.filter((p) => p.side === 2);
    const guest = a.find((p) => p.kind === "guest")!;
    const other = a.find((p) => p.id !== guest.id)!;
    const r = (await applyEvents(people[1]!, id, m.id!, "dev", [
      ev("match_start", { ...snap.base, toss: null, battingFirst: 1 }),
      ev("innings_start", { striker: guest.id, nonStriker: other.id, bowler: b[0]!.id }),
      ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      ev("innings_start", { striker: b[0]!.id, nonStriker: b[1]!.id, bowler: other.id }),
      ball({ runs: 1 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      ev("finish"),
    ])) as SyncResult;
    expect(r.rejected).toEqual([]);
    const sami = people[1]!;                                         // a real member who was that guest
    expect(await playerLines(id, sami)).toEqual([]);                  // not linked yet: no career
    const entry = (await listLineup(id, m.id!)).find((l) => l.kind === "guest")!;
    expect(await linkGuest(admin, id, m.id!, entry.id, sami)).toBe("ok");
    const linked = await playerLines(id, sami);
    expect(linked).toHaveLength(1);
    expect(linked[0]!.bat[0]!.runs).toBe(12);
    expect(linked[0]!.numberUsed).toBeNull();                         // no number for that match
    expect(await unlinkGuest(admin, id, m.id!, entry.id)).toBe("ok");
    expect(await playerLines(id, sami)).toEqual([]);
  });
});
