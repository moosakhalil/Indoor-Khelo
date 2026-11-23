// A match made on a phone with no signal, created on the server when the signal returns (real Neon database, temporary people).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import { chooseNumber, createCommunity, requestToJoin } from "@/lib/community";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { getMatch, listLineup, listMatches } from "@/lib/matches";
import { createQuickMatch, rosterFor } from "@/lib/quickMatch";
import { validateQuickMatch, type QuickMatchInput } from "@/lib/quickMatchRules";
import { applyEvents, startSnapshot, type SyncResult } from "@/lib/scoring";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
const communities: string[] = [];
const uuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
async function newUser(label: string) {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}
async function community(name: string, extra = 5) {
  const admin = await newUser(`${name} admin`);
  const id = await createCommunity(admin, { name: `TEST ${name}`, description: "", location: "", approvalRequired: false });
  communities.push(id);
  const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!.invite_code;
  await chooseNumber(admin, id, 1);
  const people = [admin];
  for (let i = 0; i < extra; i++) { const u = await newUser(`${name} p${i}`); await requestToJoin(u, code); await chooseNumber(u, id, 10 + i); people.push(u); }
  return { id, admin, people };
}
let cached: ReturnType<typeof community> | null = null;
const world = () => (cached ??= community("Quick"));

const wire = (people: string[], over: Partial<QuickMatchInput> = {}): QuickMatchInput => ({
  id: randomUUID(), sides: [{ id: randomUUID(), name: "Alpha" }, { id: randomUUID(), name: "Bravo" }], overs: 4, playersPerSide: 4, rules: DEFAULT_RULES,
  players: [
    { id: randomUUID(), side: 1, userId: people[0]!, guestName: null }, { id: randomUUID(), side: 1, userId: people[1]!, guestName: null },
    { id: randomUUID(), side: 2, userId: people[2]!, guestName: null }, { id: randomUUID(), side: 2, userId: null, guestName: "Sami Guest" },
  ],
  ...over,
});
const count = async (table: string, id: string, col = "id") => (await query(`select 1 from ${table} where ${col} = $1`, [id])).length;

