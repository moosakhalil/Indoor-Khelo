// The shareable player profile in the real database: off by default, only the person can switch it, a new code each time, and deleted accounts vanish.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import { deleteAccountData } from "@/lib/management";
import { profileShareToken, publicProfile, setProfileShare } from "@/lib/profileShare";
import { updateProfile } from "@/lib/profile";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
async function newUser(label: string) {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}

describe.skipIf(!run)("shareable player profile", () => {
  afterAll(async () => {
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("is off by default, switches on with an unguessable code, shows only the profile and career, and a new code is made each time", async () => {
    const u = await newUser("Sharer");
    await updateProfile(u, { name: "TEST Sharer", battingHand: "left", battingPosition: "opener", bowlingStyle: "none", playingRole: "batter" });
    expect(await profileShareToken(u)).toBeNull();
    const t1 = await setProfileShare(u, true);
    expect(t1).toMatch(/^[A-Za-z0-9_-]{20,40}$/);
    expect(await profileShareToken(u)).toBe(t1);
    const p = (await publicProfile(t1!))!;
    expect(p).toMatchObject({ name: "TEST Sharer", batting_hand: "left", playing_role: "batter" });
    expect(p.career.matches).toBe(0);                                  // no matches yet: totals are empty, nothing else is shown
    expect(Object.keys(p).sort()).toEqual(["batting_hand", "batting_position", "bowling_style", "career", "last5Dates", "name", "playing_role"]);   // no email, no id, no communities
    expect(await setProfileShare(u, false)).toBeNull();
    expect(await publicProfile(t1!)).toBeNull();                       // the link stops working at once
    const t2 = await setProfileShare(u, true);
    expect(t2).not.toBe(t1);                                           // switching on again gives a new code
    expect(await publicProfile(t1!)).toBeNull();
    expect(await publicProfile(t2!)).not.toBeNull();
  });

  it("refuses codes that cannot be real, and another person's account is not touched", async () => {
    expect(await publicProfile("short")).toBeNull();
    expect(await publicProfile("x".repeat(30))).toBeNull();
    expect(await publicProfile("../../etc/passwd-0000000000")).toBeNull();
    const a = await newUser("A"), b = await newUser("B");
    const ta = await setProfileShare(a, true);
    expect(await profileShareToken(b)).toBeNull();                      // B is still off
    expect((await publicProfile(ta!))!.name).toBe("TEST A");
  });

  it("deleting the account turns the link off and the person disappears from it", async () => {
    const u = await newUser("Leaver");
    const t = await setProfileShare(u, true);
    expect(await deleteAccountData(u)).toBe("ok");
    expect(await profileShareToken(u)).toBeNull();
    expect(await publicProfile(t!)).toBeNull();
  });
});
