// Data for the page shell (top bar bell, community switcher, sidebar). Every function is wrapped in React's `cache`,
// so the bell, the sidebar and the page itself share one query per request, and every function swallows errors:
// the shell must never break the page it sits around.
import { cache } from "react";
import { getCommunity, getMembership, isUuid, listMyCommunities } from "@/lib/community";
import { one, query } from "@/lib/db";
import { unreadAlertCount } from "@/lib/matches";
import type { AppUser } from "@/lib/session";

export type SwitcherCommunity = { id: string; name: string; role: "admin" | "member"; number: number | null; members: number };

/** The signed-in user, or null. Never redirects and never throws. */
export const shellUser = cache(async (): Promise<AppUser | null> => {
  try {
    // loaded when needed, so the pieces of the shell that only draw things can be rendered without the sign-in library
    const { getSessionUser } = await import("@/lib/session");
    return await getSessionUser();
  } catch { return null; }
});

export const shellUnread = cache(async (communityId: string): Promise<number> => {
  try {
    const user = await shellUser();
    return user && isUuid(communityId) ? await unreadAlertCount(user.id, communityId) : 0;
  } catch { return 0; }
});

/** True while a match of this community is being scored (live or paused). */
export const shellHasLive = cache(async (communityId: string): Promise<boolean> => {
  try {
    if (!isUuid(communityId)) return false;
    return !!(await one("select 1 as x from cricket_match where community_id = $1 and status in ('live', 'paused') limit 1", [communityId]));
  } catch { return false; }
});

export const shellCommunityName = cache(async (communityId: string): Promise<string | null> => {
  try { return isUuid(communityId) ? (await getCommunity(communityId))?.name ?? null : null; } catch { return null; }
});

/** The signed-in person's role and number in this community (for the sidebar foot). */
export const shellMember = cache(async (communityId: string): Promise<{ name: string; role: "admin" | "member"; number: number | null } | null> => {
  try {
    const user = await shellUser();
    if (!user || !isUuid(communityId)) return null;
    const m = await getMembership(communityId, user.id);
    return m && m.status === "approved" ? { name: user.name, role: m.role, number: m.player_number } : null;
  } catch { return null; }
});

/** Approved communities of the signed-in person, with role, number and member count. */
export const shellCommunities = cache(async (): Promise<SwitcherCommunity[]> => {
  try {
    const user = await shellUser();
    if (!user) return [];
    const mine = (await listMyCommunities(user.id)).filter((c) => c.status === "approved");
    if (mine.length === 0) return [];
    const counts = await query<{ community_id: string; n: number }>(
      "select community_id, count(*)::int as n from community_member where community_id = any($1::uuid[]) and status = 'approved' group by community_id",
      [mine.map((c) => c.id)],
    );
    const byId = new Map(counts.map((r) => [r.community_id, r.n]));
    return mine.map((c) => ({ id: c.id, name: c.name, role: c.role, number: c.player_number, members: byId.get(c.id) ?? 0 }));
  } catch { return []; }
});
