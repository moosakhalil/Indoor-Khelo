// Phase 4: creating and planning matches. Any approved member can create and change matches (open community) and every
// change shows who made it. Rules are checked here on the server, and again by database constraints.
import type { PoolClient } from "pg";
import { isUniqueViolation, one, query, tx } from "@/lib/db";
import { isUuid } from "@/lib/community";
import { NOT_STARTED, type MatchInput, type MatchStatus, type Rules } from "@/lib/matchRules";

export type MatchRow = {
  id: string;
  community_id: string;
  status: MatchStatus;
  scheduled_at: Date | null;
  venue: string;
  overs: number;
  players_per_side: number;
  rules: Rules;
  umpire: string;
  notes: string;
  toss_winner_side: number | null;
  toss_decision: "bat" | "bowl" | null;
  batting_first_side: number | null;
  rematch_of: string | null;
  last_reminder_at: Date | null;
  created_by_name: string | null;
  changed_by_name: string | null;
  created_at: Date;
  updated_at: Date;
  side1_id: string; side1_name: string; side1_team: string | null;
  side2_id: string; side2_name: string; side2_team: string | null;
  in_count: number; out_count: number; member_count: number;
  my_answer: "in" | "out" | null;
};

export type LineupEntry = {
  id: string;
  side_id: string;
  position: 1 | 2;
  user_id: string | null;
  guest_name: string | null;
  name: string;
  player_number: number | null;
  playing_role: string | null;
  kind: "member" | "guest" | "linked";
  linked_by_name: string | null;
};

export type Reply = { user_id: string; name: string; player_number: number | null; answer: "in" | "out" | null };

const isNotStarted = (s: string) => (NOT_STARTED as readonly string[]).includes(s);

export const noReplyCount = (m: Pick<MatchRow, "in_count" | "out_count" | "member_count">) => Math.max(0, m.member_count - m.in_count - m.out_count);

async function isApproved(c: PoolClient, communityId: string, userId: string): Promise<boolean> {
  const r = await c.query("select 1 from community_member where community_id = $1 and user_id = $2 and status = 'approved'", [communityId, userId]);
  return r.rows.length > 0;
}

async function log(c: PoolClient, communityId: string, actorId: string, action: string, details: Record<string, unknown>) {
  await c.query("insert into audit_log (community_id, actor_id, action, details) values ($1, $2, $3, $4)", [communityId, actorId, action, JSON.stringify(details)]);
}

async function alertMembers(c: PoolClient, communityId: string, matchId: string, kind: string, message: string, except: string | null, onlyNoReply = false) {
  await c.query(
    `insert into app_alert (community_id, user_id, match_id, kind, message)
     select $1, cm.user_id, $2, $3, $4 from community_member cm
      where cm.community_id = $1 and cm.status = 'approved' and ($5::uuid is null or cm.user_id <> $5)
        and (not $6 or not exists (select 1 from match_availability a where a.match_id = $2 and a.user_id = cm.user_id))`,
    [communityId, matchId, kind, message, except, onlyNoReply],
  );
}

const SELECT = `
  select m.id, m.community_id, m.status, m.scheduled_at, m.venue, m.overs, m.players_per_side, m.rules, m.umpire, m.notes,
         m.toss_winner_side, m.toss_decision, m.batting_first_side, m.rematch_of, m.last_reminder_at,
         ab.name as created_by_name, cb.name as changed_by_name, m.created_at, m.updated_at,
         s1.id as side1_id, s1.name as side1_name, s1.team_id as side1_team,
         s2.id as side2_id, s2.name as side2_name, s2.team_id as side2_team,
         (select count(*)::int from match_availability a join community_member cm on cm.community_id = m.community_id and cm.user_id = a.user_id and cm.status = 'approved'
           where a.match_id = m.id and a.answer = 'in') as in_count,
         (select count(*)::int from match_availability a join community_member cm on cm.community_id = m.community_id and cm.user_id = a.user_id and cm.status = 'approved'
           where a.match_id = m.id and a.answer = 'out') as out_count,
         (select count(*)::int from community_member cm where cm.community_id = m.community_id and cm.status = 'approved') as member_count,
         (select a.answer from match_availability a where a.match_id = m.id and a.user_id = $1) as my_answer
    from cricket_match m
    join match_side s1 on s1.match_id = m.id and s1.position = 1
    join match_side s2 on s2.match_id = m.id and s2.position = 2
    left join app_user ab on ab.id = m.created_by
    left join app_user cb on cb.id = m.changed_by`;

