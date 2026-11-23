// Phase 8: the shareable player profile. Off by default; only the player can switch it on or off.
// The public view shows the profile and career totals only: no community names, no match list, no numbers, nothing about payments.
import { randomBytes } from "node:crypto";
import { one, query } from "@/lib/db";
import { careerOf, type Career } from "@/lib/career";
import { playerLines } from "@/lib/reports";

const TOKEN = /^[A-Za-z0-9_-]{20,40}$/;

export async function profileShareToken(userId: string): Promise<string | null> {
  const r = await one<{ profile_share_token: string | null }>("select profile_share_token from app_user where id = $1", [userId]);
  return r?.profile_share_token ?? null;
}

/** Switch the public link on (a brand new code) or off. Only the person themselves can do this. */
export async function setProfileShare(userId: string, on: boolean): Promise<string | null> {
  const token = on ? randomBytes(18).toString("base64url") : null;
  await query("update app_user set profile_share_token = $2 where id = $1", [userId, token]);
  await query("insert into audit_log (community_id, actor_id, action, details) values (null, $1, $2, '{}')", [userId, on ? "profile_shared" : "profile_unshared"]);
  return token;
}

export type PublicProfile = {
  name: string; playing_role: string | null; batting_hand: string | null; batting_position: string | null; bowling_style: string | null; career: Career; last5Dates: (string | null)[];
};

/** What a public link shows: the profile fields and career totals across every community the player is in. */
export async function publicProfile(token: string): Promise<PublicProfile | null> {
  if (!TOKEN.test(token)) return null;
  const u = await one<{ id: string; name: string; playing_role: string | null; batting_hand: string | null; batting_position: string | null; bowling_style: string | null }>(
    "select id, name, playing_role, batting_hand, batting_position, bowling_style from app_user where profile_share_token = $1 and name <> 'Deleted player'", [token]);
  if (!u) return null;
  const lines = await playerLines("", u.id, { allCommunities: true });
  return { name: u.name, playing_role: u.playing_role, batting_hand: u.batting_hand, batting_position: u.batting_position, bowling_style: u.bowling_style, career: careerOf(lines), last5Dates: lines.slice(-5).map((l) => l.when) };
}
