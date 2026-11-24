// Builder 3 (UI redesign): the few extra database reads and the one write the new screens need.
// No schema change. Every write checks that the caller is an approved Admin of the community.
import { audit, getMembership } from "@/lib/community";
import { one, query } from "@/lib/db";
import type { MemberItem } from "@/lib/b3";

/** Every approved member, also the ones whose number was freed (they have no number until they choose again). */
export async function listAllApprovedMembers(communityId: string): Promise<MemberItem[]> {
  return query<MemberItem>(
    `select m.user_id, u.name, m.role, m.player_number, u.playing_role
       from community_member m join app_user u on u.id = m.user_id
      where m.community_id = $1 and m.status = 'approved'
      order by u.name`,
    [communityId],
  );
}

export async function countAdmins(communityId: string): Promise<number> {
  const r = await one<{ n: string }>("select count(*) as n from community_member where community_id = $1 and role = 'admin' and status = 'approved'", [communityId]);
  return Number(r?.n ?? 0);
}

export type ReopenOutcome = "ok" | "forbidden" | "not_rejected";

/** Undo for a rejected request: puts the person back in the waiting list with their original request time. */
export async function reopenRequest(adminId: string, communityId: string, targetId: string): Promise<ReopenOutcome> {
  const me = await getMembership(communityId, adminId);
  if (!me || me.role !== "admin" || me.status !== "approved") return "forbidden";
  const rows = await query(
    "update community_member set status = 'pending', decided_at = null, decided_by = null where community_id = $1 and user_id = $2 and status = 'rejected' returning user_id",
    [communityId, targetId],
  );
  if (!rows.length) return "not_rejected"; // for example they already asked again, or it was changed in the meantime
  await audit(communityId, adminId, "request_reopened", { user: targetId });
  return "ok";
}