export async function listMatches(communityId: string, viewerId: string): Promise<MatchRow[]> {
  return query<MatchRow>(`${SELECT} where m.community_id = $2 order by m.scheduled_at asc nulls last, m.created_at desc`, [viewerId, communityId]);
}

export async function getMatch(communityId: string, matchId: string, viewerId: string): Promise<MatchRow | null> {
  if (!isUuid(matchId)) return null;
  return one<MatchRow>(`${SELECT} where m.community_id = $2 and m.id = $3`, [viewerId, communityId, matchId]);
}

/** The next match to play: soonest upcoming, used on Home. */
export async function nextMatch(communityId: string, viewerId: string): Promise<MatchRow | null> {
  return one<MatchRow>(
    `${SELECT} where m.community_id = $2 and m.status = 'scheduled' and m.scheduled_at >= now() - interval '12 hours'
      order by m.scheduled_at asc limit 1`,
    [viewerId, communityId],
  );
}

/** A match being played right now (live or paused), for the Home screen. */
export async function liveMatch(communityId: string, viewerId: string): Promise<MatchRow | null> {
  return one<MatchRow>(`${SELECT} where m.community_id = $2 and m.status in ('live', 'paused') order by m.updated_at desc limit 1`, [viewerId, communityId]);
}

export async function listLineup(communityId: string, matchId: string): Promise<LineupEntry[]> {
  return query<LineupEntry>(
    `select p.id, p.side_id, s.position, p.user_id, p.guest_name,
            case when p.guest_name is not null then p.guest_name else u.name end as name,
            case when p.guest_name is null then cm.player_number else null end as player_number,
            u.playing_role,
            case when p.user_id is null then 'guest' when p.guest_name is null then 'member' else 'linked' end as kind,
            lb.name as linked_by_name
       from match_player p
       join match_side s on s.id = p.side_id
       left join app_user u on u.id = p.user_id
       left join community_member cm on cm.community_id = $2 and cm.user_id = p.user_id
       left join app_user lb on lb.id = p.linked_by
      where p.match_id = $1
      order by s.position, p.added_at, p.id`,
    [matchId, communityId],
  );
}

/** Every approved member with their "Are you coming?" answer (or none). */
export async function listReplies(communityId: string, matchId: string): Promise<Reply[]> {
  return query<Reply>(
    `select cm.user_id, u.name, cm.player_number, a.answer
       from community_member cm
       join app_user u on u.id = cm.user_id
       left join match_availability a on a.match_id = $2 and a.user_id = cm.user_id
      where cm.community_id = $1 and cm.status = 'approved'
      order by cm.player_number nulls last, u.name`,
    [communityId, matchId],
  );
}

export async function teamNames(communityId: string): Promise<Map<string, string>> {
  const rows = await query<{ id: string; name: string }>("select id, name from team where community_id = $1 order by lower(name)", [communityId]);
  return new Map(rows.map((r) => [r.id, r.name]));
}

export type CreateOutcome = "ok" | "forbidden" | "bad_team" | "same_names" | "not_found";

const STATUS_FOR = (when: Date | null): MatchStatus => (when ? "scheduled" : "draft");

