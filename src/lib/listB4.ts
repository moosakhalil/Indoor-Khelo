// Phase B (UI redesign), Builder 4: read-only queries for the matches list and the teams list. Nothing is written here.
import { query } from "@/lib/db";
import { buildState } from "@/lib/engine/engine";
import type { ScoreEvent } from "@/lib/engine/types";
import { NO_SUMMARY, liveSummary, pastSummary, type CardSummary } from "@/lib/matchSummary";
import type { MatchStatus } from "@/lib/matchRules";

/** Score or result for every live, paused, completed and abandoned match in the list. A match that cannot be read just has no summary. */
export async function matchSummaries(matches: { id: string; status: MatchStatus }[]): Promise<Map<string, CardSummary>> {
  const out = new Map<string, CardSummary>();
  const liveIds = matches.filter((m) => m.status === "live" || m.status === "paused").map((m) => m.id);
  const pastIds = matches.filter((m) => m.status === "completed" || m.status === "abandoned").map((m) => m.id);
  if (liveIds.length) {
    const rows = await query<{ id: string; match_id: string; seq: number; type: string; payload: unknown; reason: string | null; actor_name: string | null }>(
      "select id, match_id, seq, type, payload, reason, actor_name from match_event where match_id = any($1::uuid[]) order by match_id, seq", [liveIds]);
    const by = new Map<string, ScoreEvent[]>();
    for (const r of rows) {
      const list = by.get(r.match_id) ?? [];
      list.push({ id: r.id, seq: r.seq, type: r.type, payload: r.payload, reason: r.reason ?? undefined, by: r.actor_name ?? undefined } as unknown as ScoreEvent);
      by.set(r.match_id, list);
    }
    for (const id of liveIds) {
      try {
        const built = buildState(by.get(id) ?? []);
        out.set(id, built.ok ? liveSummary(built.state) : NO_SUMMARY);
      } catch {
        out.set(id, NO_SUMMARY);
      }
    }
  }
  if (pastIds.length) {
    const rows = await query<{ id: string; text: string | null; scores: Parameters<typeof pastSummary>[0] }>(
      "select id, result->>'text' as text, scores from cricket_match where id = any($1::uuid[])", [pastIds]);
    for (const r of rows) out.set(r.id, pastSummary(r.scores, r.text));
  }
  return out;
}

/** How many matches use each team of the community. A team with matches cannot be deleted. */
export async function teamMatchCounts(communityId: string): Promise<Map<string, number>> {
  const rows = await query<{ team_id: string; n: number }>(
    "select s.team_id, count(*)::int as n from match_side s join team t on t.id = s.team_id where t.community_id = $1 group by s.team_id", [communityId]);
  return new Map(rows.map((r) => [r.team_id, r.n]));
}
