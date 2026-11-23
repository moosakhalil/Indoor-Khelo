// Phase 8: series and tournaments in the database. Any approved member can create, edit, close and reopen (open community),
// and every series shows "Added by" and "Changed by". A match is in at most one series; removing it keeps the match.
import type { PoolClient } from "pg";
import { isUniqueViolation, one, query, tx } from "@/lib/db";
import { isUuid } from "@/lib/community";
import { createRematch } from "@/lib/matches";
import { SERIES_SIDES_MAX, pointsTable, seriesStatus, sidesFit, tally, type Row, type SeriesInput, type SeriesMatch, type SeriesSide, type Status, type Tally } from "@/lib/series";

export type SeriesRow = {
  id: string; community_id: string; name: string; format: "open" | "best_of"; best_of: number | null; starts_on: string | null; ends_on: string | null; notes: string;
  status: "open" | "closed"; created_by_name: string | null; changed_by_name: string | null; created_at: Date; updated_at: Date; match_count: number;
};
export type SeriesMatchRow = {
  id: string; status: string; scheduled_at: Date | null; created_at: Date; overs: number; venue: string; result: { kind?: string; winner?: 1 | 2 | null; text?: string } | null;
  n1: string; t1: string | null; n2: string; t2: string | null;
};
export type SeriesFull = SeriesRow & { sides: SeriesSide[]; matches: SeriesMatchRow[]; tally: Tally; status_view: Status; table: Row[] };

export type SeriesOutcome =
  | "ok" | "forbidden" | "not_found" | "name_taken" | "bad_team" | "bad_match" | "in_other_series" | "bad_state" | "not_in_series" | "side_in_use" | "sides" | "too_few";
export type SeriesResult = { outcome: SeriesOutcome; id?: string; reason?: string; ids?: string[] };

const isApproved = async (c: PoolClient, communityId: string, userId: string) =>
  (await c.query("select 1 from community_member where community_id = $1 and user_id = $2 and status = 'approved'", [communityId, userId])).rows.length > 0;
async function audit(c: PoolClient, communityId: string, actor: string, action: string, details: Record<string, unknown>) {
  await c.query("insert into audit_log (community_id, actor_id, action, details) values ($1, $2, $3, $4)", [communityId, actor, action, JSON.stringify(details)]);
}

const SERIES_SELECT = `
  select s.id, s.community_id, s.name, s.format, s.best_of, to_char(s.starts_on, 'YYYY-MM-DD') as starts_on, to_char(s.ends_on, 'YYYY-MM-DD') as ends_on, s.notes, s.status,
         ab.name as created_by_name, cb.name as changed_by_name, s.created_at, s.updated_at,
         (select count(*)::int from series_match m where m.series_id = s.id) as match_count
    from series s left join app_user ab on ab.id = s.created_by left join app_user cb on cb.id = s.changed_by`;

const MATCH_SELECT = `
  select m.id, m.status, m.scheduled_at, m.created_at, m.overs, m.venue, m.result, s1.name as n1, s1.team_id as t1, s2.name as n2, s2.team_id as t2
    from series_match sm join cricket_match m on m.id = sm.match_id
    join match_side s1 on s1.match_id = m.id and s1.position = 1 join match_side s2 on s2.match_id = m.id and s2.position = 2`;

export const toSeriesMatch = (r: SeriesMatchRow): SeriesMatch => ({
  matchId: r.id, status: r.status, resultKind: (r.result?.kind as SeriesMatch["resultKind"]) ?? null, winnerPosition: r.result?.winner ?? null,
  side1: { name: r.n1, teamId: r.t1 }, side2: { name: r.n2, teamId: r.t2 },
});

async function sidesOf(seriesId: string): Promise<SeriesSide[]> {
  return query<SeriesSide>("select id, name, team_id as \"teamId\" from series_side where series_id = $1 order by lower(name)", [seriesId]);
}
async function matchesOf(seriesId: string): Promise<SeriesMatchRow[]> {
  return query<SeriesMatchRow>(`${MATCH_SELECT} where sm.series_id = $1 order by m.scheduled_at asc nulls last, m.created_at`, [seriesId]);
}