async function insertMatch(
  c: PoolClient, userId: string, communityId: string, sides: MatchInput["sides"], d: Omit<MatchInput, "sides">, rematchOf: string | null,
): Promise<string | "bad_team"> {
  for (const s of sides) {
    if (s.teamId) {
      const t = await c.query("select 1 from team where id = $1 and community_id = $2", [s.teamId, communityId]);
      if (!t.rows.length) return "bad_team";
    }
  }
  const r = await c.query<{ id: string }>(
    `insert into cricket_match (community_id, status, scheduled_at, venue, overs, players_per_side, rules, umpire, notes, rematch_of, created_by, changed_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11) returning id`,
    [communityId, STATUS_FOR(d.scheduledAt), d.scheduledAt, d.venue, d.overs, d.playersPerSide, JSON.stringify(d.rules), d.umpire, d.notes, rematchOf, userId],
  );
  const id = r.rows[0]!.id;
  for (const [i, s] of sides.entries()) {
    await c.query("insert into match_side (match_id, position, name, team_id) values ($1, $2, $3, $4)", [id, i + 1, s.name, s.teamId]);
  }
  await log(c, communityId, userId, "match_created", { match: id, rematch: rematchOf !== null });
  if (d.scheduledAt) await alertMembers(c, communityId, id, "match_scheduled", `New match: ${sides[0].name} v ${sides[1].name}. Are you coming?`, userId);
  return id;
}

export async function createMatch(userId: string, communityId: string, input: MatchInput): Promise<{ outcome: CreateOutcome; id?: string }> {
  try {
    return await tx(async (c) => {
      if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
      const { sides, ...details } = input;
      const id = await insertMatch(c, userId, communityId, sides, details, null);
      if (id === "bad_team") return { outcome: "bad_team" as const };
      return { outcome: "ok" as const, id };
    });
  } catch (err) {
    if (isSameSideName(err)) return { outcome: "same_names" };
    throw err;
  }
}

const isSameSideName = (err: unknown) => typeof err === "object" && err !== null && (err as { message?: string }).message === "same_side_name";

/** Several matches at once: each one is an independent match with its own date, time, venue and overs. */
export async function createSeveral(
  userId: string, communityId: string, sides: MatchInput["sides"], items: Omit<MatchInput, "sides">[],
): Promise<{ outcome: CreateOutcome; ids?: string[] }> {
  try {
    return await tx(async (c) => {
      if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
      const ids: string[] = [];
      for (const d of items) {
        const id = await insertMatch(c, userId, communityId, sides, d, null);
        if (id === "bad_team") return { outcome: "bad_team" as const };
        ids.push(id);
      }
      return { outcome: "ok" as const, ids };
    });
  } catch (err) {
    if (isSameSideName(err)) return { outcome: "same_names" };
    throw err;
  }
}

/**
 * Rematch: same two teams, venue, overs and rules; lineups copied (and editable); a fresh date. A separate match:
 * the first match and the permanent squads are never changed. Linked guests are copied as members; people who left are skipped.
 */
