// Phase 4 rules (matches, lineups, guests, replies, alerts) against the real Neon database with temporary test people.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import { chooseNumber, createCommunity, requestToJoin } from "@/lib/community";
import { leaveCommunity } from "@/lib/management";
import { DEFAULT_RULES, type MatchInput } from "@/lib/matchRules";
import {
  addGuest, cancelMatch, createMatch, createRematch, createSeveral, deleteMatch, fillWithIn, getMatch, linkGuest, listAlerts, listLineup,
  listMatches, listReplies, markAlertsRead, postponeMatch, remindNoReplies, setAvailability, setLineup, setToss, unlinkGuest, unreadAlertCount, updateMatch,
} from "@/lib/matches";
import { createTeam, deleteTeam, getTeam, setSquad, teamMatchCount } from "@/lib/teams";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
const communities: string[] = [];

async function newUser(label: string) {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}
async function world(extra = 4) {
  const admin = await newUser("admin");
  const id = await createCommunity(admin, { name: "TEST Match Club", description: "", location: "", approvalRequired: false });
  communities.push(id);
  const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!.invite_code;
  await chooseNumber(admin, id, 1);
  const people: string[] = [];
  for (let i = 0; i < extra; i++) {
    const u = await newUser(`p${i}`);
    await requestToJoin(u, code);
    await chooseNumber(u, id, 10 + i);
    people.push(u);
  }
  return { admin, id, people };
}
const future = (days = 3) => new Date(Date.now() + days * 86_400_000);
const input = (a = "Alpha", b = "Bravo", over: Partial<Omit<MatchInput, "sides">> = {}): MatchInput => ({
  sides: [{ teamId: null, name: a }, { teamId: null, name: b }],
  scheduledAt: future(), venue: "Hall 1", overs: 6, playersPerSide: 6, rules: DEFAULT_RULES, umpire: "", notes: "", warning: null, ...over,
});
async function newMatch(w: { admin: string; id: string }, over: Partial<Omit<MatchInput, "sides">> = {}) {
  const r = await createMatch(w.admin, w.id, input("Alpha", "Bravo", over));
  expect(r.outcome).toBe("ok");
  return r.id!;
}

