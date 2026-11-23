// Phase 2 rules, run against the real Neon database with temporary test people. All of it is deleted at the end.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import { chooseNumber, createCommunity, decideRequest, getMembership, requestToJoin, takenNumbers } from "@/lib/community";
import {
  accountPlan,
  deleteAccountData,
  deleteCommunity,
  describeActivity,
  leaveCommunity,
  listActivity,
  removeMember,
  resetNumber,
  setRole,
  updateCommunity,
} from "@/lib/management";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
const communities: string[] = [];

async function newUser(label: string) {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}
async function newCommunity(admin: string, approval = false) {
  const id = await createCommunity(admin, { name: "TEST Alpha Club", description: "", location: "", approvalRequired: approval });
  communities.push(id);
  const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!.invite_code;
  return { id, code };
}
async function addMember(communityId: string, code: string, label: string, number?: number) {
  const u = await newUser(label);
  await requestToJoin(u, code);
  if (number) await chooseNumber(u, communityId, number);
  return u;
}

describe.skipIf(!run)("Phase 2 community management in the real database", () => {
  afterAll(async () => {
    if (communities.length) await query("delete from community where id = any($1::uuid[])", [communities]);
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("a member can leave: the number is freed at once and they can join again later", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 9);
    expect(await takenNumbers(id)).toContain(9);
    expect(await leaveCommunity(a, id)).toBe("ok");
    expect((await getMembership(id, a))?.status).toBe("left");
    expect(await takenNumbers(id)).not.toContain(9);
    expect((await requestToJoin(a, code)).outcome).toBe("approved"); // open community: straight back in
    expect(await leaveCommunity(a, id)).toBe("ok");
    expect(await leaveCommunity(a, id)).toBe("not_member"); // already gone
  });

  it("the only Admin cannot leave until someone else is Admin", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 5);
    expect(await leaveCommunity(admin, id)).toBe("only_admin");
    expect((await getMembership(id, admin))?.status).toBe("approved");
    expect(await setRole(admin, id, a, "admin")).toBe("ok");
    expect(await leaveCommunity(admin, id)).toBe("ok");
    // the new Admin is now the only one and also cannot leave
    expect(await leaveCommunity(a, id)).toBe("only_admin");
  });

  it("cancelling a waiting join request works", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin, true);
    const p = await newUser("p");
    expect((await requestToJoin(p, code)).outcome).toBe("pending");
    expect(await leaveCommunity(p, id)).toBe("ok");
    expect((await getMembership(id, p))?.status).toBe("left");
  });

  it("a community must always keep at least one Admin", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 3);
    expect(await setRole(admin, id, admin, "member")).toBe("last_admin");
    expect(await setRole(admin, id, a, "admin")).toBe("ok");
    expect(await setRole(admin, id, a, "admin")).toBe("no_change");
    expect(await setRole(a, id, admin, "member")).toBe("ok"); // fine, a is still Admin
    expect(await setRole(a, id, a, "member")).toBe("last_admin"); // now a is the last one
    // a plain member cannot change roles
    expect(await setRole(admin, id, a, "member")).toBe("forbidden");
  });

  it("only an Admin can remove a member; Admins and yourself are protected; the number is freed", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 21);
    const b = await addMember(id, code, "b", 22);
    expect(await removeMember(a, id, b)).toBe("forbidden"); // a normal member cannot
    expect(await removeMember(admin, id, admin)).toBe("is_self");
    expect(await setRole(admin, id, a, "admin")).toBe("ok");
    expect(await removeMember(admin, id, a)).toBe("is_admin");
    expect(await removeMember(admin, id, b)).toBe("ok");
    expect((await getMembership(id, b))?.status).toBe("removed");
    expect(await takenNumbers(id)).not.toContain(22);
    expect(await removeMember(admin, id, b)).toBe("not_found");
  });

  it("an Admin can ask someone to choose a new number; a member cannot", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 40);
    const b = await addMember(id, code, "b", 41);
    expect(await resetNumber(b, id, a)).toBe("forbidden");
    expect(await resetNumber(admin, id, a)).toBe("ok");
    expect((await getMembership(id, a))?.player_number).toBeNull();
    expect(await takenNumbers(id)).not.toContain(40);
    expect(await resetNumber(admin, id, a)).toBe("not_found"); // already has no number
  });

  it("only an Admin can change settings, and the change is recorded", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin, true);
    const a = await addMember(id, code, "a");
    const input = { name: "TEST Renamed Club", description: "New text", location: "Karachi", approvalRequired: false };
    expect(await updateCommunity(a, id, input)).toBe("forbidden");
    expect(await updateCommunity(admin, id, input)).toBe("ok");
    const row = (await query<{ name: string; approval_required: boolean; changed_by: string }>("select name, approval_required, changed_by from community where id = $1", [id]))[0]!;
    expect(row).toMatchObject({ name: "TEST Renamed Club", approval_required: false, changed_by: admin });
    const act = await listActivity(id, 10);
    expect(act.some((x) => x.action === "settings_changed")).toBe(true);
    expect(describeActivity(act.find((x) => x.action === "settings_changed")!)).toContain("changed the community settings");
  });

  it("deleting a community needs an Admin and the exact name", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a");
    expect(await deleteCommunity(a, id, "TEST Alpha Club")).toBe("forbidden");
    expect(await deleteCommunity(admin, id, "wrong name")).toBe("name_mismatch");
    expect(await deleteCommunity(admin, id, "  test   alpha club ")).toBe("ok"); // spaces and capitals do not matter
    expect((await query("select 1 from community where id = $1", [id])).length).toBe(0);
    expect((await query("select 1 from community_member where community_id = $1", [id])).length).toBe(0);
  });

  it("account deletion: blocked for an only-Admin with members, otherwise removes the data", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    const a = await addMember(id, code, "a", 12);

    // the Admin is blocked while others remain
    let plan = await accountPlan(admin);
    expect(plan.blockers.map((c) => c.id)).toEqual([id]);
    expect(await deleteAccountData(admin)).toBe("blocked");

    // a normal member can delete: they simply leave, their number is freed, the name is removed
    plan = await accountPlan(a);
    expect(plan.willLeave.map((c) => c.id)).toEqual([id]);
    expect(await deleteAccountData(a)).toBe("ok");
    expect((await getMembership(id, a))?.status).toBe("left");
    expect(await takenNumbers(id)).not.toContain(12);
    const nm = (await query<{ name: string }>("select name from app_user where id = $1", [a]))[0]!.name;
    expect(nm).toBe("Deleted player");

    // now the Admin is the only member, so their community is deleted with the account
    plan = await accountPlan(admin);
    expect(plan.blockers).toEqual([]);
    expect(plan.willDelete.map((c) => c.id)).toEqual([id]);
    expect(await deleteAccountData(admin)).toBe("ok");
    expect((await query("select 1 from community where id = $1", [id])).length).toBe(0);
  });
});
