// Phase 3: teams and permanent squads. Any approved member can create and change teams (open community),
// and every change shows who made it. The squad is the team's regular players; each match picks its own lineup later.
import type { PoolClient } from "pg";
import { isUniqueViolation, one, query, tx } from "@/lib/db";
import { isUuid } from "@/lib/community";
import { isAdminMember, mayManage } from "@/lib/ownerRule";
import type { TeamInput } from "@/lib/validation";

export type TeamRow = {
  id: string;
  community_id: string;
  name: string;
  description: string;
  captain_id: string | null;
  vice_captain_id: string | null;
  captain_name: string | null;
  vice_name: string | null;
  /** Who added the team: they, or an Admin, may delete it (lib/ownerRule.ts). */
  created_by: string | null;
  added_by: string | null;
  changed_by: string | null;
  squad_count: number;
  created_at: Date;
  updated_at: Date;
};

export type SquadMember = { user_id: string; name: string; player_number: number | null; playing_role: string | null };

async function isApproved(c: PoolClient, communityId: string, userId: string): Promise<boolean> {
  const r = await c.query("select 1 from community_member where community_id = $1 and user_id = $2 and status = 'approved'", [communityId, userId]);
  return r.rows.length > 0;
}

async function log(c: PoolClient, communityId: string, actorId: string, action: string, details: Record<string, unknown>) {
  await c.query("insert into audit_log (community_id, actor_id, action, details) values ($1, $2, $3, $4)", [communityId, actorId, action, JSON.stringify(details)]);
}

const TEAM_SELECT = `
  select t.id, t.community_id, t.name, t.description, t.captain_id, t.vice_captain_id, t.created_by,
         cap.name as captain_name, vice.name as vice_name, ab.name as added_by, cb.name as changed_by,
         (select count(*)::int from team_player p where p.team_id = t.id) as squad_count,
         t.created_at, t.updated_at
    from team t
    left join app_user cap on cap.id = t.captain_id
    left join app_user vice on vice.id = t.vice_captain_id
    left join app_user ab on ab.id = t.created_by
    left join app_user cb on cb.id = t.changed_by`;

export async function listTeams(communityId: string): Promise<TeamRow[]> {
  return query<TeamRow>(`${TEAM_SELECT} where t.community_id = $1 order by lower(t.name)`, [communityId]);
}

export async function getTeam(communityId: string, teamId: string): Promise<TeamRow | null> {
  if (!isUuid(teamId)) return null;
  return one<TeamRow>(`${TEAM_SELECT} where t.community_id = $1 and t.id = $2`, [communityId, teamId]);
}

export async function listSquad(teamId: string): Promise<SquadMember[]> {
  return query<SquadMember>(
    `select p.user_id, u.name, m.player_number, u.playing_role
       from team_player p
       join team t on t.id = p.team_id
       join app_user u on u.id = p.user_id
       join community_member m on m.community_id = t.community_id and m.user_id = p.user_id
      where p.team_id = $1
      order by m.player_number nulls last, u.name`,
    [teamId],
  );
}

/** Teams a person plays for, inside one community (shown on their player page). */
export async function teamsOfPlayer(communityId: string, userId: string): Promise<{ id: string; name: string }[]> {
  return query<{ id: string; name: string }>(
    `select t.id, t.name from team t join team_player p on p.team_id = t.id
      where t.community_id = $1 and p.user_id = $2 order by lower(t.name)`,
    [communityId, userId],
  );
}

/** How many matches use this team. A team with matches cannot be deleted. */
export async function teamMatchCount(teamId: string): Promise<number> {
  if (!isUuid(teamId)) return 0;
  const r = await one<{ n: number }>("select count(*)::int as n from match_side where team_id = $1", [teamId]);
  return r?.n ?? 0;
}

export type SaveOutcome = "ok" | "forbidden" | "name_taken" | "not_found" | "bad_person" | "has_matches" | "not_owner";

/** Captain and vice-captain must be approved members; they are put in the squad automatically. */
async function checkLeaders(c: PoolClient, communityId: string, input: TeamInput): Promise<boolean> {
  for (const id of [input.captainId, input.viceCaptainId]) {
    if (id && (!isUuid(id) || !(await isApproved(c, communityId, id)))) return false;
  }
  return true;
}

async function addToSquad(c: PoolClient, teamId: string, userIds: (string | null)[], addedBy: string) {
  for (const id of userIds) {
    if (id) await c.query("insert into team_player (team_id, user_id, added_by) values ($1, $2, $3) on conflict do nothing", [teamId, id, addedBy]);
  }
}