describe.skipIf(!run)("Phase 4: matches in the real database", () => {
  afterAll(async () => {
    if (communities.length) await query("delete from community where id = any($1::uuid[])", [communities]);
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("any member creates a match: scheduled with a date, a draft without, 'Created by' recorded, rules snapshot kept", async () => {
    const w = await world(2);
    const id = await newMatch({ admin: w.people[0]!, id: w.id });
    const m = (await getMatch(w.id, id, w.admin))!;
    expect(m).toMatchObject({ status: "scheduled", side1_name: "Alpha", side2_name: "Bravo", overs: 6, players_per_side: 6, venue: "Hall 1" });
    expect(m.created_by_name).toBe("TEST p0");
    expect(m.rules).toMatchObject({ ballsPerOver: 6, freeHit: true, lastBatterAlone: true });
    const draft = await createMatch(w.admin, w.id, input("Alpha", "Bravo", { scheduledAt: null }));
    expect((await getMatch(w.id, draft.id!, w.admin))!.status).toBe("draft");
    expect((await listMatches(w.id, w.admin)).length).toBe(2);
  });

  it("a person outside the community cannot create or change anything", async () => {
    const w = await world(1);
    const stranger = await newUser("stranger");
    expect((await createMatch(stranger, w.id, input())).outcome).toBe("forbidden");
    const id = await newMatch(w);
    expect(await postponeMatch(stranger, w.id, id)).toBe("forbidden");
    expect(await setAvailability(stranger, w.id, id, "in")).toBe("forbidden");
    expect((await setLineup(stranger, w.id, id, new Map([[w.admin, 1]]), new Map())).outcome).toBe("forbidden");
    expect(await deleteMatch(stranger, w.id, id)).toBe("forbidden");
    expect(await getMatch(w.id, id, stranger)).not.toBeNull();   // reading is gated by the page (requireMember), not this function
  });

  it("a match from another community cannot be reached with this community's id", async () => {
    const w1 = await world(0);
    const w2 = await world(0);
    const id = await newMatch(w1);
    expect(await getMatch(w2.id, id, w2.admin)).toBeNull();
    expect(await postponeMatch(w2.admin, w2.id, id)).toBe("not_found");
  });

  it("the two sides must differ, in the form and in the database", async () => {
    const w = await world(0);
    expect((await createMatch(w.admin, w.id, input("Alpha", "alpha"))).outcome).toBe("same_names");
    expect((await listMatches(w.id, w.admin)).length).toBe(0);   // nothing half-saved
  });

  it("a permanent team must belong to this community; a team with matches cannot be deleted", async () => {
    const w = await world(1);
    const other = await world(0);
    const t = await createTeam(w.admin, w.id, { name: "TEST Alpha", description: "", captainId: null, viceCaptainId: null });
    const foreign = await createTeam(other.admin, other.id, { name: "TEST Zulu", description: "", captainId: null, viceCaptainId: null });
    const bad = await createMatch(w.admin, w.id, { ...input(), sides: [{ teamId: foreign.id!, name: "TEST Zulu" }, { teamId: null, name: "Bravo" }] });
    expect(bad.outcome).toBe("bad_team");
    const ok = await createMatch(w.admin, w.id, { ...input(), sides: [{ teamId: t.id!, name: "TEST Alpha" }, { teamId: null, name: "Bravo" }] });
    expect(ok.outcome).toBe("ok");
    expect(await teamMatchCount(t.id!)).toBe(1);
    expect(await deleteTeam(w.admin, w.id, t.id!)).toBe("has_matches");
    expect(await getTeam(w.id, t.id!)).not.toBeNull();
    expect(await deleteMatch(w.admin, w.id, ok.id!)).toBe("ok");
    expect(await deleteTeam(w.admin, w.id, t.id!)).toBe("ok");
  });

  it("creating a match alerts everyone else, not the creator", async () => {
    const w = await world(3);
    await newMatch(w);
    expect(await unreadAlertCount(w.admin, w.id)).toBe(0);
    expect(await unreadAlertCount(w.people[0]!, w.id)).toBe(1);
    const alerts = await listAlerts(w.people[1]!, w.id);
    expect(alerts[0]).toMatchObject({ kind: "match_scheduled", message: "New match: Alpha v Bravo. Are you coming?" });
    await markAlertsRead(w.people[1]!, w.id);
    expect(await unreadAlertCount(w.people[1]!, w.id)).toBe(0);
    expect(await unreadAlertCount(w.people[0]!, w.id)).toBe(1);   // each person has their own
    // a draft sends nothing until it gets a date
    const d = await createMatch(w.admin, w.id, input("Alpha", "Bravo", { scheduledAt: null }));
    expect(await unreadAlertCount(w.people[2]!, w.id)).toBe(1);
    const r = await updateMatch(w.admin, w.id, d.id!, { ...input("Alpha", "Bravo"), scheduledAt: future(5) });
    expect(r.outcome).toBe("ok");
    expect(await unreadAlertCount(w.people[2]!, w.id)).toBe(2);
    expect((await getMatch(w.id, d.id!, w.admin))!.status).toBe("scheduled");
  });

  it("several matches at once are independent, each with its own date, venue and overs", async () => {
    const w = await world(1);
    const r = await createSeveral(w.admin, w.id, input().sides, [
      { ...input(), scheduledAt: future(1), venue: "Hall 1", overs: 4 },
      { ...input(), scheduledAt: future(2), venue: "Hall 2", overs: 6 },
      { ...input(), scheduledAt: future(3), venue: "Hall 3", overs: 8 },
    ]);
    expect(r.outcome).toBe("ok");
    expect(r.ids).toHaveLength(3);
    const all = await listMatches(w.id, w.admin);
    expect(all.map((m) => m.overs).sort()).toEqual([4, 6, 8]);
    expect(new Set(all.map((m) => m.id)).size).toBe(3);
    // a failure rolls the whole batch back
    const bad = await createSeveral(w.admin, w.id, [{ teamId: null, name: "Same" }, { teamId: null, name: "same" }], [{ ...input() }]);
    expect(bad.outcome).toBe("same_names");
    expect((await listMatches(w.id, w.admin)).length).toBe(3);
  });

  it("'Are you coming?': reply, change, counts, no reply, locked once started", async () => {
    const w = await world(3);
    const id = await newMatch(w);
    expect(await setAvailability(w.people[0]!, w.id, id, "in")).toBe("ok");
    expect(await setAvailability(w.people[1]!, w.id, id, "out")).toBe("ok");
    expect(await setAvailability(w.people[2]!, w.id, id, "maybe")).toBe("bad_state");   // no "Maybe" answer yet
    let m = (await getMatch(w.id, id, w.people[0]!))!;
    expect(m).toMatchObject({ in_count: 1, out_count: 1, member_count: 4, my_answer: "in" });
    await setAvailability(w.people[0]!, w.id, id, "out");      // change of mind
    m = (await getMatch(w.id, id, w.people[0]!))!;
    expect(m).toMatchObject({ in_count: 0, out_count: 2, my_answer: "out" });
    const replies = await listReplies(w.id, id);
    expect(replies.filter((r) => r.answer === null)).toHaveLength(2);   // admin and one more: no reply
    await query("update cricket_match set status = 'live' where id = $1", [id]);
    expect(await setAvailability(w.people[2]!, w.id, id, "in")).toBe("locked");
  });

  it("a reminder goes only to people who have not replied, and not twice within an hour", async () => {
    const w = await world(3);
    const id = await newMatch(w);
    await setAvailability(w.people[0]!, w.id, id, "in");
    const before = await unreadAlertCount(w.people[1]!, w.id);
    const r = await remindNoReplies(w.admin, w.id, id);
    expect(r).toMatchObject({ outcome: "ok", sent: 2 });             // people 1 and 2 (admin pressed it, person 0 replied)
    expect(await unreadAlertCount(w.people[1]!, w.id)).toBe(before + 1);
    expect(await unreadAlertCount(w.people[0]!, w.id)).toBe(1);       // only the original "scheduled" alert
    expect((await remindNoReplies(w.admin, w.id, id)).outcome).toBe("too_soon");
    await query("update cricket_match set last_reminder_at = now() - interval '2 hours' where id = $1", [id]);
    await setAvailability(w.people[1]!, w.id, id, "out");
    await setAvailability(w.people[2]!, w.id, id, "in");
    expect((await remindNoReplies(w.people[0]!, w.id, id)).outcome).toBe("ok");   // admin never replied
    await setAvailability(w.admin, w.id, id, "in");
    await query("update cricket_match set last_reminder_at = null where id = $1", [id]);
    expect((await remindNoReplies(w.admin, w.id, id)).outcome).toBe("nobody");
  });

  it("lineups: pick sides, a player is on one side only, moving and removing, never touches the squad", async () => {
    const w = await world(4);
    const t = await createTeam(w.admin, w.id, { name: "TEST Squad", description: "", captainId: null, viceCaptainId: null });
    await setSquad(w.admin, w.id, t.id!, [w.people[0]!]);
    const id = await newMatch(w);
    const [a, b, c] = w.people as [string, string, string];
    expect((await setLineup(w.admin, w.id, id, new Map([[a, 1], [b, 2], [c, 2]]), new Map())).outcome).toBe("ok");
    let lineup = await listLineup(w.id, id);
    expect(lineup.filter((l) => l.position === 1).map((l) => l.user_id)).toEqual([a]);
    expect(lineup.filter((l) => l.position === 2).map((l) => l.user_id).sort()).toEqual([b, c].sort());
    await setLineup(w.admin, w.id, id, new Map([[a, 2], [b, 0]]), new Map());       // move a to side 2, take b out
    lineup = await listLineup(w.id, id);
    expect(lineup.find((l) => l.user_id === a)!.position).toBe(2);
    expect(lineup.find((l) => l.user_id === b)).toBeUndefined();
    expect(lineup.filter((l) => l.user_id === a)).toHaveLength(1);                    // never twice
    const squad = await query("select user_id from team_player where team_id = $1", [t.id!]);
    expect(squad).toHaveLength(1);                                                     // squad untouched
    expect(await query("select 1 from match_player where match_id = $1 and user_id = $2", [id, w.people[3]!])).toHaveLength(0);
  });

  it("players per side is a hard limit on each side, and a non-member cannot be picked", async () => {
    const w = await world(4);
    const id = await newMatch(w, { playersPerSide: 2 });
    const [a, b, c] = w.people as [string, string, string];
    const r = await setLineup(w.admin, w.id, id, new Map([[a, 1], [b, 1], [c, 1]]), new Map());
    expect(r).toMatchObject({ outcome: "too_many", tooMany: { side: "Alpha", max: 2 } });
    expect(await listLineup(w.id, id)).toHaveLength(0);                                // rolled back
    expect((await setLineup(w.admin, w.id, id, new Map([[a, 1], [b, 1]]), new Map())).outcome).toBe("ok");
    expect((await addGuest(w.admin, w.id, id, 1, "Sami")).outcome).toBe("too_many");
    const stranger = await newUser("stranger");
    expect((await setLineup(w.admin, w.id, id, new Map([[stranger, 2]]), new Map())).outcome).toBe("not_a_member");
    // raising players per side later is fine; lowering below what a side already has is refused and changes nothing
    expect((await updateMatch(w.admin, w.id, id, { ...input(), playersPerSide: 3 })).outcome).toBe("ok");
    expect((await setLineup(w.admin, w.id, id, new Map([[c, 1]]), new Map())).outcome).toBe("ok");
    const low = await updateMatch(w.admin, w.id, id, { ...input(), playersPerSide: 2, venue: "should not be saved" });
    expect(low).toMatchObject({ outcome: "too_many", tooMany: { side: "Alpha", max: 2 } });
    expect((await getMatch(w.id, id, w.admin))!).toMatchObject({ players_per_side: 3, venue: "Hall 1" });
  });

  it("'Add everyone who is in' fills a side up to its limit and skips people already placed", async () => {
    const w = await world(4);
    const id = await newMatch(w, { playersPerSide: 3 });
    for (const p of w.people) await setAvailability(p, w.id, id, "in");
    await setAvailability(w.admin, w.id, id, "out");
    const r1 = await fillWithIn(w.admin, w.id, id, 1);
    expect(r1).toMatchObject({ outcome: "ok", added: 3, skipped: 1 });
    const r2 = await fillWithIn(w.admin, w.id, id, 2);
    expect(r2).toMatchObject({ outcome: "ok", added: 1, skipped: 0 });      // the one not yet placed
    const lineup = await listLineup(w.id, id);
    expect(lineup).toHaveLength(4);
    expect(lineup.some((l) => l.user_id === w.admin)).toBe(false);          // said "can't make it": still pickable by hand, not auto-added
    expect((await fillWithIn(w.admin, w.id, id, 3)).outcome).toBe("bad_side");
    // anyone can still be added whatever they replied
    expect((await setLineup(w.admin, w.id, id, new Map([[w.admin, 2]]), new Map())).outcome).toBe("ok");
  });

  it("guests: a name only, no number, can be on either side, unique by name, removable", async () => {
    const w = await world(2);
    const id = await newMatch(w);
    expect((await addGuest(w.admin, w.id, id, 1, "Sami")).outcome).toBe("ok");
    expect((await addGuest(w.admin, w.id, id, 2, " sami ")).outcome).toBe("duplicate_guest");
    expect((await addGuest(w.admin, w.id, id, 2, "Imran")).outcome).toBe("ok");
    expect((await addGuest(w.admin, w.id, id, 5, "Nobody")).outcome).toBe("bad_side");
    const lineup = await listLineup(w.id, id);
    const sami = lineup.find((l) => l.name === "Sami")!;
    expect(sami).toMatchObject({ kind: "guest", user_id: null, player_number: null, position: 1 });
    await setLineup(w.admin, w.id, id, new Map(), new Map([[sami.id, 2]]));
    expect((await listLineup(w.id, id)).find((l) => l.name === "Sami")!.position).toBe(2);
    await setLineup(w.admin, w.id, id, new Map(), new Map([[sami.id, 0]]));
    expect((await listLineup(w.id, id)).find((l) => l.name === "Sami")).toBeUndefined();
  });

  it("linking a guest to a member: 'Linked by', no number for that match, undo, and no double entry", async () => {
    const w = await world(2);
    const id = await newMatch(w);
    await addGuest(w.admin, w.id, id, 1, "Sami");
    const guest = (await listLineup(w.id, id))[0]!;
    const sami = w.people[0]!;
    expect(await linkGuest(w.people[1]!, w.id, id, guest.id, sami)).toBe("ok");
    const linked = (await listLineup(w.id, id))[0]!;
    expect(linked).toMatchObject({ kind: "linked", user_id: sami, name: "Sami", player_number: null, linked_by_name: "TEST p1" });
    expect(await linkGuest(w.admin, w.id, id, guest.id, w.people[1]!)).toBe("bad_state");           // already linked
    expect(await unlinkGuest(w.admin, w.id, id, guest.id)).toBe("ok");
    expect((await listLineup(w.id, id))[0]).toMatchObject({ kind: "guest", user_id: null });
    expect(await unlinkGuest(w.admin, w.id, id, guest.id)).toBe("not_found");
    // that member is already playing in this match: linking would double-count
    await setLineup(w.admin, w.id, id, new Map([[sami, 2]]), new Map());
    expect(await linkGuest(w.admin, w.id, id, guest.id, sami)).toBe("already_in_match");
    const stranger = await newUser("stranger");
    expect(await linkGuest(w.admin, w.id, id, guest.id, stranger)).toBe("not_a_member");
    expect(await linkGuest(w.admin, w.id, id, randomUUID(), w.people[1]!)).toBe("not_found");
  });

  it("toss: stored with who bats first; the lineup and setup lock once the match starts", async () => {
    const w = await world(1);
    const id = await newMatch(w);
    expect(await setToss(w.admin, w.id, id, { winnerSide: 2, decision: "bowl", battingFirst: 1 })).toBe("ok");
    expect((await getMatch(w.id, id, w.admin))!).toMatchObject({ toss_winner_side: 2, toss_decision: "bowl", batting_first_side: 1 });
    expect(await setToss(w.admin, w.id, id, { winnerSide: null, decision: null, battingFirst: null })).toBe("ok");
    await expect(query("update cricket_match set toss_winner_side = 1 where id = $1", [id])).rejects.toThrow();   // winner without decision refused by the database
    await query("update cricket_match set status = 'live' where id = $1", [id]);
    expect(await setToss(w.admin, w.id, id, { winnerSide: 1, decision: "bat", battingFirst: 1 })).toBe("locked");
    expect((await updateMatch(w.admin, w.id, id, input())).outcome).toBe("locked");
    expect((await setLineup(w.admin, w.id, id, new Map([[w.admin, 1]]), new Map())).outcome).toBe("locked");
    expect((await addGuest(w.admin, w.id, id, 1, "Late")).outcome).toBe("locked");
    expect(await cancelMatch(w.admin, w.id, id)).toBe("bad_state");
    expect(await deleteMatch(w.admin, w.id, id)).toBe("bad_state");
  });

  it("postpone, reschedule, cancel, delete: who is told and what is allowed", async () => {
    const w = await world(2);
    const id = await newMatch(w);
    expect(await postponeMatch(w.admin, w.id, id)).toBe("ok");
    expect((await getMatch(w.id, id, w.admin))!.status).toBe("postponed");
    expect((await listAlerts(w.people[0]!, w.id))[0]).toMatchObject({ kind: "match_postponed" });
    expect(await postponeMatch(w.admin, w.id, id)).toBe("bad_state");                       // already postponed
    expect((await updateMatch(w.admin, w.id, id, { ...input(), scheduledAt: future(9) })).outcome).toBe("ok");
    expect((await getMatch(w.id, id, w.admin))!.status).toBe("scheduled");                 // a new date schedules it again
    expect((await listAlerts(w.people[0]!, w.id))[0]).toMatchObject({ kind: "match_changed" });
    expect(await cancelMatch(w.people[1]!, w.id, id)).toBe("ok");
    expect((await getMatch(w.id, id, w.admin))!.status).toBe("cancelled");
    expect((await listAlerts(w.people[0]!, w.id))[0]).toMatchObject({ kind: "match_cancelled" });
    expect((await updateMatch(w.admin, w.id, id, input())).outcome).toBe("locked");        // a cancelled match is not edited
    expect(await deleteMatch(w.admin, w.id, id)).toBe("ok");
    expect(await getMatch(w.id, id, w.admin)).toBeNull();
    expect(await deleteMatch(w.admin, w.id, id)).toBe("not_found");
    expect(await query("select 1 from match_side where match_id = $1", [id])).toHaveLength(0);   // everything under it went too
  });

  it("clearing the date of a scheduled match makes it a draft; a postponed match stays postponed", async () => {
    const w = await world(0);
    const id = await newMatch(w);
    await updateMatch(w.admin, w.id, id, { ...input(), scheduledAt: null });
    expect((await getMatch(w.id, id, w.admin))!.status).toBe("draft");
    await updateMatch(w.admin, w.id, id, { ...input(), scheduledAt: future(2) });
    await postponeMatch(w.admin, w.id, id);
    await updateMatch(w.admin, w.id, id, { ...input(), scheduledAt: null });
    expect((await getMatch(w.id, id, w.admin))!.status).toBe("postponed");
  });

  it("rematch: same teams, venue, overs, rules and lineups; new date; separate from the first; guests and links handled", async () => {
    const w = await world(3);
    const t = await createTeam(w.admin, w.id, { name: "TEST Alpha", description: "", captainId: null, viceCaptainId: null });
    const rules = { ...DEFAULT_RULES, freeHit: false, bowlerLimit: { mode: "pattern" as const, pattern: [2, 1, 1] } };
    const first = await createMatch(w.admin, w.id, { ...input("x", "y", { overs: 4, venue: "Hall 9", umpire: "Ump", notes: "N", rules }), sides: [{ teamId: t.id!, name: "TEST Alpha" }, { teamId: null, name: "Bravo" }] });
    const id = first.id!;
    const [a, b, c] = w.people as [string, string, string];
    await setLineup(w.admin, w.id, id, new Map([[a, 1], [b, 2]]), new Map());
    await addGuest(w.admin, w.id, id, 2, "Sami");
    await addGuest(w.admin, w.id, id, 1, "Imran");
    const entries = await listLineup(w.id, id);
    await linkGuest(w.admin, w.id, id, entries.find((l) => l.name === "Imran")!.id, c);
    await setToss(w.admin, w.id, id, { winnerSide: 1, decision: "bat", battingFirst: 1 });

    const when = future(10);
    const re = await createRematch(w.people[1]!, w.id, id, when);
    expect(re.outcome).toBe("ok");
    const m = (await getMatch(w.id, re.id!, w.admin))!;
    expect(m).toMatchObject({ side1_name: "TEST Alpha", side1_team: t.id, side2_name: "Bravo", overs: 4, venue: "Hall 9", status: "scheduled", rematch_of: id });
    expect(m.scheduled_at!.getTime()).toBe(when.getTime());
    expect(m.rules).toMatchObject({ freeHit: false, bowlerLimit: { mode: "pattern", pattern: [2, 1, 1] } });
    expect(m).toMatchObject({ umpire: "", notes: "", toss_winner_side: null });         // fresh match: toss, umpire and notes are not copied
    expect(m.created_by_name).toBe("TEST p1");
    const copy = await listLineup(w.id, re.id!);
    expect(copy.filter((l) => l.position === 1).map((l) => l.user_id).sort()).toEqual([a, c].sort());   // linked guest came across as a member
    expect(copy.filter((l) => l.position === 2).map((l) => l.name).sort()).toEqual(["Sami", "TEST p1"]);
    // editing the rematch's lineup never touches the first match
    await setLineup(w.admin, w.id, re.id!, new Map([[a, 0]]), new Map());
    expect((await listLineup(w.id, id)).some((l) => l.user_id === a)).toBe(true);
    expect((await getMatch(w.id, id, w.admin))!.status).toBe("scheduled");
    // a rematch can be made again and again
    expect((await createRematch(w.admin, w.id, re.id!, future(11))).outcome).toBe("ok");
    expect((await createRematch(w.admin, w.id, id, future(12))).outcome).toBe("ok");
    // people who left are not copied
    await leaveCommunity(b, w.id);
    const again = await createRematch(w.admin, w.id, id, future(13));
    expect((await listLineup(w.id, again.id!)).some((l) => l.user_id === b)).toBe(false);
    expect((await createRematch(w.admin, w.id, randomUUID(), when)).outcome).toBe("not_found");
    expect((await createRematch(await newUser("stranger"), w.id, id, when)).outcome).toBe("forbidden");
  });

  it("a rematch keeps a match-only team as a match-only team, with the same name", async () => {
    const w = await world(0);
    const t = await createTeam(w.admin, w.id, { name: "TEST Gone", description: "", captainId: null, viceCaptainId: null });
    const first = await createMatch(w.admin, w.id, { ...input(), sides: [{ teamId: t.id!, name: "TEST Gone" }, { teamId: null, name: "Bravo" }] });
    await query("update match_side set team_id = null where match_id = $1 and position = 1", [first.id!]);   // as if this side had always been match-only
    const re = await createRematch(w.admin, w.id, first.id!, future(4));
    expect((await getMatch(w.id, re.id!, w.admin))!).toMatchObject({ side1_name: "TEST Gone", side1_team: null });
  });

  it("leaving a community removes the person from matches not yet played, but keeps played ones", async () => {
    const w = await world(2);
    const [a, b] = w.people as [string, string];
    const upcoming = await newMatch(w);
    const played = await newMatch(w);
    for (const id of [upcoming, played]) {
      await setLineup(w.admin, w.id, id, new Map([[a, 1], [b, 2]]), new Map());
      await setAvailability(a, w.id, id, "in");
    }
    await query("update cricket_match set status = 'completed' where id = $1", [played]);
    await leaveCommunity(a, w.id);
    expect((await listLineup(w.id, upcoming)).some((l) => l.user_id === a)).toBe(false);
    expect((await listLineup(w.id, played)).some((l) => l.user_id === a)).toBe(true);        // record of a played match stays
    expect(await query("select 1 from match_availability where user_id = $1 and match_id = $2", [a, upcoming])).toHaveLength(0);
    expect(await unreadAlertCount(a, w.id)).toBe(0);
    expect((await getMatch(w.id, upcoming, w.admin))!.member_count).toBe(2);                 // counts only current members
  });

  it("the database itself refuses what the app should never send", async () => {
    const w = await world(1);
    const id = await newMatch(w);
    await expect(query("update cricket_match set overs = 0 where id = $1", [id])).rejects.toThrow();
    await expect(query("update cricket_match set overs = 51 where id = $1", [id])).rejects.toThrow();
    await expect(query("update cricket_match set players_per_side = 1 where id = $1", [id])).rejects.toThrow();
    await expect(query("update cricket_match set players_per_side = 12 where id = $1", [id])).rejects.toThrow();
    await expect(query("update cricket_match set status = 'finished' where id = $1", [id])).rejects.toThrow();
    await expect(query("update cricket_match set scheduled_at = null where id = $1", [id])).rejects.toThrow();   // 'scheduled' needs a date
    await expect(query("update match_side set name = 'bravo' where match_id = $1 and position = 1", [id])).rejects.toThrow();
    await expect(query("insert into match_side (match_id, position, name) values ($1, 3, 'Third')", [id])).rejects.toThrow();
    const stranger = await newUser("stranger");
    const side = (await query<{ id: string }>("select id from match_side where match_id = $1 and position = 1", [id]))[0]!.id;
    await expect(query("insert into match_player (match_id, side_id, user_id, added_by) values ($1, $2, $3, $3)", [id, side, stranger])).rejects.toThrow();
    await expect(query("insert into match_player (match_id, side_id, added_by) values ($1, $2, $3)", [id, side, w.admin])).rejects.toThrow();   // neither member nor guest
    await expect(query("insert into match_availability (match_id, user_id, answer) values ($1, $2, 'maybe')", [id, w.admin])).rejects.toThrow();
    const other = await newMatch(w);
    const otherSide = (await query<{ id: string }>("select id from match_side where match_id = $1 and position = 1", [other]))[0]!.id;
    await expect(query("insert into match_player (match_id, side_id, guest_name, added_by) values ($1, $2, 'X', $3)", [id, otherSide, w.admin])).rejects.toThrow();   // side from another match
  });

  it("deleting the community removes its matches, alerts and replies, even when a match uses a permanent team", async () => {
    const w = await world(1);
    const t = await createTeam(w.admin, w.id, { name: "TEST Alpha", description: "", captainId: null, viceCaptainId: null });
    const withTeam = await createMatch(w.admin, w.id, { ...input(), sides: [{ teamId: t.id!, name: "TEST Alpha" }, { teamId: null, name: "Bravo" }] });
    expect(withTeam.outcome).toBe("ok");
    const id = await newMatch(w);
    await setAvailability(w.people[0]!, w.id, id, "in");
    await query("delete from community where id = $1", [w.id]);
    expect(await query("select 1 from cricket_match where id = $1", [id])).toHaveLength(0);
    expect(await query("select 1 from match_availability where match_id = $1", [id])).toHaveLength(0);
    expect(await query("select 1 from app_alert where community_id = $1", [w.id])).toHaveLength(0);
  });
});
