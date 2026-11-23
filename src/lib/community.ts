import { redirect } from "next/navigation";
import { isCommunityFull, isUniqueViolation, one, query, tx } from "@/lib/db";
import { COMMUNITY_MEMBER_CAP, generateInviteCode, type CommunityInput } from "@/lib/validation";

export type Community = {
  id: string;
  name: string;
  description: string;
  location: string;
  approval_required: boolean;
  invite_code: string;
  created_by: string;
  created_at: Date;
};

export type Role = "admin" | "member";
export type Status = "pending" | "approved" | "rejected" | "removed" | "left";
export type Membership = { community_id: string; user_id: string; role: Role; status: Status; player_number: number | null };

export type MemberRow = { user_id: string; name: string; role: Role; player_number: number | null; playing_role: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

export async function getCommunity(id: string): Promise<Community | null> {
  if (!isUuid(id)) return null;
  return one<Community>("select * from community where id = $1", [id]);
}

export async function getCommunityByCode(code: string): Promise<Community | null> {
  return one<Community>("select * from community where invite_code = $1", [code]);
}

export async function getMembership(communityId: string, userId: string): Promise<Membership | null> {
  if (!isUuid(communityId)) return null;
  return one<Membership>(
    "select community_id, user_id, role, status, player_number from community_member where community_id = $1 and user_id = $2",
    [communityId, userId],
  );
}

export async function listMyCommunities(userId: string) {
  return query<Community & { role: Role; status: Status; player_number: number | null }>(
    `select c.*, m.role, m.status, m.player_number
       from community_member m join community c on c.id = m.community_id
      where m.user_id = $1 and m.status in ('pending','approved')
      order by c.created_at`,
    [userId],
  );
}

export async function approvedCount(communityId: string): Promise<number> {
  const r = await one<{ n: string }>("select count(*) as n from community_member where community_id = $1 and status = 'approved'", [communityId]);
  return Number(r?.n ?? 0);
}

export async function listApprovedMembers(communityId: string): Promise<MemberRow[]> {
  return query<MemberRow>(
    `select m.user_id, u.name, m.role, m.player_number, u.playing_role
       from community_member m join app_user u on u.id = m.user_id
      where m.community_id = $1 and m.status = 'approved' and m.player_number is not null
      order by m.role, m.player_number`,
    [communityId],
  );
}

export async function listPending(communityId: string) {
  return query<{ user_id: string; name: string; requested_at: Date }>(
    `select m.user_id, u.name, m.requested_at
       from community_member m join app_user u on u.id = m.user_id
      where m.community_id = $1 and m.status = 'pending'
      order by m.requested_at`,
    [communityId],
  );
}

export async function takenNumbers(communityId: string): Promise<number[]> {
  const rows = await query<{ player_number: number }>(
    "select player_number from community_member where community_id = $1 and status = 'approved' and player_number is not null",
    [communityId],
  );
  return rows.map((r) => r.player_number);
}

export async function audit(communityId: string | null, actorId: string, action: string, details: Record<string, unknown> = {}) {
  await query("insert into audit_log (community_id, actor_id, action, details) values ($1, $2, $3, $4)", [communityId, actorId, action, JSON.stringify(details)]);
}

/** Creates the community and makes the creator its Admin. The creator still has to choose a player number. */
export async function createCommunity(userId: string, input: CommunityInput): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    try {
      return await tx(async (c) => {
        const created = await c.query<{ id: string }>(
          `insert into community (name, description, location, approval_required, invite_code, created_by, changed_by)
           values ($1, $2, $3, $4, $5, $6, $6) returning id`,
          [input.name, input.description, input.location, input.approvalRequired, code, userId],
        );
        const id = created.rows[0]!.id;
        await c.query(
          `insert into community_member (community_id, user_id, role, status, decided_at, decided_by)
           values ($1, $2, 'admin', 'approved', now(), $2)`,
          [id, userId],
        );
        await c.query("insert into audit_log (community_id, actor_id, action, details) values ($1, $2, 'community_created', $3)", [id, userId, JSON.stringify({ name: input.name })]);
        return id;
      });
    } catch (err) {
      if (isUniqueViolation(err)) continue; // invite code clash, try another
      throw err;
    }
  }
  throw new Error("Could not create an invite code. Please try again.");
}

