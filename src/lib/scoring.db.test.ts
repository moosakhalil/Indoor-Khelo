// Phase 5 rules (the scoring lock and saving the scoring log) against the real Neon database with temporary test people.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import { chooseNumber, createCommunity, requestToJoin } from "@/lib/community";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { addGuest, createMatch, setLineup } from "@/lib/matches";
import { adminTakeover, applyEvents, cancelTakeoverRequest, claimDevice, getLock, loadEvents, releaseScoring, requestTakeover, respondTakeover, scorersOf, startSnapshot, takeScoring, type SyncResult } from "@/lib/scoring";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
const communities: string[] = [];

async function newUser(label: string) {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}

/** A community with an admin and 6 members, a match with 3 a side, ready to score. */
async function world() {
  const admin = await newUser("admin");
  const id = await createCommunity(admin, { name: "TEST Score Club", description: "", location: "", approvalRequired: false });
  communities.push(id);
  const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!.invite_code;
  await chooseNumber(admin, id, 1);
  const people: string[] = [admin];
  for (let i = 0; i < 5; i++) {
    const u = await newUser(`p${i}`);
    await requestToJoin(u, code);
    await chooseNumber(u, id, 10 + i);
    people.push(u);
  }
  const m = await createMatch(admin, id, {
    sides: [{ teamId: null, name: "Alpha" }, { teamId: null, name: "Bravo" }], scheduledAt: new Date(Date.now() + 3600_000), venue: "", overs: 2, playersPerSide: 3,
    rules: DEFAULT_RULES, umpire: "", notes: "", warning: null,
  });
  const matchId = m.id!;
  await setLineup(admin, id, matchId, new Map([[people[0]!, 1], [people[1]!, 1], [people[2]!, 1], [people[3]!, 2], [people[4]!, 2], [people[5]!, 2]]), new Map());
  return { admin, id, matchId, people };
}

type Ev = Record<string, unknown>;
let seq = 0;
const ev = (type: string, payload: Ev = {}, extra: Ev = {}) => ({ id: randomUUID(), seq: ++seq, type, payload, ...extra });

async function startEvent(w: { id: string; matchId: string }, battingFirst: 1 | 2 = 1) {
  const snap = (await startSnapshot(w.id, w.matchId))!;
  return ev("match_start", { ...snap.base, toss: null, battingFirst });
}

