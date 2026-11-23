// Phase 5: saving the scoring log, and the scoring lock (one member, one device, at a time).
// Every event is checked by the same engine the phone uses, so nothing wrong is ever saved, and every change
// to the match (status, overs, players) is worked out from the log afterwards.
import type { PoolClient } from "pg";
import { one, query, tx } from "@/lib/db";
import { isUuid } from "@/lib/community";
import { buildState } from "@/lib/engine/engine";
import { parseEvent } from "@/lib/engine/parse";
import type { MatchState, PlayerEntry, ScoreEvent, Side, StartPayload } from "@/lib/engine/types";
import type { Rules } from "@/lib/matchRules";
import { recalcMatchStats } from "@/lib/reports";

export type LockInfo = {
  scorer_id: string | null; scorer_name: string | null; scorer_device: string | null; scorer_since: Date | null;
  takeover_by: string | null; takeover_name: string | null; takeover_at: Date | null;
};

const SCORABLE = ["draft", "scheduled", "live", "paused"];

export async function getLock(communityId: string, matchId: string): Promise<LockInfo | null> {
  if (!isUuid(matchId)) return null;
  return one<LockInfo>(
    `select m.scorer_id, s.name as scorer_name, m.scorer_device, m.scorer_since, m.takeover_by, t.name as takeover_name, m.takeover_at
       from cricket_match m left join app_user s on s.id = m.scorer_id left join app_user t on t.id = m.takeover_by
      where m.id = $1 and m.community_id = $2`,
    [matchId, communityId],
  );
}

export async function loadEvents(matchId: string): Promise<ScoreEvent[]> {
  const rows = await query<{ id: string; seq: number; type: string; payload: unknown; reason: string | null; actor_name: string; client_at: Date | null }>(
    "select id, seq, type, payload, reason, actor_name, client_at from match_event where match_id = $1 order by seq", [matchId]);
  return rows.map((r) => ({ id: r.id, seq: r.seq, type: r.type, payload: r.payload, reason: r.reason ?? undefined, by: r.actor_name, at: r.client_at?.toISOString() }) as ScoreEvent);
}

/** Who scored, for "Scored by": every member who recorded balls, with how many. */
export async function scorersOf(matchId: string): Promise<{ name: string; balls: number }[]> {
  return query<{ name: string; balls: number }>(
    "select actor_name as name, count(*)::int as balls from match_event where match_id = $1 and type = 'ball' group by actor_name order by min(seq)", [matchId]);
}

/** The match as the database knows it before the first ball: used to start a match and to check the start event. */
export async function startSnapshot(communityId: string, matchId: string): Promise<{ base: Omit<StartPayload, "battingFirst" | "toss">; toss: StartPayload["toss"]; battingFirst: Side | null; status: string } | null> {
  if (!isUuid(matchId)) return null;
  const m = await one<{ status: string; overs: number; players_per_side: number; rules: Rules; toss_winner_side: number | null; toss_decision: "bat" | "bowl" | null; batting_first_side: number | null }>(
    "select status, overs, players_per_side, rules, toss_winner_side, toss_decision, batting_first_side from cricket_match where id = $1 and community_id = $2", [matchId, communityId]);
  if (!m) return null;
  const sides = await query<{ position: number; name: string }>("select position, name from match_side where match_id = $1 order by position", [matchId]);
  const players = await query<{ id: string; position: 1 | 2; user_id: string | null; guest_name: string | null; name: string; number: number | null }>(
    `select p.id, s.position, p.user_id, p.guest_name, coalesce(p.guest_name, u.name) as name,
            case when p.guest_name is null then cm.player_number else null end as number
       from match_player p join match_side s on s.id = p.side_id left join app_user u on u.id = p.user_id
       left join community_member cm on cm.community_id = $2 and cm.user_id = p.user_id
      where p.match_id = $1 order by s.position, p.added_at, p.id`, [matchId, communityId]);
  const entries: PlayerEntry[] = players.map((p) => ({
    id: p.id, side: p.position, name: p.name, number: p.number, kind: p.user_id ? "member" : "guest", userId: p.user_id,
  }));
  return {
    base: { sides: [sides[0]!.name, sides[1]!.name], overs: m.overs, playersPerSide: m.players_per_side, rules: m.rules, players: entries },
    toss: m.toss_winner_side && m.toss_decision ? { winner: m.toss_winner_side as Side, decision: m.toss_decision } : null,
    battingFirst: (m.batting_first_side as Side | null) ?? null,
    status: m.status,
  };
}