function build(row: SeriesRow, sides: SeriesSide[], matches: SeriesMatchRow[]): SeriesFull {
  const t = tally(sides, matches.map(toSeriesMatch));
  return { ...row, sides, matches, tally: t, status_view: seriesStatus(row.format, row.best_of, row.status === "closed", t), table: pointsTable(t) };
}

/* ---------- reading ---------- */
export async function listSeries(communityId: string): Promise<SeriesFull[]> {
  const rows = await query<SeriesRow>(`${SERIES_SELECT} where s.community_id = $1 order by (s.status = 'open') desc, s.updated_at desc`, [communityId]);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const sides = await query<SeriesSide & { series_id: string }>("select series_id, id, name, team_id as \"teamId\" from series_side where series_id = any($1::uuid[]) order by lower(name)", [ids]);
  const ms = await query<SeriesMatchRow & { series_id: string }>(`${MATCH_SELECT.replace("select m.id,", "select sm.series_id, m.id,")} where sm.series_id = any($1::uuid[]) order by m.scheduled_at asc nulls last, m.created_at`, [ids]);
  return rows.map((r) => build(r, sides.filter((s) => s.series_id === r.id), ms.filter((m) => m.series_id === r.id)));
}

export async function getSeries(communityId: string, id: string): Promise<SeriesFull | null> {
  if (!isUuid(id)) return null;
  const row = await one<SeriesRow>(`${SERIES_SELECT} where s.community_id = $1 and s.id = $2`, [communityId, id]);
  if (!row) return null;
  return build(row, await sidesOf(id), await matchesOf(id));
}

/** The series a match belongs to, if any. */
export async function seriesOfMatch(communityId: string, matchId: string): Promise<{ id: string; name: string; status: "open" | "closed" } | null> {
  if (!isUuid(matchId)) return null;
  return one(`select s.id, s.name, s.status from series_match sm join series s on s.id = sm.series_id where sm.match_id = $1 and s.community_id = $2`, [matchId, communityId]);
}

/** Matches of this community that could be added to a series: not in any series, not abandoned or cancelled. */
export async function matchesAvailable(communityId: string, seriesId: string): Promise<(SeriesMatchRow & { fits: boolean; reason: string | null })[]> {
  const sides = await sidesOf(seriesId);
  const rows = await query<SeriesMatchRow>(
    `select m.id, m.status, m.scheduled_at, m.created_at, m.overs, m.venue, m.result, s1.name as n1, s1.team_id as t1, s2.name as n2, s2.team_id as t2
       from cricket_match m join match_side s1 on s1.match_id = m.id and s1.position = 1 join match_side s2 on s2.match_id = m.id and s2.position = 2
      where m.community_id = $1 and m.status not in ('cancelled', 'abandoned') and not exists (select 1 from series_match sm where sm.match_id = m.id)
      order by m.scheduled_at desc nulls last limit 80`, [communityId]);
  return rows.map((r) => { const f = sidesFit(sides, { side1: { name: r.n1, teamId: r.t1 }, side2: { name: r.n2, teamId: r.t2 } }); return { ...r, fits: f.ok, reason: f.ok ? null : f.reason }; });
}

/* ---------- creating and changing ---------- */
async function checkTeams(c: PoolClient, communityId: string, sides: SeriesSide[]): Promise<boolean> {
  const ids = sides.map((s) => s.teamId).filter((x): x is string => !!x);
  if (!ids.length) return true;
  const r = await c.query("select id from team where community_id = $1 and id = any($2::uuid[])", [communityId, ids]);
  return r.rows.length === new Set(ids).size;
}
async function writeSides(c: PoolClient, seriesId: string, sides: SeriesSide[]) {
  await c.query("delete from series_side where series_id = $1", [seriesId]);
  for (const s of sides) await c.query("insert into series_side (series_id, name, team_id) values ($1, $2, $3)", [seriesId, s.name, s.teamId]);
}