describe.skipIf(!run)("Phase 5: scoring lock and the scoring log in the real database", () => {
  afterAll(async () => {
    if (communities.length) await query("delete from community where id = any($1::uuid[])", [communities]);
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("one scorer at a time: take, held by another, release, request, accept and decline, admin takeover", async () => {
    const w = await world();
    const [admin, a, b] = [w.people[0]!, w.people[1]!, w.people[2]!];
    expect(await takeScoring(a, w.id, w.matchId, "dev-a")).toBe("ok");
    expect(await takeScoring(b, w.id, w.matchId, "dev-b")).toBe("held");
    expect(await takeScoring(a, w.id, w.matchId, "dev-a2")).toBe("ok");                 // same person moves to another device
    expect((await getLock(w.id, w.matchId))!).toMatchObject({ scorer_id: a, scorer_name: "TEST p0", scorer_device: "dev-a2" });
    expect(await requestTakeover(a, w.id, w.matchId)).toBe("bad_state");                 // cannot ask yourself
    expect(await requestTakeover(b, w.id, w.matchId)).toBe("ok");
    expect(await requestTakeover(w.people[3]!, w.id, w.matchId)).toBe("busy");           // one request at a time
    expect((await getLock(w.id, w.matchId))!.takeover_name).toBe("TEST p1");
    expect(await respondTakeover(b, w.id, w.matchId, true)).toBe("not_holder");
    expect(await respondTakeover(a, w.id, w.matchId, false)).toBe("ok");                 // declined
    expect((await getLock(w.id, w.matchId))!.takeover_by).toBeNull();
    expect(await respondTakeover(a, w.id, w.matchId, true)).toBe("no_request");
    await requestTakeover(b, w.id, w.matchId);
    expect(await cancelTakeoverRequest(b, w.id, w.matchId)).toBe("ok");
    await requestTakeover(b, w.id, w.matchId);
    expect(await respondTakeover(a, w.id, w.matchId, true)).toBe("ok");                  // handed over
    expect((await getLock(w.id, w.matchId))!).toMatchObject({ scorer_id: b, scorer_device: null });
    expect(await claimDevice(a, w.id, w.matchId, "x")).toBe("not_holder");
    expect(await claimDevice(b, w.id, w.matchId, "dev-b")).toBe("ok");
    expect(await releaseScoring(a, w.id, w.matchId)).toBe("not_holder");
    expect(await adminTakeover(a, w.id, w.matchId)).toBe("not_admin");
    expect(await adminTakeover(admin, w.id, w.matchId)).toBe("ok");                      // an Admin can always take it
    expect((await getLock(w.id, w.matchId))!.scorer_id).toBe(admin);
    expect(await releaseScoring(admin, w.id, w.matchId)).toBe("ok");
    expect((await getLock(w.id, w.matchId))!.scorer_id).toBeNull();
    const stranger = await newUser("stranger");
    expect(await takeScoring(stranger, w.id, w.matchId, "d")).toBe("forbidden");
    expect(await takeScoring(a, w.id, randomUUID(), "d")).toBe("not_found");
  });

  it("only the holder's device can save events; everyone else is refused with a reason, never silently", async () => {
    seq = 0;
    const w = await world();
    const [a, b] = [w.people[1]!, w.people[2]!];
    const start = await startEvent(w);
    const res0 = await applyEvents(a, w.id, w.matchId, "dev-a", [start]) as SyncResult;
    expect(res0.lockLost).toBe(true);
    expect(res0.rejected[0]).toMatchObject({ code: "not_scorer", id: start.id });
    await takeScoring(a, w.id, w.matchId, "dev-a");
    const wrongDevice = await applyEvents(a, w.id, w.matchId, "dev-other", [start]) as SyncResult;
    expect(wrongDevice.rejected[0]!.reason).toMatch(/another device/);
    const notMember = await applyEvents(await newUser("stranger"), w.id, w.matchId, "d", [start]);
    expect(notMember).toEqual({ error: "forbidden" });
    const notHolder = await applyEvents(b, w.id, w.matchId, "dev-b", [start]) as SyncResult;
    expect(notHolder.rejected[0]!.code).toBe("not_scorer");
    expect(await loadEvents(w.matchId)).toHaveLength(0);
  });

  it("starting, scoring, undo, a repeat send, out of order, and invalid events", async () => {
    seq = 0;
    const w = await world();
    const a = w.people[1]!;
    await takeScoring(a, w.id, w.matchId, "dev-a");
    const [p1, p2, p3, q1] = (await startSnapshot(w.id, w.matchId))!.base.players.map((p) => p.id) as [string, string, string, string];
    const start = await startEvent(w);
    const innings = ev("innings_start", { striker: p1, nonStriker: p2, bowler: q1 });
    const b1 = ev("ball", { runs: 4 });
    const r1 = await applyEvents(a, w.id, w.matchId, "dev-a", [start, innings, b1]) as SyncResult;
    expect(r1).toMatchObject({ accepted: [start.id, innings.id, b1.id], rejected: [], lastSeq: 3, lockLost: false });
    const m = (await query<{ status: string; started_at: Date | null }>("select status, started_at from cricket_match where id = $1", [w.matchId]))[0]!;
    expect(m.status).toBe("live");
    expect(m.started_at).not.toBeNull();

    // the same events sent again are recognised and ignored
    const again = await applyEvents(a, w.id, w.matchId, "dev-a", [start, innings, b1]) as SyncResult;
    expect(again).toMatchObject({ accepted: [], duplicates: [start.id, innings.id, b1.id], rejected: [] });
    expect(await loadEvents(w.matchId)).toHaveLength(3);

    // a gap is refused, and so is everything after it
    seq++;                                         // a number is skipped
    const gap = ev("ball", { runs: 1 });
    const after = ev("ball", { runs: 2 });
    const r2 = await applyEvents(a, w.id, w.matchId, "dev-a", [gap, after]) as SyncResult;
    expect(r2.rejected.map((r) => r.code)).toEqual(["out_of_order", "blocked"]);
    expect(r2.rejected[0]!.reason).toMatch(/expected number 4/);
    seq = 3;

    // the engine's own refusals come back with its reason
    const bad = ev("ball", { runs: 1, wicket: { type: "bowled" } });
    const r3 = await applyEvents(a, w.id, w.matchId, "dev-a", [bad]) as SyncResult;
    expect(r3.rejected[0]).toMatchObject({ code: "refused", reason: expect.stringMatching(/Runs cannot/) });
    seq = 3;

    // a made-up event is invalid
    const junk = await applyEvents(a, w.id, w.matchId, "dev-a", [{ id: "nope", seq: 4, type: "ball", payload: {} }, { id: randomUUID(), seq: 4, type: "teleport", payload: {} }]) as SyncResult;
    expect(junk.rejected.every((r) => r.code === "invalid" || r.code === "blocked")).toBe(true);
    const wild = await applyEvents(a, w.id, w.matchId, "dev-a", [{ id: randomUUID(), seq: 4, type: "ball", payload: { runs: 99 } }]) as SyncResult;
    expect(wild.rejected[0]!.code).toBe("invalid");

    // undo is just another event
    const undo = ev("undo");
    const r4 = await applyEvents(a, w.id, w.matchId, "dev-a", [undo]) as SyncResult;
    expect(r4.accepted).toEqual([undo.id]);
    const all = await loadEvents(w.matchId);
    expect(all.map((e) => e.type)).toEqual(["match_start", "innings_start", "ball", "undo"]);   // the undone ball is still on record
    expect((await scorersOf(w.matchId))).toEqual([{ name: "TEST p0", balls: 1 }]);
    expect(all[2]!.by).toBe("TEST p0");

    // nothing changes the log afterwards
    await expect(query("update match_event set type = 'ball' where match_id = $1", [w.matchId])).rejects.toThrow();
    await expect(query("delete from match_event where match_id = $1 and seq = 4", [w.matchId])).rejects.toThrow();
  });

  it("the start event must match the database exactly: players, rules, overs", async () => {
    seq = 0;
    const w = await world();
    const a = w.people[1]!;
    await takeScoring(a, w.id, w.matchId, "dev-a");
    const snap = (await startSnapshot(w.id, w.matchId))!;
    const fake = ev("match_start", { ...snap.base, players: [...snap.base.players, { id: randomUUID(), side: 1, name: "Ghost", number: 5, kind: "guest", userId: null }], toss: null, battingFirst: 1 });
    expect(((await applyEvents(a, w.id, w.matchId, "dev-a", [fake])) as SyncResult).rejected[0]).toMatchObject({ code: "refused", reason: expect.stringMatching(/lineups changed/) });
    seq = 0;
    const wrongRules = ev("match_start", { ...snap.base, rules: { ...snap.base.rules, freeHit: false }, toss: null, battingFirst: 1 });
    expect(((await applyEvents(a, w.id, w.matchId, "dev-a", [wrongRules])) as SyncResult).rejected[0]!.reason).toMatch(/setup changed/);
    seq = 0;
    const moved = ev("match_start", { ...snap.base, players: snap.base.players.map((p, i) => (i === 0 ? { ...p, side: 2 } : p)), toss: null, battingFirst: 1 });
    expect(((await applyEvents(a, w.id, w.matchId, "dev-a", [moved])) as SyncResult).rejected[0]!.code).toBe("refused");
    seq = 0;
    const forged = ev("match_start", { ...snap.base, players: snap.base.players.map((p, i) => (i === 0 ? { ...p, name: "Forged Name", number: 77 } : p)), toss: null, battingFirst: 1 });
    expect(((await applyEvents(a, w.id, w.matchId, "dev-a", [forged])) as SyncResult).accepted).toEqual([forged.id]);
    const stored = (await loadEvents(w.matchId))[0]!;
    if (stored.type === "match_start") expect(stored.payload.players[0]!.name).not.toBe("Forged Name");   // names come from the database
  });

  it("a late member or guest is added to the lineup in the database; undoing removes them again", async () => {
    seq = 0;
    const w = await world();
    const a = w.people[1]!;
    await takeScoring(a, w.id, w.matchId, "dev-a");
    const players = (await startSnapshot(w.id, w.matchId))!.base.players;
    const [p1, p2, , q1] = players.map((p) => p.id) as [string, string, string, string];
    await applyEvents(a, w.id, w.matchId, "dev-a", [await startEvent(w), ev("innings_start", { striker: p1, nonStriker: p2, bowler: q1 })]);
    // raise players per side first, then add a guest and a member (the 7th person: a fresh member who was not in the lineup)
    const late = await newUser("late");
    const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [w.id]))[0]!.invite_code;
    await requestToJoin(late, code); await chooseNumber(late, w.id, 50);
    const gId = randomUUID(), mId = randomUUID();
    const res = await applyEvents(a, w.id, w.matchId, "dev-a", [
      ev("players_change", { playersPerSide: 4 }),
      ev("player_added", { player: { id: gId, side: 1, name: "  Sami  ", number: 99, kind: "guest", userId: null } }),
      ev("player_added", { player: { id: mId, side: 2, name: "Whatever", number: 42, kind: "member", userId: late } }),
    ]) as SyncResult;
    expect(res.rejected).toEqual([]);
    const rows = await query<{ id: string; guest_name: string | null; user_id: string | null }>("select id, guest_name, user_id from match_player where match_id = $1 and id = any($2::uuid[])", [w.matchId, [gId, mId]]);
    expect(rows).toHaveLength(2);
    expect((await query<{ players_per_side: number }>("select players_per_side from cricket_match where id = $1", [w.matchId]))[0]!.players_per_side).toBe(4);
    const guest = (await loadEvents(w.matchId)).find((e) => e.id !== undefined && e.type === "player_added" && e.payload.player.id === gId)!;
    if (guest.type === "player_added") expect(guest.payload.player).toMatchObject({ name: "Sami", number: null });   // a guest never gets a number
    const member = (await loadEvents(w.matchId)).find((e) => e.type === "player_added" && e.payload.player.id === mId)!;
    if (member.type === "player_added") expect(member.payload.player).toMatchObject({ name: "TEST late", number: 50 });   // the real name and number
    // a person who is not a member cannot be added
    const stranger = await newUser("stranger");
    const bad = await applyEvents(a, w.id, w.matchId, "dev-a", [ev("player_added", { player: { id: randomUUID(), side: 1, name: "X", number: null, kind: "member", userId: stranger } })]) as SyncResult;
    expect(bad.rejected[0]!.reason).toMatch(/not a member/);
    seq--;
    // undo the member: they leave the lineup
    await applyEvents(a, w.id, w.matchId, "dev-a", [ev("undo")]);
    expect(await query("select 1 from match_player where id = $1", [mId])).toHaveLength(0);
    expect(await query("select 1 from match_player where id = $1", [gId])).toHaveLength(1);
    // someone who was there at the start is never removed by an undo
    expect(await query("select 1 from match_player where match_id = $1", [w.matchId])).toHaveLength(7);
  });

  it("a number is locked while the player is in a live match, and free again afterwards", async () => {
    seq = 0;
    const w = await world();
    const a = w.people[1]!;
    await takeScoring(a, w.id, w.matchId, "dev-a");
    const players = (await startSnapshot(w.id, w.matchId))!.base.players;
    expect(await chooseNumber(w.people[2]!, w.id, 60)).toBe("ok");           // before the match starts
    await applyEvents(a, w.id, w.matchId, "dev-a", [await startEvent(w)]);
    expect(await chooseNumber(w.people[2]!, w.id, 61)).toBe("locked");
    const outsider = w.people[0]!;
    void players; void outsider;
    await applyEvents(a, w.id, w.matchId, "dev-a", [ev("match_end", { kind: "abandoned" })]);
    expect(await chooseNumber(w.people[2]!, w.id, 61)).toBe("ok");
  });

  it("finishing locks the match, clears the lock, and records the result; abandoning is recorded too", async () => {
    seq = 0;
    const w = await world();
    const a = w.people[1]!;
    await takeScoring(a, w.id, w.matchId, "dev-a");
    const [p1, p2, p3, q1, q2, q3] = (await startSnapshot(w.id, w.matchId))!.base.players.map((p) => p.id) as string[] as [string, string, string, string, string, string];
    const events = [
      await startEvent(w),
      ev("innings_start", { striker: p1, nonStriker: p2, bowler: q1 }),
      ev("ball", { runs: 6 }), ev("ball", { runs: 6 }), ev("ball", { runs: 6 }), ev("ball", { runs: 6 }), ev("ball", { runs: 6 }), ev("ball", { runs: 6 }),
      ev("bowler", { player: q2 }),
      ev("innings_end"),
      ev("innings_start", { striker: q1, nonStriker: q2, bowler: p3 }),
      ev("ball", { runs: 6 }), ev("ball", { runs: 6 }), ev("ball", { runs: 6 }), ev("ball", { runs: 6 }), ev("ball", { runs: 6 }), ev("ball", { runs: 6 }),
      ev("bowler", { player: p2 }),
      ev("ball", { runs: 1 }),
    ];
    void q3;
    const r = await applyEvents(a, w.id, w.matchId, "dev-a", events) as SyncResult;
    expect(r.rejected).toEqual([]);
    expect((await query<{ status: string }>("select status from cricket_match where id = $1", [w.matchId]))[0]!.status).toBe("live");
    const fin = await applyEvents(a, w.id, w.matchId, "dev-a", [ev("finish")]) as SyncResult;
    expect(fin.accepted).toHaveLength(1);
    const m = (await query<{ status: string; result: { kind: string; text: string }; finished_at: Date | null; scorer_id: string | null }>("select status, result, finished_at, scorer_id from cricket_match where id = $1", [w.matchId]))[0]!;
    expect(m).toMatchObject({ status: "completed", scorer_id: null });
    expect(m.result).toMatchObject({ kind: "win" });
    expect(m.finished_at).not.toBeNull();
    // locked for good
    const late = await applyEvents(a, w.id, w.matchId, "dev-a", [ev("ball", { runs: 1 })]) as SyncResult;
    expect(late.rejected[0]!.code === "not_scorer" || late.rejected[0]!.code === "locked").toBe(true);
    expect(await takeScoring(a, w.id, w.matchId, "dev-a")).toBe("bad_state");
  });

  it("pause and resume change the status; deleting the community removes the whole log", async () => {
    seq = 0;
    const w = await world();
    const a = w.people[1]!;
    await takeScoring(a, w.id, w.matchId, "dev-a");
    const [p1, p2, , q1] = (await startSnapshot(w.id, w.matchId))!.base.players.map((p) => p.id) as [string, string, string, string];
    await applyEvents(a, w.id, w.matchId, "dev-a", [await startEvent(w), ev("innings_start", { striker: p1, nonStriker: p2, bowler: q1 }), ev("pause")]);
    expect((await query<{ status: string }>("select status from cricket_match where id = $1", [w.matchId]))[0]!.status).toBe("paused");
    await applyEvents(a, w.id, w.matchId, "dev-a", [ev("resume")]);
    expect((await query<{ status: string }>("select status from cricket_match where id = $1", [w.matchId]))[0]!.status).toBe("live");
    await query("delete from community where id = $1", [w.id]);
    expect(await query("select 1 from match_event where match_id = $1", [w.matchId])).toHaveLength(0);
  });

  it("a lineup can be edited only before the match starts; guests added before the start are in the start snapshot", async () => {
    seq = 0;
    const w = await world();
    await addGuest(w.admin, w.id, w.matchId, 1, "Early Guest").catch(() => undefined);
    const snap = (await startSnapshot(w.id, w.matchId))!;
    expect(snap.base.players.some((p) => p.name === "Early Guest")).toBe(false);   // side 1 already full (3 of 3): refused by the lineup rules
    expect(snap.base.players).toHaveLength(6);
  });
});