/* ---------- the lock ---------- */
export type LockOutcome = "ok" | "forbidden" | "not_found" | "bad_state" | "held" | "not_holder" | "no_request" | "busy" | "not_admin";

async function approvedRole(c: PoolClient, communityId: string, userId: string): Promise<"admin" | "member" | null> {
  const r = await c.query<{ role: "admin" | "member" }>("select role from community_member where community_id = $1 and user_id = $2 and status = 'approved'", [communityId, userId]);
  return r.rows[0]?.role ?? null;
}

type Row = { status: string; scorer_id: string | null; scorer_device: string | null; takeover_by: string | null; takeover_at: Date | null };
async function lockRow(c: PoolClient, communityId: string, matchId: string): Promise<Row | null> {
  if (!isUuid(matchId) || !isUuid(communityId)) return null;
  const r = await c.query<Row>("select status, scorer_id, scorer_device, takeover_by, takeover_at from cricket_match where id = $1 and community_id = $2 for update", [matchId, communityId]);
  return r.rows[0] ?? null;
}

async function audit(c: PoolClient, communityId: string, actor: string, action: string, matchId: string) {
  await c.query("insert into audit_log (community_id, actor_id, action, details) values ($1, $2, $3, $4)", [communityId, actor, action, JSON.stringify({ match: matchId })]);
}

/** Take the scoring lock if nobody holds it. The person who already holds it can move it to this device. */
export async function takeScoring(userId: string, communityId: string, matchId: string, deviceId: string): Promise<LockOutcome> {
  if (!deviceId || deviceId.length > 80) return "bad_state";
  return tx(async (c) => {
    if (!(await approvedRole(c, communityId, userId))) return "forbidden";
    const m = await lockRow(c, communityId, matchId);
    if (!m) return "not_found";
    if (!SCORABLE.includes(m.status)) return "bad_state";
    if (m.scorer_id && m.scorer_id !== userId) return "held";
    await c.query("update cricket_match set scorer_id = $2, scorer_device = $3, scorer_since = coalesce(scorer_since, now()), takeover_by = null, takeover_at = null where id = $1", [matchId, userId, deviceId]);
    await audit(c, communityId, userId, "scoring_taken", matchId);
    return "ok";
  });
}

/** The holder claims their device after being handed the lock (the device is empty until then). */
export async function claimDevice(userId: string, communityId: string, matchId: string, deviceId: string): Promise<LockOutcome> {
  return tx(async (c) => {
    const m = await lockRow(c, communityId, matchId);
    if (!m) return "not_found";
    if (m.scorer_id !== userId) return "not_holder";
    if (m.scorer_device === null) await c.query("update cricket_match set scorer_device = $2 where id = $1", [matchId, deviceId]);
    return "ok";
  });
}

export async function releaseScoring(userId: string, communityId: string, matchId: string): Promise<LockOutcome> {
  return tx(async (c) => {
    const m = await lockRow(c, communityId, matchId);
    if (!m) return "not_found";
    if (m.scorer_id !== userId) return "not_holder";
    await c.query("update cricket_match set scorer_id = null, scorer_device = null, scorer_since = null, takeover_by = null, takeover_at = null where id = $1", [matchId]);
    await audit(c, communityId, userId, "scoring_released", matchId);
    return "ok";
  });
}

export async function requestTakeover(userId: string, communityId: string, matchId: string): Promise<LockOutcome> {
  return tx(async (c) => {
    if (!(await approvedRole(c, communityId, userId))) return "forbidden";
    const m = await lockRow(c, communityId, matchId);
    if (!m) return "not_found";
    if (!SCORABLE.includes(m.status)) return "bad_state";
    if (!m.scorer_id || m.scorer_id === userId) return "bad_state";
    if (m.takeover_by && m.takeover_by !== userId && m.takeover_at && Date.now() - m.takeover_at.getTime() < 5 * 60_000) return "busy";
    await c.query("update cricket_match set takeover_by = $2, takeover_at = now() where id = $1", [matchId, userId]);
    return "ok";
  });
}

