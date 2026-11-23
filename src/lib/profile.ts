import { one, query } from "@/lib/db";
import { isUuid } from "@/lib/community";
import type { ProfileInput } from "@/lib/validation";

export type Profile = {
  id: string;
  name: string;
  batting_hand: string | null;
  batting_position: string | null;
  bowling_style: string | null;
  playing_role: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  return one<Profile>(
    "select id, name, batting_hand, batting_position, bowling_style, playing_role from app_user where id = $1",
    [userId],
  );
}

/** Only the person themselves can change their profile. Nobody else, not even an Admin. */
export async function updateProfile(userId: string, input: ProfileInput): Promise<void> {
  await query(
    `update app_user set name = $2, batting_hand = $3, batting_position = $4, bowling_style = $5,
            playing_role = $6, updated_at = now() where id = $1`,
    [userId, input.name, input.battingHand, input.battingPosition, input.bowlingStyle, input.playingRole],
  );
}

export type PlayerView = Profile & { community_role: "admin" | "member"; player_number: number };

/** A player as seen inside one community: only approved members who have chosen a number. */
export async function getPlayerInCommunity(communityId: string, userId: string): Promise<PlayerView | null> {
  if (!isUuid(communityId) || !isUuid(userId)) return null;
  return one<PlayerView>(
    `select u.id, u.name, u.batting_hand, u.batting_position, u.bowling_style, u.playing_role,
            m.role as community_role, m.player_number
       from community_member m join app_user u on u.id = m.user_id
      where m.community_id = $1 and m.user_id = $2 and m.status = 'approved' and m.player_number is not null`,
    [communityId, userId],
  );
}