async function insertSeries(c: PoolClient, userId: string, communityId: string, i: SeriesInput): Promise<string> {
  const r = await c.query<{ id: string }>(
    `insert into series (community_id, name, format, best_of, starts_on, ends_on, notes, created_by, changed_by) values ($1, $2, $3, $4, $5, $6, $7, $8, $8) returning id`,
    [communityId, i.name, i.format, i.bestOf, i.startsOn, i.endsOn, i.notes, userId]);
  await writeSides(c, r.rows[0]!.id, i.sides);
  await audit(c, communityId, userId, "series_created", { series: r.rows[0]!.id, name: i.name });
  return r.rows[0]!.id;
}

export async function createSeries(userId: string, communityId: string, i: SeriesInput): Promise<SeriesResult> {
  try {
    return await tx(async (c) => {
      if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
      if (!(await checkTeams(c, communityId, i.sides))) return { outcome: "bad_team" as const };
      return { outcome: "ok" as const, id: await insertSeries(c, userId, communityId, i) };
    });
  } catch (e) { if (isUniqueViolation(e)) return { outcome: "name_taken" }; throw e; }
}

/** Change a series: name, format (including best of 3 to best of 5), dates, notes and teams. A team that already has matches in the series cannot be taken out. */
export async function updateSeries(userId: string, communityId: string, id: string, i: SeriesInput): Promise<SeriesResult> {
  try {
    return await tx(async (c) => {
      if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
      const s = await c.query("select 1 from series where id = $1 and community_id = $2 for update", [id, communityId]);
      if (!s.rows.length) return { outcome: "not_found" as const };
      if (!(await checkTeams(c, communityId, i.sides))) return { outcome: "bad_team" as const };
      const ms = (await c.query<SeriesMatchRow>(`${MATCH_SELECT} where sm.series_id = $1`, [id])).rows.map(toSeriesMatch);
      for (const m of ms) {
        const fit = sidesFit(i.sides, m);
        if (!fit.ok) return { outcome: "side_in_use" as const, reason: `${fit.reason.replace(" Add the team to the series first.", "")} It already has matches in this series, so it cannot be taken out.` };
      }
      await c.query("update series set name = $3, format = $4, best_of = $5, starts_on = $6, ends_on = $7, notes = $8, changed_by = $9, updated_at = now() where id = $1 and community_id = $2",
        [id, communityId, i.name, i.format, i.bestOf, i.startsOn, i.endsOn, i.notes, userId]);
      await writeSides(c, id, i.sides);
      await audit(c, communityId, userId, "series_changed", { series: id });
      return { outcome: "ok" as const };
    });
  } catch (e) { if (isUniqueViolation(e)) return { outcome: "name_taken" }; throw e; }
}

async function setStatus(userId: string, communityId: string, id: string, status: "open" | "closed"): Promise<SeriesOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const r = await c.query<{ status: string }>("select status from series where id = $1 and community_id = $2 for update", [id, communityId]);
    if (!r.rows.length) return "not_found";
    if (r.rows[0]!.status === status) return "bad_state";
    await c.query("update series set status = $3, changed_by = $4, updated_at = now() where id = $1 and community_id = $2", [id, communityId, status, userId]);
    await audit(c, communityId, userId, status === "closed" ? "series_closed" : "series_reopened", { series: id });
    return "ok";
  });
}
export const closeSeries = (userId: string, communityId: string, id: string) => setStatus(userId, communityId, id, "closed");
export const reopenSeries = (userId: string, communityId: string, id: string) => setStatus(userId, communityId, id, "open");

/** Deleting a series keeps every match in it. */
export async function deleteSeries(userId: string, communityId: string, id: string): Promise<SeriesOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const r = await c.query("delete from series where id = $1 and community_id = $2", [id, communityId]);
    if (!r.rowCount) return "not_found";
    await audit(c, communityId, userId, "series_deleted", { series: id });
    return "ok";
  });
}