export type JoinOutcome = "pending" | "approved" | "already_member" | "not_found" | "full";

export async function requestToJoin(userId: string, code: string): Promise<{ outcome: JoinOutcome; communityId?: string }> {
  const community = await getCommunityByCode(code);
  if (!community) return { outcome: "not_found" };
  const existing = await getMembership(community.id, userId);
  if (existing?.status === "approved") return { outcome: "already_member", communityId: community.id };
  if (existing?.status === "pending") return { outcome: "pending", communityId: community.id };
  if ((await approvedCount(community.id)) >= COMMUNITY_MEMBER_CAP) return { outcome: "full", communityId: community.id };

  const status: Status = community.approval_required ? "pending" : "approved";
  try {
    await query(
      `insert into community_member (community_id, user_id, role, status, requested_at, decided_at)
       values ($1, $2, 'member', $3, now(), case when $3 = 'approved' then now() end)
       on conflict (community_id, user_id) do update
         set status = excluded.status, role = 'member', player_number = null,
             requested_at = now(), decided_at = excluded.decided_at, decided_by = null, left_at = null`,
      [community.id, userId, status],
    );
  } catch (err) {
    if (isCommunityFull(err)) return { outcome: "full", communityId: community.id };
    throw err;
  }
  await audit(community.id, userId, status === "pending" ? "join_requested" : "joined_open", {});
  return { outcome: status, communityId: community.id };
}

export type DecideOutcome = "ok" | "forbidden" | "not_pending" | "full";

export async function decideRequest(adminId: string, communityId: string, targetId: string, approve: boolean): Promise<DecideOutcome> {
  const me = await getMembership(communityId, adminId);
  if (!me || me.role !== "admin" || me.status !== "approved") return "forbidden";
  const target = await getMembership(communityId, targetId);
  if (!target || target.status !== "pending") return "not_pending";
  try {
    await query(
      "update community_member set status = $3, decided_at = now(), decided_by = $4 where community_id = $1 and user_id = $2 and status = 'pending'",
      [communityId, targetId, approve ? "approved" : "rejected", adminId],
    );
  } catch (err) {
    if (isCommunityFull(err)) return "full";
    throw err;
  }
  await audit(communityId, adminId, approve ? "request_approved" : "request_rejected", { user: targetId });
  return "ok";
}

export type NumberOutcome = "ok" | "taken" | "not_member";

/** First come, first served: the database allows one owner per number, so a second person is refused. */
export async function chooseNumber(userId: string, communityId: string, n: number): Promise<NumberOutcome> {
  try {
    const rows = await query<{ user_id: string }>(
      `update community_member set player_number = $3
        where community_id = $1 and user_id = $2 and status = 'approved'
        returning user_id`,
      [communityId, userId, n],
    );
    if (!rows.length) return "not_member";
  } catch (err) {
    if (isUniqueViolation(err)) return "taken";
    throw err;
  }
  await audit(communityId, userId, "number_chosen", { number: n });
  return "ok";
}

export async function regenerateInvite(adminId: string, communityId: string): Promise<string | null> {
  const me = await getMembership(communityId, adminId);
  if (!me || me.role !== "admin" || me.status !== "approved") return null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    try {
      await query("update community set invite_code = $2, changed_by = $3, updated_at = now() where id = $1", [communityId, code, adminId]);
      await audit(communityId, adminId, "invite_replaced", {});
      return code;
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  return null;
}

/** Gate for every page inside a community: must be an approved member who has chosen a number. */
export async function requireMember(communityId: string, userId: string) {
  const community = await getCommunity(communityId);
  if (!community) redirect("/home");
  const m = await getMembership(communityId, userId);
  if (!m || m.status === "rejected" || m.status === "removed" || m.status === "left") redirect("/choose");
  if (m.status === "pending") redirect(`/c/${communityId}/waiting`);
  if (m.player_number === null) redirect(`/c/${communityId}/number`);
  return { community: community!, membership: m };
}

export async function requireAdmin(communityId: string, userId: string) {
  const ctx = await requireMember(communityId, userId);
  if (ctx.membership.role !== "admin") redirect(`/c/${communityId}`);
  return ctx;
}
