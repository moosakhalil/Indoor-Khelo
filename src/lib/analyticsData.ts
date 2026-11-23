// Phase 8: loads the finished matches of a community with their full ball-by-ball state, for the analytics screens.
// One query for the matches and one for all their events, then each match is replayed by the same engine the scorer uses.
import { query } from "@/lib/db";
import { buildState } from "@/lib/engine/engine";
import type { ScoreEvent } from "@/lib/engine/types";
import type { StateRow } from "@/lib/analytics";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function loadCommunityStates(communityId: string, f: { from?: string | null; to?: string | null } = {}): Promise<StateRow[]> {
  const params: unknown[] = [communityId];
  let where = "m.community_id = $1 and m.status = 'completed'";
  if (f.from && DATE.test(f.from)) { params.push(f.from); where += ` and coalesce(m.started_at, m.scheduled_at) >= $${params.length}::date`; }
  if (f.to && DATE.test(f.to)) { params.push(f.to); where += ` and coalesce(m.started_at, m.scheduled_at) < ($${params.length}::date + 1)`; }
  const matches = await query<{ id: string; when: Date | null; n1: string; t1: string | null; n2: string; t2: string | null }>(
    `select m.id, coalesce(m.started_at, m.scheduled_at) as "when", s1.name as n1, s1.team_id as t1, s2.name as n2, s2.team_id as t2
       from cricket_match m join match_side s1 on s1.match_id = m.id and s1.position = 1 join match_side s2 on s2.match_id = m.id and s2.position = 2
      where ${where} order by coalesce(m.started_at, m.scheduled_at) nulls last`, params);
  if (!matches.length) return [];
  const rows = await query<{ match_id: string; id: string; seq: number; type: string; payload: unknown; reason: string | null; actor_name: string }>(
    "select match_id, id, seq, type, payload, reason, actor_name from match_event where match_id = any($1::uuid[]) order by match_id, seq", [matches.map((m) => m.id)]);
  const by = new Map<string, ScoreEvent[]>();
  for (const r of rows) {
    const list = by.get(r.match_id) ?? [];
    list.push({ id: r.id, seq: r.seq, type: r.type, payload: r.payload, reason: r.reason ?? undefined, by: r.actor_name } as ScoreEvent);
    by.set(r.match_id, list);
  }
  const out: StateRow[] = [];
  for (const m of matches) {
    const built = buildState(by.get(m.id) ?? []);
    if (!built.ok || !built.state.started) continue;      // a record that cannot be replayed is left out, never guessed
    out.push({ matchId: m.id, when: m.when ? m.when.toISOString() : null, sides: [m.n1, m.n2], teamIds: [m.t1, m.t2], state: built.state });
  }
  return out;
}
