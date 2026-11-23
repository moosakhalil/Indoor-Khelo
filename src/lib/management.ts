// Phase 2: running a community. Leaving, removing people, Admin hand-over, settings,
// deleting a community, and deleting an account. Every rule is checked here on the server.
import type { PoolClient } from "pg";
import { query, tx } from "@/lib/db";
import type { CommunityInput } from "@/lib/validation";
import type { Role } from "@/lib/community";

type Client = PoolClient;

async function lockCommunity(c: Client, communityId: string) {
  await c.query("select pg_advisory_xact_lock(hashtext($1))", [`manage:${communityId}`]);
}

async function logAudit(c: Client, communityId: string | null, actorId: string, action: string, details: Record<string, unknown> = {}) {
  await c.query("insert into audit_log (community_id, actor_id, action, details) values ($1, $2, $3, $4)", [communityId, actorId, action, JSON.stringify(details)]);
}

async function adminCheck(c: Client, communityId: string, userId: string): Promise<boolean> {
  const r = await c.query("select 1 from community_member where community_id = $1 and user_id = $2 and role = 'admin' and status = 'approved'", [communityId, userId]);
  return r.rows.length > 0;
}

/* ---------- leave (also cancels a waiting request) ---------- */
export type LeaveOutcome = "ok" | "only_admin" | "not_member";

export async function leaveCommunity(userId: string, communityId: string): Promise<LeaveOutcome> {
  return tx(async (c) => {
    await lockCommunity(c, communityId);
    const m = (await c.query("select role, status from community_member where community_id = $1 and user_id = $2 for update", [communityId, userId])).rows[0] as
      | { role: Role; status: string }
      | undefined;
    if (!m || (m.status !== "approved" && m.status !== "pending")) return "not_member";
    if (m.status === "approved" && m.role === "admin") {
      const others = await c.query("select 1 from community_member where community_id = $1 and user_id <> $2 and role = 'admin' and status = 'approved'", [communityId, userId]);
      if (!others.rows.length) return "only_admin"; // must hand over first, or delete the community
    }
    await c.query("update community_member set status = 'left', player_number = null, left_at = now() where community_id = $1 and user_id = $2", [communityId, userId]);
    await logAudit(c, communityId, userId, m.status === "pending" ? "request_cancelled" : "member_left", { user: userId });
    return "ok";
  });
}

/* ---------- Admin: remove a member ---------- */
export type RemoveOutcome = "ok" | "forbidden" | "not_found" | "is_admin" | "is_self";

export async function removeMember(adminId: string, communityId: string, targetId: string): Promise<RemoveOutcome> {
  return tx(async (c) => {
    await lockCommunity(c, communityId);
    if (!(await adminCheck(c, communityId, adminId))) return "forbidden";
    if (adminId === targetId) return "is_self";
    const t = (await c.query("select role from community_member where community_id = $1 and user_id = $2 and status = 'approved' for update", [communityId, targetId])).rows[0] as { role: Role } | undefined;
    if (!t) return "not_found";
    if (t.role === "admin") return "is_admin"; // take Admin away first
    await c.query("update community_member set status = 'removed', player_number = null, decided_at = now(), decided_by = $3 where community_id = $1 and user_id = $2", [communityId, targetId, adminId]);
    await logAudit(c, communityId, adminId, "member_removed", { user: targetId });
    return "ok";
  });
}

/* ---------- Admin: make someone Admin, or take Admin away (never the last one) ---------- */
export type RoleOutcome = "ok" | "forbidden" | "not_found" | "last_admin" | "no_change";

export async function setRole(adminId: string, communityId: string, targetId: string, role: Role): Promise<RoleOutcome> {
  return tx(async (c) => {
    await lockCommunity(c, communityId);
    if (!(await adminCheck(c, communityId, adminId))) return "forbidden";
    const t = (await c.query("select role from community_member where community_id = $1 and user_id = $2 and status = 'approved' for update", [communityId, targetId])).rows[0] as { role: Role } | undefined;
    if (!t) return "not_found";
    if (t.role === role) return "no_change";
    if (role === "member") {
      const admins = await c.query("select count(*) as n from community_member where community_id = $1 and role = 'admin' and status = 'approved'", [communityId]);
      if (Number(admins.rows[0]!.n) <= 1) return "last_admin";
    }
    await c.query("update community_member set role = $3 where community_id = $1 and user_id = $2", [communityId, targetId, role]);
    await logAudit(c, communityId, adminId, role === "admin" ? "admin_granted" : "admin_removed", { user: targetId });
    return "ok";
  });
}

/* ---------- Admin: ask a member to choose a new number (settles a dispute) ---------- */
export type ResetOutcome = "ok" | "forbidden" | "not_found";

export async function resetNumber(adminId: string, communityId: string, targetId: string): Promise<ResetOutcome> {
  return tx(async (c) => {
    await lockCommunity(c, communityId);
    if (!(await adminCheck(c, communityId, adminId))) return "forbidden";
    const r = await c.query("update community_member set player_number = null where community_id = $1 and user_id = $2 and status = 'approved' and player_number is not null returning user_id", [communityId, targetId]);
    if (!r.rows.length) return "not_found";
    await logAudit(c, communityId, adminId, "number_reset", { user: targetId });
    return "ok";
  });
}

/* ---------- Admin: community settings ---------- */
export type SettingsOutcome = "ok" | "forbidden";