export async function createTeam(userId: string, communityId: string, input: TeamInput): Promise<{ outcome: SaveOutcome; id?: string }> {
  try {
    return await tx(async (c) => {
      if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
      if (!(await checkLeaders(c, communityId, input))) return { outcome: "bad_person" as const };
      const r = await c.query<{ id: string }>(
        `insert into team (community_id, name, description, captain_id, vice_captain_id, created_by, changed_by)
         values ($1, $2, $3, $4, $5, $6, $6) returning id`,
        [communityId, input.name, input.description, input.captainId, input.viceCaptainId, userId],
      );
      const id = r.rows[0]!.id;
      await addToSquad(c, id, [input.captainId, input.viceCaptainId], userId);
      await log(c, communityId, userId, "team_created", { team: id, name: input.name });
      return { outcome: "ok" as const, id };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { outcome: "name_taken" };
    throw err;
  }
}

export async function updateTeam(userId: string, communityId: string, teamId: string, input: TeamInput): Promise<SaveOutcome> {
  try {
    return await tx(async (c) => {
      if (!(await isApproved(c, communityId, userId))) return "forbidden";
      const own = await c.query("select 1 from team where id = $1 and community_id = $2 for update", [teamId, communityId]);
      if (!own.rows.length) return "not_found";
      if (!(await checkLeaders(c, communityId, input))) return "bad_person";
      await c.query(
        "update team set name = $2, description = $3, captain_id = $4, vice_captain_id = $5, changed_by = $6, updated_at = now() where id = $1",
        [teamId, input.name, input.description, input.captainId, input.viceCaptainId, userId],
      );
      await addToSquad(c, teamId, [input.captainId, input.viceCaptainId], userId);
      await log(c, communityId, userId, "team_changed", { team: teamId, name: input.name });
      return "ok";
    });
  } catch (err) {
    if (isUniqueViolation(err)) return "name_taken";
    throw err;
  }
}

/** Replaces the squad. Anyone removed from the squad also stops being captain or vice-captain. */
export async function setSquad(userId: string, communityId: string, teamId: string, memberIds: string[]): Promise<SaveOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const own = await c.query("select 1 from team where id = $1 and community_id = $2 for update", [teamId, communityId]);
    if (!own.rows.length) return "not_found";
    const wanted = Array.from(new Set(memberIds.filter(isUuid)));
    const valid = wanted.length
      ? (await c.query<{ user_id: string }>("select user_id from community_member where community_id = $1 and status = 'approved' and user_id = any($2::uuid[])", [communityId, wanted])).rows.map((r) => r.user_id)
      : [];
    const before = (await c.query<{ user_id: string }>("select user_id from team_player where team_id = $1", [teamId])).rows.map((r) => r.user_id);
    const removed = before.filter((id) => !valid.includes(id));
    const added = valid.filter((id) => !before.includes(id));
    if (removed.length) await c.query("delete from team_player where team_id = $1 and user_id = any($2::uuid[])", [teamId, removed]);
    await addToSquad(c, teamId, added, userId);
    await c.query(
      `update team set captain_id = case when captain_id = any($2::uuid[]) then null else captain_id end,
                       vice_captain_id = case when vice_captain_id = any($2::uuid[]) then null else vice_captain_id end,
                       changed_by = $3, updated_at = now() where id = $1`,
      [teamId, removed, userId],
    );
    if (removed.length || added.length) await log(c, communityId, userId, "squad_changed", { team: teamId, added: added.length, removed: removed.length });
    return "ok";
  });
}

export async function deleteTeam(userId: string, communityId: string, teamId: string): Promise<SaveOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    // Only the person who added the team, or an Admin, can delete it (ownerRule.ts).
    const own = await c.query<{ created_by: string | null }>("select created_by from team where id = $1 and community_id = $2", [teamId, communityId]);
    if (!own.rows.length) return "not_found";
    if (!mayManage({ id: userId, admin: await isAdminMember(c, communityId, userId) }, own.rows[0]!.created_by)) return "not_owner";
    // A team that has matches is protected: its matches would lose their record.
    const used = await c.query("select 1 from match_side s join team t on t.id = s.team_id where s.team_id = $1 and t.community_id = $2 limit 1", [teamId, communityId]);
    if (used.rows.length) return "has_matches";
    const t = await c.query<{ name: string }>("delete from team where id = $1 and community_id = $2 returning name", [teamId, communityId]);
    if (!t.rows.length) return "not_found";
    await log(c, communityId, userId, "team_deleted", { name: t.rows[0]!.name });
    return "ok";
  });
}