export async function createRematch(userId: string, communityId: string, sourceId: string, when: Date): Promise<{ outcome: CreateOutcome; id?: string }> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
    const src = await c.query<{ id: string; venue: string; overs: number; players_per_side: number; rules: Rules }>(
      "select id, venue, overs, players_per_side, rules from cricket_match where id = $1 and community_id = $2", [sourceId, communityId]);
    if (!src.rows.length) return { outcome: "not_found" as const };
    const m = src.rows[0]!;
    const sidesRows = await c.query<{ id: string; position: number; name: string; team_id: string | null }>(
      "select id, position, name, team_id from match_side where match_id = $1 order by position", [sourceId]);
    // A permanent team that has since been deleted cannot be a side any more, so it becomes a match-only team of the same name.
    const sides = await Promise.all(sidesRows.rows.map(async (s) => {
      if (!s.team_id) return { teamId: null, name: s.name };
      const t = await c.query<{ name: string }>("select name from team where id = $1 and community_id = $2", [s.team_id, communityId]);
      return t.rows.length ? { teamId: s.team_id, name: t.rows[0]!.name } : { teamId: null, name: s.name };
    }));
    const details = { scheduledAt: when, venue: m.venue, overs: m.overs, playersPerSide: m.players_per_side, rules: m.rules, umpire: "", notes: "", warning: null };
    const id = await insertMatch(c, userId, communityId, [sides[0]!, sides[1]!], details, sourceId);
    if (id === "bad_team") return { outcome: "bad_team" as const };
    const newSides = await c.query<{ id: string; position: number }>("select id, position from match_side where match_id = $1", [id]);
    const sideOf = new Map(newSides.rows.map((s) => [s.position, s.id]));
    const oldPos = new Map(sidesRows.rows.map((s) => [s.id, s.position]));
    const players = await c.query<{ side_id: string; user_id: string | null; guest_name: string | null }>(
      "select side_id, user_id, guest_name from match_player where match_id = $1 order by added_at, id", [sourceId]);
    for (const p of players.rows) {
      const newSide = sideOf.get(oldPos.get(p.side_id)!)!;
      if (p.user_id) {
        if (!(await isApproved(c, communityId, p.user_id))) continue;
        await c.query("insert into match_player (match_id, side_id, user_id, added_by) values ($1, $2, $3, $4) on conflict do nothing", [id, newSide, p.user_id, userId]);
      } else {
        await c.query("insert into match_player (match_id, side_id, guest_name, added_by) values ($1, $2, $3, $4) on conflict do nothing", [id, newSide, p.guest_name, userId]);
      }
    }
    return { outcome: "ok" as const, id };
  });
}

export type ChangeOutcome =
  | "ok" | "forbidden" | "not_found" | "locked" | "bad_state" | "too_many" | "no_date"
  | "not_a_member" | "already_in_match" | "duplicate_guest" | "too_soon" | "nobody" | "bad_side";

/** Lock the match row and check the person and the status. */
async function openMatch(c: PoolClient, userId: string, communityId: string, matchId: string): Promise<
  { ok: false; outcome: "forbidden" | "not_found" } | { ok: true; status: MatchStatus; overs: number; playersPerSide: number; rules: Rules; scheduledAt: Date | null; sideNames: string[]; lastReminderAt: Date | null }
> {
  if (!isUuid(matchId) || !isUuid(communityId)) return { ok: false, outcome: "not_found" };
  if (!(await isApproved(c, communityId, userId))) return { ok: false, outcome: "forbidden" };
  const r = await c.query<{ status: MatchStatus; overs: number; players_per_side: number; rules: Rules; scheduled_at: Date | null; last_reminder_at: Date | null }>(
    "select status, overs, players_per_side, rules, scheduled_at, last_reminder_at from cricket_match where id = $1 and community_id = $2 for update", [matchId, communityId]);
  if (!r.rows.length) return { ok: false, outcome: "not_found" };
  const m = r.rows[0]!;
  const sides = await c.query<{ name: string }>("select name from match_side where match_id = $1 order by position", [matchId]);
  return { ok: true, status: m.status, overs: m.overs, playersPerSide: m.players_per_side, rules: m.rules, scheduledAt: m.scheduled_at, sideNames: sides.rows.map((s) => s.name), lastReminderAt: m.last_reminder_at };
}

const touch = (c: PoolClient, matchId: string, userId: string) =>
  c.query("update cricket_match set changed_by = $2, updated_at = now() where id = $1", [matchId, userId]);

class LineupFull extends Error { constructor(public sideName: string, public max: number) { super("lineup_full"); } }
export type TooMany = { side: string; max: number };

async function sideCounts(c: PoolClient, matchId: string, max: number) {
  const r = await c.query<{ name: string; n: number }>(
    `select s.name, count(p.id)::int as n from match_side s left join match_player p on p.side_id = s.id where s.match_id = $1 group by s.id, s.name`, [matchId]);
  for (const row of r.rows) if (row.n > max) throw new LineupFull(row.name, max);
}

