// Player of the Series: reads the saved per-match figures of the finished matches in one series.
// The same `match_stat` rows the leaderboards use, so the points are exactly the Player of the Match points.
import { query } from "@/lib/db";
import { isUuid } from "@/lib/community";
import type { AwardLine } from "@/lib/seriesAward";
import type { PlayerMatch } from "@/lib/stats";

type Row = {
  match_id: string; name: string; number_used: number | null; points: number; opp_name: string; user_id: string;
  data: { bat?: PlayerMatch["bat"]; bowl?: PlayerMatch["bowl"]; field?: PlayerMatch["field"] } | null;
};

const sum = <T,>(xs: T[] | undefined, f: (x: T) => number) => (xs ?? []).reduce((a, x) => a + f(x), 0);

/** Every member line of every finished match in the series, oldest match first. Guests (no member behind the entry) are left out. */
export async function seriesAwardLines(communityId: string, seriesId: string): Promise<AwardLine[]> {
  if (!isUuid(communityId) || !isUuid(seriesId)) return [];
  const rows = await query<Row>(
    `select s.match_id, s.name, s.number_used, s.points, s.data, os.name as opp_name, p.user_id
       from series_match sm
       join cricket_match m on m.id = sm.match_id and m.status = 'completed' and m.community_id = $1
       join match_stat s on s.match_id = m.id
       join match_player p on p.id = s.entry_id
       join match_side os on os.match_id = m.id and os.position = 3 - s.side
      where sm.series_id = $2 and p.user_id is not null
      order by coalesce(m.started_at, m.scheduled_at), m.created_at, s.name`,
    [communityId, seriesId],
  );
  return rows.map((r) => ({
    userId: r.user_id, name: r.name, number: r.number_used, matchId: r.match_id, opponent: r.opp_name, points: r.points,
    runs: sum(r.data?.bat, (b) => b.runs), wickets: sum(r.data?.bowl, (b) => b.wickets),
    catches: (r.data?.field?.catches ?? 0) + (r.data?.field?.caughtBowled ?? 0),
  }));
}