export async function updateCommunity(adminId: string, communityId: string, input: CommunityInput): Promise<SettingsOutcome> {
  return tx(async (c) => {
    if (!(await adminCheck(c, communityId, adminId))) return "forbidden";
    const before = (await c.query("select name, description, location, approval_required from community where id = $1 for update", [communityId])).rows[0] as
      | { name: string; description: string; location: string; approval_required: boolean }
      | undefined;
    if (!before) return "forbidden";
    await c.query(
      "update community set name = $2, description = $3, location = $4, approval_required = $5, changed_by = $6, updated_at = now() where id = $1",
      [communityId, input.name, input.description, input.location, input.approvalRequired, adminId],
    );
    const changed: string[] = [];
    if (before.name !== input.name) changed.push("name");
    if (before.description !== input.description) changed.push("description");
    if (before.location !== input.location) changed.push("location");
    if (before.approval_required !== input.approvalRequired) changed.push("approval");
    if (changed.length) await logAudit(c, communityId, adminId, "settings_changed", { changed, from: before.name });
    return "ok";
  });
}

/* ---------- Admin: delete the whole community (must type its name) ---------- */
export type DeleteOutcome = "ok" | "forbidden" | "name_mismatch";

export async function deleteCommunity(adminId: string, communityId: string, typedName: string): Promise<DeleteOutcome> {
  return tx(async (c) => {
    await lockCommunity(c, communityId);
    if (!(await adminCheck(c, communityId, adminId))) return "forbidden";
    const row = (await c.query("select name from community where id = $1", [communityId])).rows[0] as { name: string } | undefined;
    if (!row) return "forbidden";
    if (typedName.replace(/\s+/g, " ").trim().toLowerCase() !== row.name.trim().toLowerCase()) return "name_mismatch";
    await c.query("delete from community where id = $1", [communityId]); // members and history go with it
    await logAudit(c, null, adminId, "community_deleted", { name: row.name });
    return "ok";
  });
}

/* ---------- recent activity shown on the Community page ---------- */
export type ActivityRow = { action: string; actor_name: string | null; target_name: string | null; created_at: Date };

const SHOWN = ["community_created", "request_approved", "joined_open", "member_left", "member_removed", "admin_granted", "admin_removed", "settings_changed"];

export async function listActivity(communityId: string, limit = 8): Promise<ActivityRow[]> {
  return query<ActivityRow>(
    `select a.action, u.name as actor_name, t.name as target_name, a.created_at
       from audit_log a
       left join app_user u on u.id = a.actor_id
       left join app_user t on t.id = nullif(a.details->>'user', '')::uuid
      where a.community_id = $1 and a.action = any($2::text[])
      order by a.id desc limit $3`,
    [communityId, SHOWN, limit],
  );
}

export function describeActivity(a: ActivityRow): string {
  const actor = a.actor_name ?? "Someone";
  const target = a.target_name ?? "a member";
  switch (a.action) {
    case "community_created": return `${actor} created the community`;
    case "request_approved": return `${target} joined, approved by ${actor}`;
    case "joined_open": return `${actor} joined`;
    case "member_left": return `${actor} left`;
    case "member_removed": return `${target} was removed by ${actor}`;
    case "admin_granted": return `${actor} made ${target} an Admin`;
    case "admin_removed": return `${actor} took Admin away from ${target}`;
    case "settings_changed": return `${actor} changed the community settings`;
    default: return actor;
  }
}

/* ---------- account deletion ---------- */
export type AccountPlan = {
  blockers: { id: string; name: string }[]; // only Admin, other members still there: hand over first
  willDelete: { id: string; name: string }[]; // the only member: the community goes too
  willLeave: { id: string; name: string }[];
};

export async function accountPlan(userId: string): Promise<AccountPlan> {
  const rows = await query<{ id: string; name: string; role: Role; status: string; members: string; other_admins: string }>(
    `select c.id, c.name, m.role, m.status,
            (select count(*) from community_member x where x.community_id = c.id and x.status = 'approved') as members,
            (select count(*) from community_member x where x.community_id = c.id and x.status = 'approved' and x.role = 'admin' and x.user_id <> $1) as other_admins
       from community_member m join community c on c.id = m.community_id
      where m.user_id = $1 and m.status in ('approved', 'pending')`,
    [userId],
  );
  const plan: AccountPlan = { blockers: [], willDelete: [], willLeave: [] };
  for (const r of rows) {
    const item = { id: r.id, name: r.name };
    if (r.status === "approved" && Number(r.members) === 1) plan.willDelete.push(item);
    else if (r.status === "approved" && r.role === "admin" && Number(r.other_admins) === 0) plan.blockers.push(item);
    else plan.willLeave.push(item);
  }
  return plan;
}

export type AccountDeleteOutcome = "ok" | "blocked";

/** Removes the person's app data. Past records keep only "Deleted player". */
export async function deleteAccountData(userId: string): Promise<AccountDeleteOutcome> {
  const plan = await accountPlan(userId);
  if (plan.blockers.length) return "blocked";
  await tx(async (c) => {
    for (const comm of plan.willDelete) await c.query("delete from community where id = $1", [comm.id]);
    await c.query(
      "update community_member set status = 'left', player_number = null, left_at = now() where user_id = $1 and status in ('approved', 'pending')",
      [userId],
    );
    await c.query("update app_user set name = 'Deleted player', terms_accepted_at = null, updated_at = now() where id = $1", [userId]);
    await logAudit(c, null, userId, "account_deleted", { communities: plan.willLeave.length + plan.willDelete.length });
  });
  return "ok";
}