export async function cancelTakeoverRequest(userId: string, communityId: string, matchId: string): Promise<LockOutcome> {
  return tx(async (c) => {
    const m = await lockRow(c, communityId, matchId);
    if (!m) return "not_found";
    if (m.takeover_by !== userId) return "no_request";
    await c.query("update cricket_match set takeover_by = null, takeover_at = null where id = $1", [matchId]);
    return "ok";
  });
}

/** The scorer accepts or declines a request. Accepting hands the lock over; the new scorer's device is claimed when they open it. */
export async function respondTakeover(userId: string, communityId: string, matchId: string, accept: boolean): Promise<LockOutcome> {
  return tx(async (c) => {
    const m = await lockRow(c, communityId, matchId);
    if (!m) return "not_found";
    if (m.scorer_id !== userId) return "not_holder";
    if (!m.takeover_by) return "no_request";
    if (accept) {
      await c.query("update cricket_match set scorer_id = takeover_by, scorer_device = null, scorer_since = now(), takeover_by = null, takeover_at = null where id = $1", [matchId]);
      await audit(c, communityId, userId, "scoring_handed_over", matchId);
    } else {
      await c.query("update cricket_match set takeover_by = null, takeover_at = null where id = $1", [matchId]);
    }
    return "ok";
  });
}

/** An Admin can always take the lock, for example when the scorer's phone has died. */
export async function adminTakeover(userId: string, communityId: string, matchId: string): Promise<LockOutcome> {
  return tx(async (c) => {
    if ((await approvedRole(c, communityId, userId)) !== "admin") return "not_admin";
    const m = await lockRow(c, communityId, matchId);
    if (!m) return "not_found";
    if (!SCORABLE.includes(m.status)) return "bad_state";
    await c.query("update cricket_match set scorer_id = $2, scorer_device = null, scorer_since = now(), takeover_by = null, takeover_at = null where id = $1", [matchId, userId]);
    await audit(c, communityId, userId, "scoring_admin_takeover", matchId);
    return "ok";
  });
}

/* ---------- saving events ---------- */
export type Rejection = { id: string | null; reason: string; code: "invalid" | "out_of_order" | "refused" | "not_scorer" | "locked" | "blocked" };
export type SyncResult = { accepted: string[]; duplicates: string[]; rejected: Rejection[]; lastSeq: number; lockLost: boolean };

/** JSON with keys in a fixed order, so two copies of the same rules compare equal however the database stored them. */
const stable = (x: unknown): unknown =>
  Array.isArray(x) ? x.map(stable) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([k], [l]) => (k < l ? -1 : 1)).map(([k, v]) => [k, stable(v)])) : x;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

/** The start event must describe the match exactly as the database has it, so a phone cannot invent players or rules. */
async function canonicalStart(communityId: string, matchId: string, ev: Extract<ScoreEvent, { type: "match_start" }>): Promise<{ ok: true } | { ok: false; reason: string }> {
  const snap = await startSnapshot(communityId, matchId);
  if (!snap) return { ok: false, reason: "That match could not be found." };
  const p = ev.payload;
  if (!sameJson(p.sides, snap.base.sides) || p.overs !== snap.base.overs || p.playersPerSide !== snap.base.playersPerSide || !sameJson(p.rules, snap.base.rules)) {
    return { ok: false, reason: "The match setup changed since this screen was opened. Reload the page and start again." };
  }
  const have = new Map(snap.base.players.map((x) => [x.id, x]));
  if (p.players.length !== have.size) return { ok: false, reason: "The lineups changed since this screen was opened. Reload the page and start again." };
  for (const [i, pl] of p.players.entries()) {
    const real = have.get(pl.id);
    if (!real || real.side !== pl.side || real.userId !== pl.userId || real.kind !== pl.kind) return { ok: false, reason: "The lineups changed since this screen was opened. Reload the page and start again." };
    p.players[i] = real;   // names and numbers come from the database, never from the phone
  }
  return { ok: true };
}

