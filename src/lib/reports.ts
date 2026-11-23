// Phase 6: saving and reading statistics. Figures are never typed in: they are worked out from the ball-by-ball log
// when a match finishes and worked out again after every correction.
import { randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query, tx } from "@/lib/db";
import { isUuid } from "@/lib/community";
import { buildState } from "@/lib/engine/engine";
import { parseEvent } from "@/lib/engine/parse";
import type { MatchState, ScoreEvent, Side } from "@/lib/engine/types";
import { careerOf, type Career, type MatchLine } from "@/lib/career";
import { computeMatchStats, type PlayerMatch } from "@/lib/stats";

export type Scores = { innings: number; batting: Side; runs: number; wickets: number; balls: number; superOver: boolean }[];

/** Rewrite one match's rows from its log. A match that is not a completed result has no rows (abandoned matches are not counted). */
export async function recalcMatchStats(c: PoolClient, matchId: string, state: MatchState) {
  await c.query("delete from match_stat where match_id = $1", [matchId]);
  const scores: Scores = state.innings.map((i) => ({ innings: i.index, batting: i.batting, runs: i.runs, wickets: i.wickets, balls: i.legalBalls, superOver: i.superOver }));
  await c.query("update cricket_match set scores = $2 where id = $1", [matchId, JSON.stringify(scores)]);
  if (state.phase !== "finished" || !state.result || state.result.kind === "abandoned") return;
  const { players } = computeMatchStats(state);
  for (const p of players) {
    const entry = state.players[p.entryId]!;
    await c.query(
      `insert into match_stat (match_id, entry_id, side, name, number_used, result, points, pom, data) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [matchId, p.entryId, p.side, p.name, entry.number, p.result, p.points, p.pom, JSON.stringify({ bat: p.bat, bowl: p.bowl, field: p.field, partnerships: p.partnerships })],
    );
  }
}

/* ---------- corrections to a finished match ---------- */
export type CorrectOutcome = "ok" | "forbidden" | "not_found" | "not_finished" | "refused" | "bad_input";

/**
 * Any approved member can correct a ball of a finished match. The correction is one more row in the log (with their name),
 * the whole match is replayed, and every figure is worked out again. If the correction would break the balls after it, it is refused.
 */
export async function correctBall(userId: string, communityId: string, matchId: string, targetId: string, patch: unknown, reason: string): Promise<{ outcome: CorrectOutcome; error?: string }> {
  if (!isUuid(communityId) || !isUuid(matchId) || !isUuid(targetId)) return { outcome: "not_found" };
  return tx(async (c) => {
    const me = await c.query<{ name: string }>(
      "select u.name from community_member cm join app_user u on u.id = cm.user_id where cm.community_id = $1 and cm.user_id = $2 and cm.status = 'approved'", [communityId, userId]);
    if (!me.rows.length) return { outcome: "forbidden" as const };
    const m = await c.query<{ status: string }>("select status from cricket_match where id = $1 and community_id = $2 for update", [matchId, communityId]);
    if (!m.rows.length) return { outcome: "not_found" as const };
    if (m.rows[0]!.status !== "completed") return { outcome: "not_finished" as const };
    const rows = await c.query<{ id: string; seq: number; type: string; payload: unknown; reason: string | null; actor_name: string }>(
      "select id, seq, type, payload, reason, actor_name from match_event where match_id = $1 order by seq", [matchId]);
    const events: ScoreEvent[] = rows.rows.map((r) => ({ id: r.id, seq: r.seq, type: r.type, payload: r.payload, reason: r.reason ?? undefined, by: r.actor_name }) as ScoreEvent);
    const seq = events.length ? events[events.length - 1]!.seq + 1 : 1;
    const parsed = parseEvent({ id: randomUUID(), seq, type: "edit", payload: { target: targetId, patch }, reason: reason || undefined, at: new Date().toISOString() });
    if (!parsed.ok) return { outcome: "bad_input" as const, error: parsed.error };
    const ev = parsed.value;
    ev.by = me.rows[0]!.name;
    const built = buildState([...events, ev]);
    if (!built.ok) return { outcome: "refused" as const, error: built.error };
    await c.query(
      `insert into match_event (id, match_id, seq, type, payload, reason, actor_id, actor_name, device_id, client_at) values ($1, $2, $3, 'edit', $4, $5, $6, $7, 'correction', now())`,
      [ev.id, matchId, seq, JSON.stringify(ev.payload), ev.reason ?? null, userId, me.rows[0]!.name]);
    await c.query("update cricket_match set result = $2, changed_by = $3, updated_at = now() where id = $1", [matchId, built.state.result ? JSON.stringify(built.state.result) : null, userId]);
    await recalcMatchStats(c, matchId, built.state);
    await c.query("insert into audit_log (community_id, actor_id, action, details) values ($1, $2, 'match_corrected', $3)", [communityId, userId, JSON.stringify({ match: matchId })]);
    return { outcome: "ok" as const };
  });
}

/* ---------- reading ---------- */
export type StatFilters = { teamId?: string | null; from?: string | null; to?: string | null; allCommunities?: boolean; seriesId?: string | null };

type Row = {
  match_id: string; entry_id: string; side: 1 | 2; name: string; number_used: number | null; result: PlayerMatch["result"]; points: number; pom: boolean;
  data: { bat: PlayerMatch["bat"]; bowl: PlayerMatch["bowl"]; field: PlayerMatch["field"]; partnerships: PlayerMatch["partnerships"] };
  when: Date | null; bpo: number; team_name: string; opp_name: string; user_id: string | null; result_json: { text?: string } | null; community_id: string;
};

const SELECT = `
  select s.match_id, s.entry_id, s.side, s.name, s.number_used, s.result, s.points, s.pom, s.data,
         coalesce(m.started_at, m.scheduled_at) as "when", (m.rules->>'ballsPerOver')::int as bpo,
         ms.name as team_name, os.name as opp_name, p.user_id, m.result as result_json, m.community_id
    from match_stat s
    join cricket_match m on m.id = s.match_id and m.status = 'completed'
    join match_side ms on ms.match_id = m.id and ms.position = s.side
    join match_side os on os.match_id = m.id and os.position = 3 - s.side
    join match_player p on p.id = s.entry_id`;

const toLine = (r: Row): MatchLine => ({
  entryId: r.entry_id, side: r.side, name: r.name, result: r.result, bat: r.data.bat, bowl: r.data.bowl, field: r.data.field, partnerships: r.data.partnerships,
  points: r.points, pom: r.pom, matchId: r.match_id, when: r.when ? r.when.toISOString() : null, ballsPerOver: r.bpo ?? 6, teamName: r.team_name, opponent: r.opp_name,
  resultText: r.result_json?.text ?? "", numberUsed: r.number_used,
});

/** One player's lines. Only completed matches; only matches where they were in the lineup. */
export async function playerLines(communityId: string, userId: string, f: StatFilters = {}): Promise<MatchLine[]> {
  const params: unknown[] = [userId];
  let where = "p.user_id = $1";
  if (!f.allCommunities) { params.push(communityId); where += ` and m.community_id = $${params.length}`; }
  if (f.teamId && isUuid(f.teamId)) { params.push(f.teamId); where += ` and ms.team_id = $${params.length}`; }
  if (f.seriesId && isUuid(f.seriesId)) { params.push(f.seriesId); where += ` and exists (select 1 from series_match sx where sx.match_id = m.id and sx.series_id = $${params.length})`; }
  if (f.from) { params.push(f.from); where += ` and coalesce(m.started_at, m.scheduled_at) >= $${params.length}::date`; }
  if (f.to) { params.push(f.to); where += ` and coalesce(m.started_at, m.scheduled_at) < ($${params.length}::date + 1)`; }
  const rows = await query<Row>(`${SELECT} where ${where} order by coalesce(m.started_at, m.scheduled_at)`, params);
  return rows.map(toLine);
}

/** Every approved member's career in a community (members with no matches get an empty one, so nobody is hidden). */
export async function communityCareers(communityId: string, f: StatFilters = {}): Promise<Map<string, Career>> {
  const params: unknown[] = [communityId];
  let where = "m.community_id = $1 and p.user_id is not null";
  if (f.teamId && isUuid(f.teamId)) { params.push(f.teamId); where += ` and ms.team_id = $${params.length}`; }
  if (f.seriesId && isUuid(f.seriesId)) { params.push(f.seriesId); where += ` and exists (select 1 from series_match sx where sx.match_id = m.id and sx.series_id = $${params.length})`; }
  if (f.from) { params.push(f.from); where += ` and coalesce(m.started_at, m.scheduled_at) >= $${params.length}::date`; }
  if (f.to) { params.push(f.to); where += ` and coalesce(m.started_at, m.scheduled_at) < ($${params.length}::date + 1)`; }
  const rows = await query<Row>(`${SELECT} where ${where}`, params);
  const by = new Map<string, MatchLine[]>();
  for (const r of rows) {
    if (!r.user_id) continue;
    (by.get(r.user_id) ?? by.set(r.user_id, []).get(r.user_id)!).push(toLine(r));
  }
  return new Map(Array.from(by.entries()).map(([u, lines]) => [u, careerOf(lines)]));
}

export type TeamRecord = {
  played: number; won: number; lost: number; tied: number; noResult: number; winPercent: number | null;
  totalRuns: number; highest: number | null; lowest: number | null;
  recent: { matchId: string; when: Date | null; opponent: string; text: string; result: "win" | "loss" | "tie" | "none"; runsFor: number | null; runsAgainst: number | null }[];
  headToHead: HeadToHead[];
  /** Every finished match of this team, oldest first (for the form strip and the scores chart). */
  history: { matchId: string; when: Date | null; opponent: string; result: "win" | "loss" | "tie" | "none"; runsFor: number | null; runsAgainst: number | null }[];
};

/** A team's record against one opponent, with the highest and lowest score of each side in those matches. */
export type HeadToHead = {
  opponent: string; played: number; won: number; lost: number; tied: number;
  highestFor: number | null; lowestFor: number | null; highestAgainst: number | null; lowestAgainst: number | null;
};

type MatchRowForTeam = { id: string; when: Date | null; n1: string; t1: string | null; n2: string; t2: string | null; result: { kind: string; winner: Side | null; text: string } | null; scores: Scores | null };

async function finishedMatches(communityId: string): Promise<MatchRowForTeam[]> {
  return query<MatchRowForTeam>(
    `select m.id, coalesce(m.started_at, m.scheduled_at) as "when", s1.name as n1, s1.team_id as t1, s2.name as n2, s2.team_id as t2, m.result, m.scores
       from cricket_match m join match_side s1 on s1.match_id = m.id and s1.position = 1 join match_side s2 on s2.match_id = m.id and s2.position = 2
      where m.community_id = $1 and m.status = 'completed' order by coalesce(m.started_at, m.scheduled_at) desc`, [communityId]);
}

function recordFor(rows: MatchRowForTeam[], mine: (r: MatchRowForTeam) => Side | null): TeamRecord {
  const rec: TeamRecord = { played: 0, won: 0, lost: 0, tied: 0, noResult: 0, winPercent: null, totalRuns: 0, highest: null, lowest: null, recent: [], headToHead: [], history: [] };
  const h2h = new Map<string, HeadToHead>();
  const totals: number[] = [];
  for (const r of rows) {
    const side = mine(r);
    if (!side) continue;
    rec.played++;
    const res = r.result;
    const result: "win" | "loss" | "tie" | "none" = !res || res.kind === "no_result" || res.kind === "abandoned" || res.kind === "innings" ? "none" : res.kind === "tie" ? "tie" : res.winner === side ? "win" : "loss";
    if (result === "win") rec.won++; else if (result === "loss") rec.lost++; else if (result === "tie") rec.tied++; else rec.noResult++;
    const regular = (r.scores ?? []).filter((s) => !s.superOver);
    const forRuns = regular.filter((s) => s.batting === side).reduce((a, s) => a + s.runs, 0);
    const againstRuns = regular.filter((s) => s.batting !== side).reduce((a, s) => a + s.runs, 0);
    for (const s of regular.filter((x) => x.batting === side)) { rec.totalRuns += s.runs; totals.push(s.runs); }
    const opponent = side === 1 ? r.n2 : r.n1;
    const h = h2h.get(opponent.toLowerCase()) ?? { opponent, played: 0, won: 0, lost: 0, tied: 0, highestFor: null, lowestFor: null, highestAgainst: null, lowestAgainst: null };
    h.played++; if (result === "win") h.won++; else if (result === "loss") h.lost++; else if (result === "tie") h.tied++;
    if (regular.length) {
      h.highestFor = h.highestFor === null ? forRuns : Math.max(h.highestFor, forRuns);
      h.lowestFor = h.lowestFor === null ? forRuns : Math.min(h.lowestFor, forRuns);
      h.highestAgainst = h.highestAgainst === null ? againstRuns : Math.max(h.highestAgainst, againstRuns);
      h.lowestAgainst = h.lowestAgainst === null ? againstRuns : Math.min(h.lowestAgainst, againstRuns);
    }
    rec.history.push({ matchId: r.id, when: r.when, opponent, result, runsFor: regular.length ? forRuns : null, runsAgainst: regular.length ? againstRuns : null });
    h2h.set(opponent.toLowerCase(), h);
    if (rec.recent.length < 5) rec.recent.push({ matchId: r.id, when: r.when, opponent, text: res?.text ?? "", result, runsFor: regular.length ? forRuns : null, runsAgainst: regular.length ? againstRuns : null });
  }
  const decided = rec.won + rec.lost + rec.tied;
  rec.winPercent = decided ? (rec.won * 100) / decided : null;
  rec.highest = totals.length ? Math.max(...totals) : null;
  rec.lowest = totals.length ? Math.min(...totals) : null;
  rec.headToHead = Array.from(h2h.values()).sort((a, b) => b.played - a.played || a.opponent.localeCompare(b.opponent));
  rec.history.reverse();   // the matches were read newest first
  return rec;
}

export async function teamRecord(communityId: string, teamId: string): Promise<TeamRecord> {
  return recordFor(await finishedMatches(communityId), (r) => (r.t1 === teamId ? 1 : r.t2 === teamId ? 2 : null));
}

/** Teams ranked: wins, then win percentage, then runs. Match-only (temporary) teams are not ranked. */
export async function teamTable(communityId: string, teams: { id: string; name: string }[]): Promise<(TeamRecord & { id: string; name: string })[]> {
  const rows = await finishedMatches(communityId);
  return teams.map((t) => ({ id: t.id, name: t.name, ...recordFor(rows, (r) => (r.t1 === t.id ? 1 : r.t2 === t.id ? 2 : null)) }))
    .sort((a, b) => b.won - a.won || (b.winPercent ?? -1) - (a.winPercent ?? -1) || b.totalRuns - a.totalRuns || a.name.localeCompare(b.name));
}

/** Who contributed most for a team (runs, wickets), from the saved match lines. */
export async function teamContributors(communityId: string, teamId: string): Promise<{ name: string; userId: string | null; runs: number; wickets: number; matches: number }[]> {
  const rows = await query<Row>(`${SELECT} where m.community_id = $1 and ms.team_id = $2`, [communityId, teamId]);
  const by = new Map<string, { name: string; userId: string | null; runs: number; wickets: number; matches: number }>();
  for (const r of rows) {
    const k = r.user_id ?? `g:${r.name}`;
    const e = by.get(k) ?? { name: r.name, userId: r.user_id, runs: 0, wickets: 0, matches: 0 };
    e.runs += r.data.bat.reduce((a, b) => a + b.runs, 0);
    e.wickets += r.data.bowl.reduce((a, b) => a + b.wickets, 0);
    e.matches++;
    by.set(k, e);
  }
  return Array.from(by.values()).sort((a, b) => b.runs + b.wickets * 20 - (a.runs + a.wickets * 20));
}

/* ---------- public share link ---------- */
export type ShareOutcome = "ok" | "forbidden" | "not_found" | "not_finished";

/** Turn the public link on (a new unguessable code) or off. Any approved member can; only finished matches can be shared. */
export async function setShare(userId: string, communityId: string, matchId: string, on: boolean): Promise<{ outcome: ShareOutcome; token?: string | null }> {
  if (!isUuid(communityId) || !isUuid(matchId)) return { outcome: "not_found" };
  return tx(async (c) => {
    const me = await c.query("select 1 from community_member where community_id = $1 and user_id = $2 and status = 'approved'", [communityId, userId]);
    if (!me.rows.length) return { outcome: "forbidden" as const };
    const m = await c.query<{ status: string; share_token: string | null }>("select status, share_token from cricket_match where id = $1 and community_id = $2 for update", [matchId, communityId]);
    if (!m.rows.length) return { outcome: "not_found" as const };
    if (m.rows[0]!.status !== "completed" && m.rows[0]!.status !== "abandoned") return { outcome: "not_finished" as const };
    const token = on ? (m.rows[0]!.share_token ?? randomBytes(18).toString("base64url")) : null;
    await c.query("update cricket_match set share_token = $2 where id = $1", [matchId, token]);
    await c.query("insert into audit_log (community_id, actor_id, action, details) values ($1, $2, $3, $4)", [communityId, userId, on ? "report_shared" : "report_unshared", JSON.stringify({ match: matchId })]);
    return { outcome: "ok" as const, token };
  });
}

export async function shareTokenOf(communityId: string, matchId: string): Promise<string | null> {
  const r = await query<{ share_token: string | null }>("select share_token from cricket_match where id = $1 and community_id = $2", [matchId, communityId]);
  return r[0]?.share_token ?? null;
}

/** The match a public link points to, if sharing is on and the match is finished. */
export async function matchByShareToken(token: string): Promise<{ id: string; community_id: string; side1: string; side2: string; overs: number; when: Date | null; venue: string; created_by: string | null } | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const r = await query<{ id: string; community_id: string; side1: string; side2: string; overs: number; when: Date | null; venue: string; created_by: string | null }>(
    `select m.id, m.community_id, s1.name as side1, s2.name as side2, m.overs, coalesce(m.started_at, m.scheduled_at) as "when", m.venue, u.name as created_by
       from cricket_match m join match_side s1 on s1.match_id = m.id and s1.position = 1 join match_side s2 on s2.match_id = m.id and s2.position = 2
       left join app_user u on u.id = m.created_by
      where m.share_token = $1 and m.status in ('completed', 'abandoned')`, [token]);
  return r[0] ?? null;
}

/** The latest finished matches, for Home. */
export async function recentResults(communityId: string, limit = 3): Promise<{ id: string; n1: string; n2: string; text: string; when: Date | null }[]> {
  return query<{ id: string; n1: string; n2: string; text: string; when: Date | null }>(
    `select m.id, s1.name as n1, s2.name as n2, coalesce(m.result->>'text', '') as text, coalesce(m.started_at, m.scheduled_at) as "when"
       from cricket_match m join match_side s1 on s1.match_id = m.id and s1.position = 1 join match_side s2 on s2.match_id = m.id and s2.position = 2
      where m.community_id = $1 and m.status = 'completed' order by m.finished_at desc nulls last limit $2`, [communityId, limit]);
}

/** Matches this person has been in (for the Matches tab and "recent matches"). */
export async function matchesOfPlayer(communityId: string, userId: string): Promise<{ matchId: string; entryId: string }[]> {
  const rows = await query<{ match_id: string; entry_id: string }>(
    `select s.match_id, s.entry_id from match_stat s join match_player p on p.id = s.entry_id join cricket_match m on m.id = s.match_id where p.user_id = $1 and m.community_id = $2 and m.status = 'completed'`, [userId, communityId]);
  return rows.map((r) => ({ matchId: r.match_id, entryId: r.entry_id }));
}
