// Phase F1: which teams are "yours" (you are in the squad, or you are the captain or vice-captain). Used for the gold ring on a badge.
import { tallyLine } from "@/lib/series";
import type { SeriesFull } from "@/lib/seriesDb";
import type { SeriesCardItem } from "@/lib/seriesView";
import { listTeams, teamsOfPlayer } from "@/lib/teams";

export async function myTeamIds(communityId: string, userId: string): Promise<Set<string>> {
  const [teams, squads] = await Promise.all([listTeams(communityId), teamsOfPlayer(communityId, userId)]);
  const mine = new Set(squads.map((s) => s.id));
  for (const t of teams) if (t.captain_id === userId || t.vice_captain_id === userId) mine.add(t.id);
  return mine;
}

/** Plain data for a series card, so the client list never needs the database types. */
export function toCardItem(s: SeriesFull, mine: ReadonlySet<string>, canDelete = true): SeriesCardItem {
  const rows = s.tally.rows;
  const sides = rows.map((r) => {
    const side = s.sides.find((x) => x.name === r.name);
    return { name: r.name, teamId: side?.teamId ?? null, mine: !!(side?.teamId && mine.has(side.teamId)) };
  });
  return {
    id: s.id, name: s.name, open: s.status === "open", format: s.format, bestOf: s.best_of, matchCount: s.match_count,
    sides, wins: rows.length === 2 ? [rows[0]!.won, rows[1]!.won] : null,
    counted: s.tally.counted, line: tallyLine(s.tally), statusText: s.status_view.text, status: s.status_view,
    canDelete, addedBy: s.created_by_name,
  };
}