/* ---------- matches in a series ---------- */
async function attach(c: PoolClient, userId: string, communityId: string, seriesId: string, matchIds: string[], sides: SeriesSide[]): Promise<SeriesResult> {
  const wanted = Array.from(new Set(matchIds.filter(isUuid)));
  if (!wanted.length) return { outcome: "bad_match", reason: "Choose at least one match." };
  const rows = (await c.query<SeriesMatchRow>(
    `select m.id, m.status, m.scheduled_at, m.created_at, m.overs, m.venue, m.result, s1.name as n1, s1.team_id as t1, s2.name as n2, s2.team_id as t2
       from cricket_match m join match_side s1 on s1.match_id = m.id and s1.position = 1 join match_side s2 on s2.match_id = m.id and s2.position = 2
      where m.community_id = $1 and m.id = any($2::uuid[])`, [communityId, wanted])).rows;
  if (rows.length !== wanted.length) return { outcome: "bad_match", reason: "One of those matches is not in this community." };
  const taken = await c.query<{ match_id: string }>("select match_id from series_match where match_id = any($1::uuid[]) and series_id <> $2", [wanted, seriesId]);
  if (taken.rows.length) return { outcome: "in_other_series", reason: "A match can be in only one series. One of these is already in another series." };
  for (const r of rows) {
    if (r.status === "cancelled" || r.status === "abandoned") return { outcome: "bad_match", reason: `${r.n1} v ${r.n2} was ${r.status}, so it cannot be added.` };
    const fit = sidesFit(sides, { side1: { name: r.n1, teamId: r.t1 }, side2: { name: r.n2, teamId: r.t2 } });
    if (!fit.ok) return { outcome: "sides", reason: fit.reason };
  }
  for (const id of wanted) await c.query("insert into series_match (match_id, series_id, added_by) values ($1, $2, $3) on conflict (match_id) do nothing", [id, seriesId, userId]);
  await c.query("update series set changed_by = $2, updated_at = now() where id = $1", [seriesId, userId]);
  await audit(c, communityId, userId, "series_matches_added", { series: seriesId, count: wanted.length });
  return { outcome: "ok", ids: wanted };
}

/** Add matches that already exist (including ones already played). All or none. */
export async function addMatches(userId: string, communityId: string, seriesId: string, matchIds: string[]): Promise<SeriesResult> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
    const s = await c.query<{ status: string }>("select status from series where id = $1 and community_id = $2 for update", [seriesId, communityId]);
    if (!s.rows.length) return { outcome: "not_found" as const };
    if (s.rows[0]!.status === "closed") return { outcome: "bad_state" as const, reason: "This series is closed. Reopen it to add matches." };
    return attach(c, userId, communityId, seriesId, matchIds, await sidesOfTx(c, seriesId));
  });
}
const sidesOfTx = async (c: PoolClient, seriesId: string) => (await c.query<SeriesSide>("select id, name, team_id as \"teamId\" from series_side where series_id = $1", [seriesId])).rows;

export async function removeMatch(userId: string, communityId: string, seriesId: string, matchId: string): Promise<SeriesOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const s = await c.query("select 1 from series where id = $1 and community_id = $2 for update", [seriesId, communityId]);
    if (!s.rows.length) return "not_found";
    const r = await c.query("delete from series_match where series_id = $1 and match_id = $2", [seriesId, matchId]);
    if (!r.rowCount) return "not_in_series";
    await c.query("update series set changed_by = $2, updated_at = now() where id = $1", [seriesId, userId]);
    await audit(c, communityId, userId, "series_match_removed", { series: seriesId, match: matchId });
    return "ok";
  });
}

/** Group matches (for example three already played) into a brand new series. The teams are taken from the matches. */
export async function createSeriesFromMatches(userId: string, communityId: string, name: string | null, matchIds: string[]): Promise<SeriesResult> {
  try {
    return await tx(async (c) => {
      if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
      return fromMatchesTx(c, userId, communityId, name, matchIds);
    });
  } catch (e) { if (e instanceof SeriesAbort) return e.result; if (isUniqueViolation(e)) return { outcome: "name_taken" }; throw e; }
}

