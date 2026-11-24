// Queries behind the Alerts screen actions. Every query is limited to the signed-in person's own alerts in one community.
import { isUuid } from "@/lib/community";
import { query } from "@/lib/db";

/** Mark one alert as read. Only the person's own alert in this community; an already read alert is left alone. */
export async function markOneAlertRead(userId: string, communityId: string, alertId: string): Promise<boolean> {
  if (!isUuid(communityId) || !isUuid(alertId)) return false;
  const rows = await query<{ id: string }>(
    "update app_alert set read_at = now() where id = $1 and user_id = $2 and community_id = $3 and read_at is null returning id",
    [alertId, userId, communityId],
  );
  return rows.length > 0;
}

/** Mark every unread alert as read and say which ones, so the change can be taken back for exactly those. */
export async function markAllAlertsReadReturning(userId: string, communityId: string): Promise<string[]> {
  if (!isUuid(communityId)) return [];
  const rows = await query<{ id: string }>(
    "update app_alert set read_at = now() where user_id = $1 and community_id = $2 and read_at is null returning id",
    [userId, communityId],
  );
  return rows.map((r) => r.id);
}

/** Put exactly these alerts back to unread (Undo). Only the person's own alerts in this community. */
export async function markAlertsUnread(userId: string, communityId: string, ids: string[]): Promise<number> {
  const clean = ids.filter(isUuid).slice(0, 500);
  if (!isUuid(communityId) || clean.length === 0) return 0;
  const rows = await query<{ id: string }>(
    "update app_alert set read_at = null where user_id = $1 and community_id = $2 and id = any($3::uuid[]) and read_at is not null returning id",
    [userId, communityId, clean],
  );
  return rows.length;
}

/** The person's own reply for each of these matches. */
export async function myAnswersFor(userId: string, matchIds: string[]): Promise<Record<string, "in" | "out">> {
  const clean = Array.from(new Set(matchIds.filter(isUuid)));
  if (clean.length === 0) return {};
  const rows = await query<{ match_id: string; answer: string }>(
    "select match_id, answer from match_availability where user_id = $1 and match_id = any($2::uuid[])",
    [userId, clean],
  );
  const out: Record<string, "in" | "out"> = {};
  for (const r of rows) if (r.answer === "in" || r.answer === "out") out[r.match_id] = r.answer;
  return out;
}
