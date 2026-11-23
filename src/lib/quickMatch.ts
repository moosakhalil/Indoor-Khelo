// Offline quick match, server side: a match that was set up on a phone with no signal is created here when the signal returns.
// The phone made every id, so sending the same match twice creates it once. Every rule is checked again here and by the database.
import { isUniqueViolation, query, tx } from "@/lib/db";
import type { QuickMatchInput, Roster } from "@/lib/quickMatchRules";

export type QuickOutcome = "ok" | "forbidden" | "not_a_member" | "id_taken" | "same_names" | "bad_lineup";

/** Create the match with the ids the phone gave it, and give the scoring lock to that phone so its events are accepted. */
export async function createQuickMatch(userId: string, communityId: string, deviceId: string, m: QuickMatchInput): Promise<{ outcome: QuickOutcome; duplicate?: boolean }> {
  if (!deviceId || deviceId.length > 80) return { outcome: "forbidden" };
  try {
    return await tx(async (c) => {
      const me = await c.query("select 1 from community_member where community_id = $1 and user_id = $2 and status = 'approved'", [communityId, userId]);
      if (!me.rows.length) return { outcome: "forbidden" as const };

      const have = await c.query<{ community_id: string; created_by: string }>("select community_id, created_by from cricket_match where id = $1", [m.id]);
      if (have.rows.length) {
        const h = have.rows[0]!;
        return h.community_id === communityId && h.created_by === userId ? { outcome: "ok" as const, duplicate: true } : { outcome: "id_taken" as const };
      }
      const memberIds = m.players.filter((p) => p.userId).map((p) => p.userId!);
      if (memberIds.length) {
        const ok = await c.query<{ user_id: string }>("select user_id from community_member where community_id = $1 and status = 'approved' and user_id = any($2::uuid[])", [communityId, memberIds]);
        if (ok.rows.length !== new Set(memberIds).size) return { outcome: "not_a_member" as const };
      }
      await c.query(
        `insert into cricket_match (id, community_id, status, scheduled_at, venue, overs, players_per_side, rules, umpire, notes, created_by, changed_by, scorer_id, scorer_device, scorer_since)
         values ($1, $2, 'scheduled', now(), '', $3, $4, $5, '', '', $6, $6, $6, $7, now())`,
        [m.id, communityId, m.overs, m.playersPerSide, JSON.stringify(m.rules), userId, deviceId],
      );
      for (const [i, s] of m.sides.entries()) await c.query("insert into match_side (id, match_id, position, name) values ($1, $2, $3, $4)", [s.id, m.id, i + 1, s.name]);
      for (const p of m.players) {
        await c.query(
          "insert into match_player (id, match_id, side_id, user_id, guest_name, added_by) values ($1, $2, $3, $4, $5, $6)",
          [p.id, m.id, m.sides[p.side - 1]!.id, p.userId, p.guestName, userId],
        );
      }
      await c.query("insert into audit_log (community_id, actor_id, action, details) values ($1, $2, 'match_created', $3)", [communityId, userId, JSON.stringify({ match: m.id, quick: true })]);
      return { outcome: "ok" as const };
    });
  } catch (err) {
    const msg = (err as { message?: string }).message;
    if (msg === "same_side_name") return { outcome: "same_names" };
    if (msg === "not_a_member") return { outcome: "not_a_member" };
    if (isUniqueViolation(err)) {
      // the same match arrived twice at once: the other copy won, which is fine for the person who made it
      const again = await query<{ community_id: string; created_by: string }>("select community_id, created_by from cricket_match where id = $1", [m.id]);
      if (!again[0]) return { outcome: "bad_lineup" };     // nothing was created: a lineup entry clashed (for example the same member twice)
      if (again[0].community_id === communityId && again[0].created_by === userId) return { outcome: "ok", duplicate: true };
      return { outcome: "id_taken" };
    }
    if ((err as { code?: string }).code === "23514" || (err as { code?: string }).code === "23503") return { outcome: "bad_lineup" };
    throw err;
  }
}

/** The community's players and teams for the phone to keep (members with player numbers; teams with their squads). */
export async function rosterFor(communityId: string, me: string): Promise<Omit<Roster, "savedAt">> {
  const members = await query<{ id: string; name: string; number: number | null; role: string | null }>(
    `select cm.user_id as id, u.name, cm.player_number as number, u.playing_role as role
       from community_member cm join app_user u on u.id = cm.user_id where cm.community_id = $1 and cm.status = 'approved' order by cm.player_number nulls last, lower(u.name)`, [communityId]);
  const teams = await query<{ id: string; name: string; squad: string[] }>(
    `select t.id, t.name, coalesce(array_agg(tp.user_id::text) filter (where tp.user_id is not null), '{}') as squad
       from team t left join team_player tp on tp.team_id = t.id where t.community_id = $1 group by t.id, t.name order by lower(t.name)`, [communityId]);
  return { communityId, me, members, teams };
}