/** Edit date, venue, overs, players per side, rules, umpire and notes. Teams stay as they are. Only before the match starts. */
export async function updateMatch(
  userId: string, communityId: string, matchId: string, d: Omit<MatchInput, "sides">,
): Promise<{ outcome: ChangeOutcome; tooMany?: TooMany }> {
  try {
    return await tx(async (c) => {
      const m = await openMatch(c, userId, communityId, matchId);
      if (!m.ok) return { outcome: m.outcome };
      if (!isNotStarted(m.status)) return { outcome: "locked" as const };
      // A new date moves a draft or postponed match to scheduled; clearing the date of a scheduled match makes it a draft.
      const status: MatchStatus = d.scheduledAt ? "scheduled" : m.status === "postponed" ? "postponed" : "draft";
      await c.query(
        `update cricket_match set status = $2, scheduled_at = $3, venue = $4, overs = $5, players_per_side = $6, rules = $7, umpire = $8, notes = $9,
                changed_by = $10, updated_at = now() where id = $1`,
        [matchId, status, d.scheduledAt, d.venue, d.overs, d.playersPerSide, JSON.stringify(d.rules), d.umpire, d.notes, userId],
      );
      await sideCounts(c, matchId, d.playersPerSide);
      const moved = (m.scheduledAt?.getTime() ?? null) !== (d.scheduledAt?.getTime() ?? null);
      if (moved && d.scheduledAt) {
        const title = `${m.sideNames[0]} v ${m.sideNames[1]}`;
        if (m.status === "draft") await alertMembers(c, communityId, matchId, "match_scheduled", `New match: ${title}. Are you coming?`, userId);
        else await alertMembers(c, communityId, matchId, "match_changed", `${title} has a new date or time.`, userId);
      }
      await log(c, communityId, userId, "match_changed", { match: matchId });
      return { outcome: "ok" as const };
    });
  } catch (err) {
    if (err instanceof LineupFull) return { outcome: "too_many", tooMany: { side: err.sideName, max: err.max } };
    throw err;
  }
}

export async function postponeMatch(userId: string, communityId: string, matchId: string): Promise<ChangeOutcome> {
  return tx(async (c) => {
    const m = await openMatch(c, userId, communityId, matchId);
    if (!m.ok) return m.outcome;
    if (m.status !== "scheduled" && m.status !== "draft") return "bad_state";
    await c.query("update cricket_match set status = 'postponed', changed_by = $2, updated_at = now() where id = $1", [matchId, userId]);
    await alertMembers(c, communityId, matchId, "match_postponed", `${m.sideNames[0]} v ${m.sideNames[1]} has been postponed.`, userId);
    await log(c, communityId, userId, "match_postponed", { match: matchId });
    return "ok";
  });
}

export async function cancelMatch(userId: string, communityId: string, matchId: string): Promise<ChangeOutcome> {
  return tx(async (c) => {
    const m = await openMatch(c, userId, communityId, matchId);
    if (!m.ok) return m.outcome;
    if (!isNotStarted(m.status)) return "bad_state";
    await c.query("update cricket_match set status = 'cancelled', changed_by = $2, updated_at = now() where id = $1", [matchId, userId]);
    await alertMembers(c, communityId, matchId, "match_cancelled", `${m.sideNames[0]} v ${m.sideNames[1]} has been cancelled.`, userId);
    await log(c, communityId, userId, "match_cancelled", { match: matchId });
    return "ok";
  });
}

/** Only a match that never started can be deleted. Played matches carry records and stay. */
export async function deleteMatch(userId: string, communityId: string, matchId: string): Promise<ChangeOutcome> {
  return tx(async (c) => {
    const m = await openMatch(c, userId, communityId, matchId);
    if (!m.ok) return m.outcome;
    if (!isNotStarted(m.status) && m.status !== "cancelled") return "bad_state";
    await c.query("delete from cricket_match where id = $1", [matchId]);
    await log(c, communityId, userId, "match_deleted", { match: matchId });
    return "ok";
  });
}