async function fromMatchesTx(c: PoolClient, userId: string, communityId: string, name: string | null, matchIds: string[]): Promise<SeriesResult> {
  const wanted = Array.from(new Set(matchIds.filter(isUuid)));
  if (!wanted.length) return { outcome: "bad_match", reason: "Choose at least one match." };
  const rows = (await c.query<SeriesMatchRow>(
    `select m.id, m.status, m.scheduled_at, m.created_at, m.overs, m.venue, m.result, s1.name as n1, s1.team_id as t1, s2.name as n2, s2.team_id as t2
       from cricket_match m join match_side s1 on s1.match_id = m.id and s1.position = 1 join match_side s2 on s2.match_id = m.id and s2.position = 2
      where m.community_id = $1 and m.id = any($2::uuid[]) order by m.scheduled_at nulls last, m.created_at`, [communityId, wanted])).rows;
  if (rows.length !== wanted.length) return { outcome: "bad_match", reason: "One of those matches is not in this community." };
  const sides: SeriesSide[] = [];
  const add = (n: string, t: string | null) => { if (!sides.some((s) => (t && s.teamId === t) || s.name.toLowerCase() === n.trim().toLowerCase())) sides.push({ name: n.trim(), teamId: t }); };
  for (const r of rows) { add(r.n1, r.t1); add(r.n2, r.t2); }
  if (sides.length < 2) return { outcome: "too_few", reason: "A series needs at least two teams." };
  if (sides.length > SERIES_SIDES_MAX) return { outcome: "sides", reason: `Those matches have more than ${SERIES_SIDES_MAX} different teams.` };
  const base = (name ?? "").trim() || (sides.length === 2 ? `${sides[0]!.name} v ${sides[1]!.name}` : `Series of ${rows.length} matches`);
  let chosen = base.slice(0, 60);
  // an automatic name that is taken becomes "Alpha v Bravo (2)", "(3)" ...
  if (!name?.trim()) {
    for (let n = 2; (await c.query("select 1 from series where community_id = $1 and lower(btrim(name)) = lower($2)", [communityId, chosen])).rows.length && n < 50; n++) chosen = `${base.slice(0, 54)} (${n})`;
  }
  const id = await insertSeries(c, userId, communityId, { name: chosen, format: "open", bestOf: null, startsOn: null, endsOn: null, notes: "", sides });
  const r = await attach(c, userId, communityId, id, wanted, sides);
  if (r.outcome !== "ok") throw new SeriesAbort(r);
  return { outcome: "ok", id };
}
class SeriesAbort extends Error { constructor(public result: SeriesResult) { super("series_abort"); } }

/**
 * "Play another match in this series": a rematch of the latest match in the series, with a fresh date, added to the series.
 * Always available while the series is open.
 */
export async function playAnother(userId: string, communityId: string, seriesId: string, when: Date): Promise<SeriesResult> {
  const s = await getSeries(communityId, seriesId);
  if (!s) return { outcome: "not_found" };
  if (s.status === "closed") return { outcome: "bad_state", reason: "This series is closed. Reopen it to play another match." };
  const latest = [...s.matches].filter((m) => m.status !== "cancelled" && m.status !== "abandoned").sort((a, b) => (b.scheduled_at?.getTime() ?? b.created_at.getTime()) - (a.scheduled_at?.getTime() ?? a.created_at.getTime()))[0];
  if (!latest) return { outcome: "bad_match", reason: "Add a match to the series first. Then you can play another." };
  const r = await createRematch(userId, communityId, latest.id, when);
  if (r.outcome !== "ok" || !r.id) return { outcome: r.outcome === "forbidden" ? "forbidden" : "bad_match", reason: "The match could not be created." };
  const joined = await addMatches(userId, communityId, seriesId, [r.id]);
  return joined.outcome === "ok" ? { outcome: "ok", id: r.id } : joined;
}

/** "Make this a series" on a rematch: a new series between the same two teams with the first match and the rematch in it. */
export async function makeSeriesFromRematch(userId: string, communityId: string, firstMatchId: string, rematchId: string): Promise<SeriesResult> {
  return createSeriesFromMatches(userId, communityId, null, [firstMatchId, rematchId]);
}
