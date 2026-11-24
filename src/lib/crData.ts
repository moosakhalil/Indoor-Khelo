// Phase C (UI redesign), Builder C1: the one small read the Create and Edit match pages add (recent venues and the usual match time).
// It only reads. Nothing is stored.
import { query } from "@/lib/db";
import { toLocalInput } from "@/lib/matchRules";

/** The last three different venues used in the community, and the date of the latest dated match (as the person's own local text). */
export async function recentSetup(communityId: string, tz: string): Promise<{ venues: string[]; lastWhen: string | null }> {
  const rows = await query<{ venue: string; scheduled_at: Date | null }>(
    "select venue, scheduled_at from cricket_match where community_id = $1 order by created_at desc limit 30", [communityId]);
  const venues: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const v = r.venue.trim();
    if (v && !seen.has(v.toLowerCase()) && venues.length < 3) { seen.add(v.toLowerCase()); venues.push(v); }
  }
  const dated = rows.find((r) => r.scheduled_at);
  return { venues, lastWhen: dated?.scheduled_at ? toLocalInput(dated.scheduled_at, tz) : null };
}