/* ---------- "Are you coming?" ---------- */
export async function setAvailability(userId: string, communityId: string, matchId: string, answer: string): Promise<ChangeOutcome> {
  if (answer !== "in" && answer !== "out") return "bad_state";
  return tx(async (c) => {
    const m = await openMatch(c, userId, communityId, matchId);
    if (!m.ok) return m.outcome;
    if (!isNotStarted(m.status)) return "locked";   // replies can be changed until the match starts
    await c.query(
      `insert into match_availability (match_id, user_id, answer) values ($1, $2, $3)
       on conflict (match_id, user_id) do update set answer = excluded.answer, updated_at = now()`,
      [matchId, userId, answer],
    );
    return "ok";
  });
}

/** One more alert to the people who have not replied. At most once an hour per match, so nobody is spammed. */
export const REMINDER_GAP_MINUTES = 60;
export async function remindNoReplies(userId: string, communityId: string, matchId: string): Promise<{ outcome: ChangeOutcome; sent?: number; waitMinutes?: number }> {
  return tx(async (c) => {
    const m = await openMatch(c, userId, communityId, matchId);
    if (!m.ok) return { outcome: m.outcome };
    if (m.status !== "scheduled") return { outcome: "bad_state" as const };
    if (m.lastReminderAt) {
      const waited = (Date.now() - m.lastReminderAt.getTime()) / 60000;
      if (waited < REMINDER_GAP_MINUTES) return { outcome: "too_soon" as const, waitMinutes: Math.ceil(REMINDER_GAP_MINUTES - waited) };
    }
    const r = await c.query(
      `insert into app_alert (community_id, user_id, match_id, kind, message)
       select $1, cm.user_id, $2, 'match_reminder', $3 from community_member cm
        where cm.community_id = $1 and cm.status = 'approved' and cm.user_id <> $4
          and not exists (select 1 from match_availability a where a.match_id = $2 and a.user_id = cm.user_id)`,
      [communityId, matchId, `Reminder: ${m.sideNames[0]} v ${m.sideNames[1]}. Please reply “I’m in” or “Can’t make it”.`, userId],
    );
    if (!r.rowCount) return { outcome: "nobody" as const };
    await c.query("update cricket_match set last_reminder_at = now() where id = $1", [matchId]);
    return { outcome: "ok" as const, sent: r.rowCount };
  });
}

/* ---------- lineups, guests and links ---------- */

/** Assign members and guests to a side, or take them out (side 0). People not mentioned are left as they are. */
export async function setLineup(
  userId: string, communityId: string, matchId: string, members: Map<string, 0 | 1 | 2>, guests: Map<string, 0 | 1 | 2>,
): Promise<{ outcome: ChangeOutcome; tooMany?: TooMany }> {
  try {
    return await tx(async (c) => {
      const m = await openMatch(c, userId, communityId, matchId);
      if (!m.ok) return { outcome: m.outcome };
      if (!isNotStarted(m.status)) return { outcome: "locked" as const };
      const sideRows = await c.query<{ id: string; position: 1 | 2 }>("select id, position from match_side where match_id = $1", [matchId]);
      const sideId = new Map(sideRows.rows.map((s) => [s.position, s.id]));

      const ids = Array.from(members.keys()).filter(isUuid);
      const valid = new Set(ids.length
        ? (await c.query<{ user_id: string }>("select user_id from community_member where community_id = $1 and status = 'approved' and user_id = any($2::uuid[])", [communityId, ids])).rows.map((r) => r.user_id)
        : []);
      for (const [uid, side] of members) {
        if (!valid.has(uid)) { if (side !== 0) return { outcome: "not_a_member" as const }; continue; }
        if (side === 0) {
          await c.query("delete from match_player where match_id = $1 and user_id = $2", [matchId, uid]);
        } else {
          const upd = await c.query("update match_player set side_id = $3 where match_id = $1 and user_id = $2", [matchId, uid, sideId.get(side)]);
          if (!upd.rowCount) await c.query("insert into match_player (match_id, side_id, user_id, added_by) values ($1, $2, $3, $4)", [matchId, sideId.get(side), uid, userId]);
        }
      }
      for (const [rowId, side] of guests) {
        if (!isUuid(rowId)) continue;
        if (side === 0) await c.query("delete from match_player where match_id = $1 and id = $2 and guest_name is not null", [matchId, rowId]);
        else await c.query("update match_player set side_id = $3 where match_id = $1 and id = $2 and guest_name is not null", [matchId, rowId, sideId.get(side)]);
      }
      await sideCounts(c, matchId, m.playersPerSide);
      await touch(c, matchId, userId);
      await log(c, communityId, userId, "lineup_changed", { match: matchId });
      return { outcome: "ok" as const };
    });
  } catch (err) {
    if (err instanceof LineupFull) return { outcome: "too_many", tooMany: { side: err.sideName, max: err.max } };
    throw err;
  }
}

