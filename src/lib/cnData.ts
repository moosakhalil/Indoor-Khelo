// Phase G2 (UI redesign): the few extra database reads the number, waiting and delete screens need. Read only, no schema change.
import { one } from "@/lib/db";

/** The live or paused match that locks this player's number, if any. Same rule as `chooseNumber` in community.ts. */
export async function liveMatchFor(communityId: string, userId: string): Promise<{ id: string; title: string } | null> {
  const row = await one<{ id: string; title: string | null }>(
    `select m.id,
            (select string_agg(s.name, ' v ' order by s.position) from match_side s where s.match_id = m.id) as title
       from match_player p join cricket_match m on m.id = p.match_id
      where m.community_id = $1 and p.user_id = $2 and m.status in ('live', 'paused')
      order by m.updated_at desc limit 1`,
    [communityId, userId],
  );
  return row ? { id: row.id, title: row.title ?? "Match in progress" } : null;
}

export type DeleteCounts = { members: number; teams: number; series: number; matches: number; bookings: number };

/** What deleting a community removes, as counts for the warning card. */
export async function deleteCounts(communityId: string): Promise<DeleteCounts> {
  const r = await one<Record<keyof DeleteCounts, string>>(
    `select (select count(*) from community_member where community_id = $1 and status = 'approved') as members,
            (select count(*) from team where community_id = $1) as teams,
            (select count(*) from series where community_id = $1) as series,
            (select count(*) from cricket_match where community_id = $1) as matches,
            (select count(*) from booking where community_id = $1) as bookings`,
    [communityId],
  );
  return {
    members: Number(r?.members ?? 0),
    teams: Number(r?.teams ?? 0),
    series: Number(r?.series ?? 0),
    matches: Number(r?.matches ?? 0),
    bookings: Number(r?.bookings ?? 0),
  };
}