describe.skipIf(!run)("offline quick match on the server", () => {
  afterAll(async () => {
    if (communities.length) await query("delete from community where id = any($1::uuid[])", [communities]);
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("creates the match with the ids from the phone: sides, lineups, guests, default rules, and the scoring lock for that phone", { timeout: 240_000 }, async () => {
    const w = await world();
    const m = wire(w.people);
    expect(await createQuickMatch(w.people[1]!, w.id, "dev-1", m)).toEqual({ outcome: "ok" });
    const row = (await query<{ status: string; overs: number; players_per_side: number; rules: unknown; created_by: string; scorer_id: string; scorer_device: string; venue: string }>(
      "select status, overs, players_per_side, rules, created_by, scorer_id, scorer_device, venue from cricket_match where id = $1", [m.id]))[0]!;
    expect(row).toMatchObject({ status: "scheduled", overs: 4, players_per_side: 4, created_by: w.people[1], scorer_id: w.people[1], scorer_device: "dev-1" });
    expect(row.rules).toMatchObject({ ballsPerOver: 6, freeHit: true, lastBatterAlone: true, wideRuns: 1 });
    const sides = await query<{ id: string; position: number; name: string }>("select id, position, name from match_side where match_id = $1 order by position", [m.id]);
    expect(sides.map((s) => [s.id, s.name])).toEqual([[m.sides[0].id, "Alpha"], [m.sides[1].id, "Bravo"]]);
    const lineup = await listLineup(w.id, m.id);
    expect(lineup.map((l) => l.id).sort()).toEqual(m.players.map((p) => p.id).sort());      // the same ids the phone made
    expect(lineup.find((l) => l.guest_name === "Sami Guest")).toMatchObject({ kind: "guest", user_id: null, player_number: null, position: 2 });
    expect(lineup.find((l) => l.user_id === w.people[0])).toMatchObject({ kind: "member", position: 1, player_number: 1 });
    // it shows up in the normal match list, created by the person who made it
    expect((await getMatch(w.id, m.id, w.admin))!).toMatchObject({ created_by_name: expect.stringContaining("TEST Quick p0"), status: "scheduled" });
    expect((await listMatches(w.id, w.admin)).some((x) => x.id === m.id)).toBe(true);
    expect((await query("select 1 from audit_log where community_id = $1 and action = 'match_created' and details->>'match' = $2", [w.id, m.id]))).toHaveLength(1);
  });

  it("sending the same match twice creates it once; another person's match id is refused", { timeout: 240_000 }, async () => {
    const w = await world();
    const m = wire(w.people);
    expect(await createQuickMatch(w.people[1]!, w.id, "dev-1", m)).toEqual({ outcome: "ok" });
    expect(await createQuickMatch(w.people[1]!, w.id, "dev-1", m)).toEqual({ outcome: "ok", duplicate: true });
    expect(await count("cricket_match", m.id)).toBe(1);
    expect(await count("match_player", m.id, "match_id")).toBe(4);
    expect(await createQuickMatch(w.people[2]!, w.id, "dev-2", m)).toEqual({ outcome: "id_taken" });          // someone else cannot take it over
    // the same id cannot be reused in another community either
    const other = await community("Other", 3);
    expect((await createQuickMatch(other.people[1]!, other.id, "dev-3", { ...m, players: m.players.map((p) => ({ ...p, id: randomUUID(), userId: p.userId ? other.people[1 + Math.min(2, m.players.indexOf(p))]! : null })) })).outcome).toBe("id_taken");
  });

  it("only a member of the community can create; every player must be an approved member; nothing is half-saved", { timeout: 240_000 }, async () => {
    const w = await world();
    const stranger = await newUser("stranger");
    const m1 = wire(w.people);
    expect((await createQuickMatch(stranger, w.id, "d", m1)).outcome).toBe("forbidden");
    expect(await count("cricket_match", m1.id)).toBe(0);
    const m2 = wire(w.people, { players: wire(w.people).players.map((p, i) => (i === 0 ? { ...p, userId: stranger } : p)) });
    expect((await createQuickMatch(w.people[1]!, w.id, "d", m2)).outcome).toBe("not_a_member");
    expect(await count("cricket_match", m2.id)).toBe(0);
    expect(await count("match_side", m2.id, "match_id")).toBe(0);
    expect(await count("match_player", m2.id, "match_id")).toBe(0);
    expect((await createQuickMatch(w.people[1]!, w.id, "", wire(w.people))).outcome).toBe("forbidden");   // no device id
  });

  it("the database refuses what the phone should never send: equal side names, the same member twice, impossible overs", { timeout: 240_000 }, async () => {
    const w = await world();
    const same = wire(w.people, { sides: [{ id: randomUUID(), name: "Alpha" }, { id: randomUUID(), name: "alpha" }] });
    expect((await createQuickMatch(w.people[1]!, w.id, "d", same)).outcome).toBe("same_names");
    expect(await count("cricket_match", same.id)).toBe(0);
    const twice = wire(w.people);
    twice.players[2] = { ...twice.players[2]!, userId: w.people[0]! };       // member 0 is on both sides
    expect((await createQuickMatch(w.people[1]!, w.id, "d", twice)).outcome).toBe("bad_lineup");
    expect(await count("cricket_match", twice.id)).toBe(0);
    const overs = wire(w.people, { overs: 0 });
    expect((await createQuickMatch(w.people[1]!, w.id, "d", overs)).outcome).toBe("bad_lineup");
    expect(await count("cricket_match", overs.id)).toBe(0);
    const dupGuest = wire(w.people);
    dupGuest.players.push({ id: randomUUID(), side: 1, userId: null, guestName: "sami guest" });
    expect((await createQuickMatch(w.people[1]!, w.id, "d", dupGuest)).outcome).toBe("bad_lineup");
    expect(await count("cricket_match", dupGuest.id)).toBe(0);
    // and the shared rule checker says the same things before anything is sent
    expect(validateQuickMatch(JSON.parse(JSON.stringify(dupGuest)), uuid).ok).toBe(false);
    expect(validateQuickMatch(JSON.parse(JSON.stringify(twice)), uuid).ok).toBe(false);
  });

  it("the balls made offline are accepted for that phone: start, innings, balls; another device is refused", { timeout: 240_000 }, async () => {
    const w = await world();
    const m = wire(w.people);
    await createQuickMatch(w.people[1]!, w.id, "dev-1", m);
    const snap = (await startSnapshot(w.id, m.id))!;
    expect(snap.base.sides).toEqual(["Alpha", "Bravo"]);
    const [a1, a2] = snap.base.players.filter((p) => p.side === 1).map((p) => p.id) as [string, string];
    const [b1] = snap.base.players.filter((p) => p.side === 2).map((p) => p.id) as [string];
    let seq = 0;
    const ev = (type: string, payload: object) => ({ id: randomUUID(), seq: ++seq, type, payload });
    const events = [ev("match_start", { ...snap.base, toss: null, battingFirst: 1 }), ev("innings_start", { striker: a1, nonStriker: a2, bowler: b1 }), ev("ball", { runs: 4 }), ev("ball", { runs: 1 })];
    const other = (await applyEvents(w.people[1]!, w.id, m.id, "dev-OTHER", events)) as SyncResult;
    expect(other.lockLost).toBe(true);
    expect(other.rejected[0]!.code).toBe("not_scorer");
    const ok = (await applyEvents(w.people[1]!, w.id, m.id, "dev-1", events)) as SyncResult;
    expect(ok).toMatchObject({ accepted: events.map((e) => e.id), rejected: [], lastSeq: 4 });
    expect((await query<{ status: string }>("select status from cricket_match where id = $1", [m.id]))[0]!.status).toBe("live");
  });

  it("the roster for the phone lists approved members with their numbers, and teams with their squads", { timeout: 240_000 }, async () => {
    const w = await world();
    const r = await rosterFor(w.id, w.admin);
    expect(r.communityId).toBe(w.id);
    expect(r.members).toHaveLength(6);
    expect(r.members[0]).toMatchObject({ id: w.admin, number: 1 });
    expect(Object.keys(r.members[0]!).sort()).toEqual(["id", "name", "number", "role"]);     // no emails
    expect(r.teams).toEqual([]);
  });

  it("deleting the community removes a match made this way, with its lineups", { timeout: 240_000 }, async () => {
    const c = await community("Gone", 3);
    const m = wire(c.people);
    await createQuickMatch(c.people[1]!, c.id, "d", m);
    expect(await count("cricket_match", m.id)).toBe(1);
    await query("delete from community where id = $1", [c.id]);
    expect(await count("cricket_match", m.id)).toBe(0);
    expect(await count("match_player", m.id, "match_id")).toBe(0);
    expect(await count("match_side", m.id, "match_id")).toBe(0);
  });
});