async function canonicalAdded(c: PoolClient, communityId: string, matchId: string, ev: Extract<ScoreEvent, { type: "player_added" }>): Promise<{ ok: true } | { ok: false; reason: string }> {
  const pl = ev.payload.player;
  if (pl.kind === "member") {
    const r = await c.query<{ name: string; player_number: number | null }>(
      `select u.name, cm.player_number from community_member cm join app_user u on u.id = cm.user_id
        where cm.community_id = $1 and cm.user_id = $2 and cm.status = 'approved'`, [communityId, pl.userId]);
    if (!r.rows.length) return { ok: false, reason: "That person is not a member of this community." };
    ev.payload.player = { ...pl, name: r.rows[0]!.name, number: r.rows[0]!.player_number };
  } else {
    ev.payload.player = { ...pl, number: null, userId: null };
  }
  void matchId;
  return { ok: true };
}

/** Make the match row and the lineup agree with the log: status, overs, players, result. */
async function reconcile(c: PoolClient, communityId: string, matchId: string, state: MatchState, startPlayerIds: Set<string>) {
  if (!state.started) return;
  const status = state.phase === "finished" ? "completed" : state.phase === "abandoned" ? "abandoned" : state.paused ? "paused" : "live";
  const done = status === "completed" || status === "abandoned";
  await c.query(
    `update cricket_match set status = $2, overs = $3, players_per_side = $4,
            started_at = coalesce(started_at, now()),
            finished_at = case when $5 then coalesce(finished_at, now()) else null end,
            result = $6,
            toss_winner_side = $7, toss_decision = $8, batting_first_side = $9,
            scorer_id = case when $5 then null else scorer_id end,
            scorer_device = case when $5 then null else scorer_device end,
            takeover_by = case when $5 then null else takeover_by end,
            takeover_at = case when $5 then null else takeover_at end,
            updated_at = now()
      where id = $1`,
    [matchId, status, state.overs, state.playersPerSide, done, state.result ? JSON.stringify(state.result) : null,
      state.toss?.winner ?? null, state.toss?.decision ?? null, state.battingFirst],
  );
  if (done) await recalcMatchStats(c, matchId, state);   // a finished match now counts towards careers, leaderboards and team records
  const rows = await c.query<{ id: string }>("select id from match_player where match_id = $1", [matchId]);
  const have = new Set(rows.rows.map((r) => r.id));
  const sideIds = new Map((await c.query<{ id: string; position: number }>("select id, position from match_side where match_id = $1", [matchId])).rows.map((r) => [r.position, r.id]));
  for (const p of Object.values(state.players)) {
    if (have.has(p.id)) continue;
    if (p.kind === "member") await c.query("insert into match_player (id, match_id, side_id, user_id, added_by) values ($1, $2, $3, $4, (select scorer_id from cricket_match where id = $2))", [p.id, matchId, sideIds.get(p.side), p.userId]);
    else await c.query("insert into match_player (id, match_id, side_id, guest_name, added_by) values ($1, $2, $3, $4, (select scorer_id from cricket_match where id = $2))", [p.id, matchId, sideIds.get(p.side), p.name]);
  }
  // a late player whose joining was undone goes again; people who were there at the start never do
  for (const id of have) if (!state.players[id] && !startPlayerIds.has(id)) await c.query("delete from match_player where id = $1 and match_id = $2", [id, matchId]);
  void communityId;
}

