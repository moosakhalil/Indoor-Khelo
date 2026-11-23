// Phase 3 rules (profiles and teams) against the real Neon database with temporary test people. All deleted at the end.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import { chooseNumber, createCommunity, requestToJoin } from "@/lib/community";
import { leaveCommunity, removeMember, deleteAccountData } from "@/lib/management";
import { getPlayerInCommunity, getProfile, updateProfile } from "@/lib/profile";
import { createTeam, deleteTeam, getTeam, listSquad, listTeams, setSquad, teamsOfPlayer, updateTeam } from "@/lib/teams";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
const communities: string[] = [];

async function newUser(label: string) {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}
async function newCommunity(admin: string) {
  const id = await createCommunity(admin, { name: "TEST Alpha Club", description: "", location: "", approvalRequired: false });
  communities.push(id);
  const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!.invite_code;
  await chooseNumber(admin, id, 1);
  return { id, code };
}
async function addMember(communityId: string, code: string, label: string, n: number) {
  const u = await newUser(label);
  await requestToJoin(u, code);
  await chooseNumber(u, communityId, n);
  return u;
}
const input = (name: string, captainId: string | null = null, viceCaptainId: string | null = null) => ({ name, description: "", captainId, viceCaptainId });

describe.skipIf(!run)("Phase 3: profiles and teams in the real database", () => {
  afterAll(async () => {
    if (communities.length) await query("delete from community where id = any($1::uuid[])", [communities]);
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("a player saves their profile, including the playing role, and it shows on their player page", async () => {
    const admin = await newUser("admin");
    const { id } = await newCommunity(admin);
    await updateProfile(admin, { name: "TEST Ali", battingHand: "left", battingPosition: "opener", bowlingStyle: "none", playingRole: "wicket_keeper" });
    const p = await getProfile(admin);
    expect(p).toMatchObject({ name: "TEST Ali", batting_hand: "left", batting_position: "opener", bowling_style: "none", playing_role: "wicket_keeper" });
    const view = await getPlayerInCommunity(id, admin);
    expect(view).toMatchObject({ player_number: 1, community_role: "admin", playing_role: "wicket_keeper" });
  });

  it("the database refuses a role or hand that is not on the list", async () => {
    const u = await newUser("u");
    await expect(query("update app_user set playing_role = 'captain' where id = $1", [u])).rejects.toThrow();
    await expect(query("update app_user set batting_hand = 'both' where id = $1", [u])).rejects.toThrow();
  });

  it("any approved member can create a team; outsiders cannot; names are unique per community", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 7);
    const outsider = await newUser("outsider");
    expect((await createTeam(outsider, id, input("Alpha"))).outcome).toBe("forbidden");
    const t = await createTeam(a, id, input("Alpha"));
    expect(t.outcome).toBe("ok");
    expect((await createTeam(admin, id, input("  alpha "))).outcome).toBe("name_taken"); // spaces and capitals do not matter
    // the same name is fine in a different community
    const { id: id2 } = await newCommunity(admin);
    expect((await createTeam(admin, id2, input("Alpha"))).outcome).toBe("ok");
    const team = await getTeam(id, t.id!);
    expect(team).toMatchObject({ name: "Alpha", added_by: "TEST a", changed_by: "TEST a" });
  });

  it("captain and vice-captain join the squad automatically and must be members", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 7);
    const b = await addMember(id, code, "b", 8);
    const stranger = await newUser("stranger");
    expect((await createTeam(admin, id, input("Bad", stranger))).outcome).toBe("bad_person");
    const t = await createTeam(admin, id, input("Bravo", a, b));
    expect(t.outcome).toBe("ok");
    const squad = (await listSquad(t.id!)).map((s) => s.user_id).sort();
    expect(squad).toEqual([a, b].sort());
    // two different people only (the database also enforces this)
    await expect(query("update team set vice_captain_id = captain_id where id = $1", [t.id])).rejects.toThrow();
  });

  it("the squad can hold only approved members, and removing the captain from it removes the role", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 7);
    const b = await addMember(id, code, "b", 8);
    const stranger = await newUser("stranger");
    const t = (await createTeam(admin, id, input("Charlie", a, b))).id!;
    // a stranger cannot be forced in, even straight through the database
    await expect(query("insert into team_player (team_id, user_id, added_by) values ($1, $2, $3)", [t, stranger, admin])).rejects.toThrow(/not_a_member/);
    // set the squad to admin + b only (a is removed, so a stops being captain)
    expect(await setSquad(admin, id, t, [admin, b, stranger])).toBe("ok");
    expect((await listSquad(t)).map((s) => s.user_id).sort()).toEqual([admin, b].sort()); // stranger ignored
    const team = await getTeam(id, t);
    expect(team?.captain_id).toBeNull();
    expect(team?.vice_captain_id).toBe(b);
    // an outsider cannot change the squad
    expect(await setSquad(stranger, id, t, [stranger])).toBe("forbidden");
  });

  it("one player can be in several teams, and editing records who changed it", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 7);
    const t1 = (await createTeam(admin, id, input("One", a))).id!;
    const t2 = (await createTeam(admin, id, input("Two", a))).id!;
    expect((await teamsOfPlayer(id, a)).map((t) => t.name)).toEqual(["One", "Two"]);
    expect(await updateTeam(a, id, t1, { name: "One Renamed", description: "New", captainId: a, viceCaptainId: null })).toBe("ok");
    const team = await getTeam(id, t1);
    expect(team).toMatchObject({ name: "One Renamed", changed_by: "TEST a", added_by: "TEST admin" });
    expect(await updateTeam(a, id, t1, input("Two"))).toBe("name_taken");
    expect((await listTeams(id)).length).toBe(2);
    expect(t2).toBeTruthy();
  });

  it("a member can delete a team; it is gone with its squad", async () => {
    const admin = await newUser("admin");
    const { id } = await newCommunity(admin);
    const t = (await createTeam(admin, id, input("Gone", admin))).id!;
    expect(await deleteTeam(admin, id, t)).toBe("ok");
    expect(await getTeam(id, t)).toBeNull();
    expect((await query("select 1 from team_player where team_id = $1", [t])).length).toBe(0);
    expect(await deleteTeam(admin, id, t)).toBe("not_found");
  });

  it("leaving, being removed, or deleting the account takes a person out of squads and captaincy", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 7);
    const b = await addMember(id, code, "b", 8);
    const c = await addMember(id, code, "c", 9);
    const t = (await createTeam(admin, id, input("Delta", a, b))).id!;
    await setSquad(admin, id, t, [admin, a, b, c]);
    expect(await leaveCommunity(a, id)).toBe("ok");
    let team = await getTeam(id, t);
    expect(team?.captain_id).toBeNull();
    expect((await listSquad(t)).map((s) => s.user_id)).not.toContain(a);
    expect(await removeMember(admin, id, b)).toBe("ok");
    team = await getTeam(id, t);
    expect(team?.vice_captain_id).toBeNull();
    expect((await listSquad(t)).map((s) => s.user_id)).not.toContain(b);
    expect(await deleteAccountData(c)).toBe("ok");
    expect((await listSquad(t)).map((s) => s.user_id)).not.toContain(c);
    // profile fields are cleared with the account
    const p = await getProfile(c);
    expect(p).toMatchObject({ name: "Deleted player", playing_role: null, batting_hand: null });
  });
});