/** "Add everyone who is in": adds every member who replied "I'm in" and is not on a side yet, until the side is full. */
export async function fillWithIn(userId: string, communityId: string, matchId: string, position: number): Promise<{ outcome: ChangeOutcome; added?: number; skipped?: number }> {
  if (position !== 1 && position !== 2) return { outcome: "bad_side" };
  return tx(async (c) => {
    const m = await openMatch(c, userId, communityId, matchId);
    if (!m.ok) return { outcome: m.outcome };
    if (!isNotStarted(m.status)) return { outcome: "locked" as const };
    const side = (await c.query<{ id: string }>("select id from match_side where match_id = $1 and position = $2", [matchId, position])).rows[0]!;
    const have = (await c.query<{ n: number }>("select count(*)::int as n from match_player where side_id = $1", [side.id])).rows[0]!.n;
    const room = Math.max(0, m.playersPerSide - have);
    const cands = await c.query<{ user_id: string }>(
      `select a.user_id from match_availability a
         join community_member cm on cm.community_id = $1 and cm.user_id = a.user_id and cm.status = 'approved'
        where a.match_id = $2 and a.answer = 'in'
          and not exists (select 1 from match_player p where p.match_id = $2 and p.user_id = a.user_id)
        order by cm.player_number nulls last, a.updated_at`,
      [communityId, matchId],
    );
    const take = cands.rows.slice(0, room);
    for (const r of take) await c.query("insert into match_player (match_id, side_id, user_id, added_by) values ($1, $2, $3, $4)", [matchId, side.id, r.user_id, userId]);
    if (take.length) { await touch(c, matchId, userId); await log(c, communityId, userId, "lineup_changed", { match: matchId }); }
    return { outcome: "ok" as const, added: take.length, skipped: cands.rows.length - take.length };
  });
}

/** Any member can add a guest by typing a name. A guest has no account and no player number. */
export async function addGuest(userId: string, communityId: string, matchId: string, position: number, name: string): Promise<{ outcome: ChangeOutcome; tooMany?: TooMany }> {
  if (position !== 1 && position !== 2) return { outcome: "bad_side" };
  try {
    return await tx(async (c) => {
      const m = await openMatch(c, userId, communityId, matchId);
      if (!m.ok) return { outcome: m.outcome };
      if (!isNotStarted(m.status)) return { outcome: "locked" as const };
      const side = (await c.query<{ id: string }>("select id from match_side where match_id = $1 and position = $2", [matchId, position])).rows[0]!;
      await c.query("insert into match_player (match_id, side_id, guest_name, added_by) values ($1, $2, $3, $4)", [matchId, side.id, name, userId]);
      await sideCounts(c, matchId, m.playersPerSide);
      await touch(c, matchId, userId);
      await log(c, communityId, userId, "guest_added", { match: matchId });
      return { outcome: "ok" as const };
    });
  } catch (err) {
    if (err instanceof LineupFull) return { outcome: "too_many", tooMany: { side: err.sideName, max: err.max } };
    if (isUniqueViolation(err)) return { outcome: "duplicate_guest" };
    throw err;
  }
}