/** Save a batch of events from the scorer's phone, in order, all or nothing per event, with every refusal explained. */
export async function applyEvents(userId: string, communityId: string, matchId: string, deviceId: string, raw: unknown[]): Promise<SyncResult | { error: "forbidden" | "not_found" | "too_big" }> {
  if (!Array.isArray(raw) || raw.length > 500) return { error: "too_big" };
  if (!deviceId || typeof deviceId !== "string" || deviceId.length > 80) return { error: "forbidden" };
  return tx(async (c) => {
    const me = await c.query<{ name: string }>(
      `select u.name from community_member cm join app_user u on u.id = cm.user_id where cm.community_id = $1 and cm.user_id = $2 and cm.status = 'approved'`, [communityId, userId]);
    if (!me.rows.length) return { error: "forbidden" as const };
    const m = await c.query<{ status: string; scorer_id: string | null; scorer_device: string | null }>(
      "select status, scorer_id, scorer_device from cricket_match where id = $1 and community_id = $2 for update", [matchId, communityId]);
    if (!m.rows.length) return { error: "not_found" as const };
    const row = m.rows[0]!;
    const existingRows = await c.query<{ id: string; seq: number; type: string; payload: unknown; reason: string | null; actor_name: string }>(
      "select id, seq, type, payload, reason, actor_name from match_event where match_id = $1 order by seq", [matchId]);
    const existing: ScoreEvent[] = existingRows.rows.map((r) => ({ id: r.id, seq: r.seq, type: r.type, payload: r.payload, reason: r.reason ?? undefined, by: r.actor_name }) as ScoreEvent);
    const known = new Set(existing.map((e) => e.id));
    let lastSeq = existing.length ? existing[existing.length - 1]!.seq : 0;
    const result: SyncResult = { accepted: [], duplicates: [], rejected: [], lastSeq, lockLost: false };

    const holds = row.scorer_id === userId && (row.scorer_device === null || row.scorer_device === deviceId);
    if (!holds) {
      // Events already saved are acknowledged (a repeat is harmless); everything else is refused, never dropped silently.
      for (const r of raw) {
        const p = parseEvent(r);
        const id = p.ok ? p.value.id : null;
        if (id && known.has(id)) result.duplicates.push(id);
        else result.rejected.push({ id, reason: row.scorer_id === userId ? "You are scoring on another device now." : "You no longer hold the scoring lock.", code: "not_scorer" });
      }
      result.lockLost = true;
      return result;
    }
    if (row.scorer_device === null) await c.query("update cricket_match set scorer_device = $2 where id = $1", [matchId, deviceId]);

    let blocked: string | null = null;
    const startIds = new Set<string>();
    const startEv = existing.find((e) => e.type === "match_start");
    if (startEv && startEv.type === "match_start") for (const p of startEv.payload.players) startIds.add(p.id);
    let sawNew = false;

    for (const r of raw) {
      const p = parseEvent(r);
      if (!p.ok) { result.rejected.push({ id: null, reason: p.error, code: "invalid" }); blocked = p.error; continue; }
      const ev = p.value;
      if (known.has(ev.id)) { result.duplicates.push(ev.id); continue; }
      if (blocked) { result.rejected.push({ id: ev.id, reason: "An earlier event was refused, so this one waits for it to be fixed.", code: "blocked" }); continue; }
      if (!SCORABLE.includes(row.status)) {
        result.rejected.push({ id: ev.id, reason: "This match is finished and locked.", code: "locked" }); blocked = "locked"; continue;
      }
      if (ev.seq !== lastSeq + 1) {
        result.rejected.push({ id: ev.id, reason: `Out of order: expected number ${lastSeq + 1}.`, code: "out_of_order" }); blocked = "order"; continue;
      }
      ev.by = me.rows[0]!.name;
      if (ev.type === "match_start") {
        const ok = await canonicalStart(communityId, matchId, ev);
        if (!ok.ok) { result.rejected.push({ id: ev.id, reason: ok.reason, code: "refused" }); blocked = ok.reason; continue; }
        for (const pl of ev.payload.players) startIds.add(pl.id);
      }
      if (ev.type === "player_added") {
        const ok = await canonicalAdded(c, communityId, matchId, ev);
        if (!ok.ok) { result.rejected.push({ id: ev.id, reason: ok.reason, code: "refused" }); blocked = ok.reason; continue; }
      }
      const built = buildState([...existing, ev]);
      if (!built.ok) { result.rejected.push({ id: ev.id, reason: built.error, code: "refused" }); blocked = built.error; continue; }
      await c.query(
        `insert into match_event (id, match_id, seq, type, payload, reason, actor_id, actor_name, device_id, client_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [ev.id, matchId, ev.seq, ev.type, JSON.stringify(ev.payload), ev.reason ?? null, userId, me.rows[0]!.name, deviceId, ev.at ?? null],
      );
      existing.push(ev);
      known.add(ev.id);
      lastSeq = ev.seq;
      result.accepted.push(ev.id);
      sawNew = true;
      // the status can change inside a batch (start, then finish): keep the check honest
      const st = built.state;
      if (st.phase === "finished" || st.phase === "abandoned") row.status = "completed";
    }
    if (sawNew) {
      const built = buildState(existing);
      if (built.ok) await reconcile(c, communityId, matchId, built.state, startIds);
    }
    result.lastSeq = lastSeq;
    return result;
  });
}

