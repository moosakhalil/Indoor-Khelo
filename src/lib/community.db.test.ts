// Runs against the real Neon database with temporary test people. Everything it creates is deleted at the end.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import {
  chooseNumber,
  createCommunity,
  decideRequest,
  getCommunityByCode,
  getMembership,
  regenerateInvite,
  requestToJoin,
  takenNumbers,
} from "@/lib/community";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
const communities: string[] = [];

async function newUser(label: string): Promise<string> {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}

async function newCommunity(admin: string, approval = true) {
  const id = await createCommunity(admin, { name: "TEST Alpha Indoor Club", description: "", location: "", approvalRequired: approval });
  communities.push(id);
  const c = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!;
  return { id, code: c.invite_code };
}

describe.skipIf(!run)("community rules in the real database", () => {
  afterAll(async () => {
    if (communities.length) await query("delete from community where id = any($1::uuid[])", [communities]);
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("the creator becomes the Admin, approved, and has not chosen a number yet", async () => {
    const admin = await newUser("admin");
    const { id, code } = await newCommunity(admin);
    expect(code).toMatch(/^KH-[A-Z0-9]{4}$/);
    const m = await getMembership(id, admin);
    expect(m).toMatchObject({ role: "admin", status: "approved", player_number: null });
  });

  it("join request -> pending -> only the Admin can approve -> then a number is required", async () => {
    const admin = await newUser("admin");
    const bilal = await newUser("bilal");
    const sneaky = await newUser("sneaky");
    const { id, code } = await newCommunity(admin);

    expect((await requestToJoin(bilal, code)).outcome).toBe("pending");
    expect((await getMembership(id, bilal))?.status).toBe("pending");

    // a normal member (or anyone else) cannot approve
    expect(await decideRequest(sneaky, id, bilal, true)).toBe("forbidden");
    expect(await decideRequest(bilal, id, bilal, true)).toBe("forbidden");
    expect((await getMembership(id, bilal))?.status).toBe("pending");

    expect(await decideRequest(admin, id, bilal, true)).toBe("ok");
    const m = await getMembership(id, bilal);
    expect(m).toMatchObject({ status: "approved", player_number: null });

    // approving someone who is not pending does nothing
    expect(await decideRequest(admin, id, bilal, true)).toBe("not_pending");
  });

  it("first come, first served: the second person to confirm a number is refused", async () => {
    const admin = await newUser("admin");
    const a = await newUser("a");
    const b = await newUser("b");
    const { id, code } = await newCommunity(admin, false); // open joining
    expect((await requestToJoin(a, code)).outcome).toBe("approved");
    expect((await requestToJoin(b, code)).outcome).toBe("approved");

    expect(await chooseNumber(a, id, 12)).toBe("ok");
    expect(await chooseNumber(b, id, 12)).toBe("taken");
    expect(await chooseNumber(b, id, 13)).toBe("ok");
    expect((await takenNumbers(id)).sort((x, y) => x - y)).toEqual([12, 13]);

    // two people confirming the same number at the same moment: exactly one wins
    const c1 = await newUser("c1");
    const c2 = await newUser("c2");
    await requestToJoin(c1, code);
    await requestToJoin(c2, code);
    const [r1, r2] = await Promise.all([chooseNumber(c1, id, 50), chooseNumber(c2, id, 50)]);
    expect([r1, r2].sort()).toEqual(["ok", "taken"]);
  });

  it("a player can change their own number to a free one, and the old number is free straight away", async () => {
    const admin = await newUser("admin");
    const a = await newUser("a");
    const b = await newUser("b");
    const { id, code } = await newCommunity(admin, false);
    await requestToJoin(a, code);
    await requestToJoin(b, code);
    expect(await chooseNumber(a, id, 7)).toBe("ok");
    expect(await chooseNumber(b, id, 7)).toBe("taken");
    expect(await chooseNumber(a, id, 8)).toBe("ok"); // changes own number
    expect(await chooseNumber(b, id, 7)).toBe("ok"); // old number free at once
  });

  it("a number must be 1 to 99 inside the database too", async () => {
    const admin = await newUser("admin");
    const { id } = await newCommunity(admin);
    await expect(query("update community_member set player_number = 0 where community_id = $1 and user_id = $2", [id, admin])).rejects.toThrow();
    await expect(query("update community_member set player_number = 100 where community_id = $1 and user_id = $2", [id, admin])).rejects.toThrow();
    expect(await chooseNumber(admin, id, 1)).toBe("ok");
    expect(await chooseNumber(admin, id, 99)).toBe("ok");
  });

  it("only approved members can hold a number; leaving frees it", async () => {
    const admin = await newUser("admin");
    const a = await newUser("a");
    const { id, code } = await newCommunity(admin, false);
    await requestToJoin(a, code);
    await chooseNumber(a, id, 21);
    // moving to 'removed' while still holding a number is refused by the database
    await expect(query("update community_member set status = 'removed' where community_id = $1 and user_id = $2", [id, a])).rejects.toThrow();
    await query("update community_member set status = 'removed', player_number = null where community_id = $1 and user_id = $2", [id, a]);
    expect(await takenNumbers(id)).not.toContain(21);
    // a pending person cannot be given a number
    const p = await newUser("p");
    const { id: id2, code: code2 } = await newCommunity(admin, true);
    await requestToJoin(p, code2);
    expect(await chooseNumber(p, id2, 5)).toBe("not_member");
  });

  it("a rejected person can ask again later", async () => {
    const admin = await newUser("admin");
    const a = await newUser("a");
    const { id, code } = await newCommunity(admin, true);
    await requestToJoin(a, code);
    expect(await decideRequest(admin, id, a, false)).toBe("ok");
    expect((await getMembership(id, a))?.status).toBe("rejected");
    expect((await requestToJoin(a, code)).outcome).toBe("pending");
  });

  it("an unknown or replaced invite code does not work", async () => {
    const admin = await newUser("admin");
    const a = await newUser("a");
    const { id, code } = await newCommunity(admin);
    expect((await requestToJoin(a, "KH-ZZZZ")).outcome).toBe("not_found");
    const fresh = await regenerateInvite(admin, id);
    expect(fresh).toMatch(/^KH-/);
    expect(fresh).not.toBe(code);
    expect(await getCommunityByCode(code)).toBeNull();
    expect((await requestToJoin(a, code)).outcome).toBe("not_found");
    expect((await requestToJoin(a, fresh!)).outcome).toBe("pending");
    // only an Admin can replace the link
    expect(await regenerateInvite(a, id)).toBeNull();
  });

  it("a community holds at most 99 members", async () => {
    const admin = await newUser("admin");
    const extra = await newUser("extra");
    const { id, code } = await newCommunity(admin, false);
    // add 98 more approved members directly (admin is the 1st)
    const ids = Array.from({ length: 98 }, () => randomUUID());
    users.push(...ids);
    await query("insert into app_user (id, name, terms_accepted_at) select u, 'TEST bulk', now() from unnest($1::uuid[]) as u", [ids]);
    await query(
      "insert into community_member (community_id, user_id, role, status) select $1, u, 'member', 'approved' from unnest($2::uuid[]) as u",
      [id, ids],
    );
    expect((await requestToJoin(extra, code)).outcome).toBe("full");
    // even if the app code were bypassed, the database refuses the 100th approved member
    await expect(
      query("insert into community_member (community_id, user_id, role, status) values ($1, $2, 'member', 'approved')", [id, extra]),
    ).rejects.toThrow(/community_full/);
  });
});