/** Link a guest entry to a member (any approved member can). Shows "Linked by"; can be undone. Allowed on played matches too. */
export async function linkGuest(userId: string, communityId: string, matchId: string, entryId: string, targetId: string): Promise<ChangeOutcome> {
  if (!isUuid(entryId) || !isUuid(targetId)) return "not_found";
  try {
    return await tx(async (c) => {
      const m = await openMatch(c, userId, communityId, matchId);
      if (!m.ok) return m.outcome;
      if (!(await isApproved(c, communityId, targetId))) return "not_a_member";
      const e = await c.query<{ user_id: string | null; guest_name: string | null }>("select user_id, guest_name from match_player where id = $1 and match_id = $2 for update", [entryId, matchId]);
      if (!e.rows.length || !e.rows[0]!.guest_name) return "not_found";
      if (e.rows[0]!.user_id) return "bad_state";
      await c.query("update match_player set user_id = $2, linked_by = $3, linked_at = now() where id = $1", [entryId, targetId, userId]);
      await touch(c, matchId, userId);
      await log(c, communityId, userId, "guest_linked", { match: matchId, user: targetId });
      return "ok";
    });
  } catch (err) {
    if (isUniqueViolation(err)) return "already_in_match";
    throw err;
  }
}

export async function unlinkGuest(userId: string, communityId: string, matchId: string, entryId: string): Promise<ChangeOutcome> {
  if (!isUuid(entryId)) return "not_found";
  return tx(async (c) => {
    const m = await openMatch(c, userId, communityId, matchId);
    if (!m.ok) return m.outcome;
    const r = await c.query("update match_player set user_id = null, linked_by = null, linked_at = null where id = $1 and match_id = $2 and linked_by is not null", [entryId, matchId]);
    if (!r.rowCount) return "not_found";
    await touch(c, matchId, userId);
    await log(c, communityId, userId, "guest_unlinked", { match: matchId });
    return "ok";
  });
}

/* ---------- toss ---------- */
export async function setToss(userId: string, communityId: string, matchId: string, t: { winnerSide: 1 | 2 | null; decision: "bat" | "bowl" | null; battingFirst: 1 | 2 | null }): Promise<ChangeOutcome> {
  return tx(async (c) => {
    const m = await openMatch(c, userId, communityId, matchId);
    if (!m.ok) return m.outcome;
    if (!isNotStarted(m.status)) return "locked";
    await c.query("update cricket_match set toss_winner_side = $2, toss_decision = $3, batting_first_side = $4, changed_by = $5, updated_at = now() where id = $1",
      [matchId, t.winnerSide, t.decision, t.battingFirst, userId]);
    await log(c, communityId, userId, "toss_set", { match: matchId });
    return "ok";
  });
}

/* ---------- alerts ---------- */
export type AlertRow = { id: string; match_id: string | null; booking_id: string | null; kind: string; message: string; created_at: Date; read_at: Date | null; scheduled_at: Date | null; status: string | null };

export async function listAlerts(userId: string, communityId: string, limit = 50): Promise<AlertRow[]> {
  return query<AlertRow>(
    `select a.id, a.match_id, a.booking_id, a.kind, a.message, a.created_at, a.read_at, m.scheduled_at, m.status
       from app_alert a left join cricket_match m on m.id = a.match_id
      where a.user_id = $1 and a.community_id = $2 order by a.created_at desc limit $3`,
    [userId, communityId, limit],
  );
}
export async function unreadAlertCount(userId: string, communityId: string): Promise<number> {
  const r = await one<{ n: number }>("select count(*)::int as n from app_alert where user_id = $1 and community_id = $2 and read_at is null", [userId, communityId]);
  return r?.n ?? 0;
}
export async function markAlertsRead(userId: string, communityId: string) {
  await query("update app_alert set read_at = now() where user_id = $1 and community_id = $2 and read_at is null", [userId, communityId]);
}
