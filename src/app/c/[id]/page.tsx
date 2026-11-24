import type { Metadata } from "next";
import CacheRoster from "@/components/CacheRoster";
import Frame from "@/components/Frame";
import { greetingFor } from "@/components/HomeParts";
import HomeView, { HomeSide, type HomeData } from "@/components/HomeView";
import { CommunitySwitcherSlot } from "@/components/ShellParts";
import { approvedCount, listPending, requireMember } from "@/lib/community";
import { listLineup, liveMatch, nextMatch, unreadAlertCount } from "@/lib/matches";
import { rosterFor } from "@/lib/quickMatch";
import { recentResults } from "@/lib/reports";
import { loadScoreLines } from "@/lib/scoreLine";
import { requireAcceptedUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Home" };

export default async function CommunityHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const [members, pending, next, alerts, tz, live, results, roster] = await Promise.all([
    approvedCount(id),
    membership.role === "admin" ? listPending(id) : Promise.resolve([]),
    nextMatch(id, user.id),
    unreadAlertCount(user.id, id),
    getZone(),
    liveMatch(id, user.id),
    recentResults(id),
    rosterFor(id, user.id),
  ]);
  // a match is "today" if it is on today's date in the viewer's own time zone
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const today = next && next.scheduled_at && dayKey(next.scheduled_at) === dayKey(new Date()) ? next : null;
  // scores for the live match and the latest results come from the scoring engine (read only, at most 4 matches)
  const [todayLineup, lines] = await Promise.all([
    today ? listLineup(id, today.id) : Promise.resolve([]),
    loadScoreLines([...(live ? [live.id] : []), ...results.map((r) => r.id)]),
  ]);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const data: HomeData = {
    id, tz, isAdmin: membership.role === "admin", pending: pending.length, alerts, members, cap: COMMUNITY_MEMBER_CAP,
    community: { name: community.name, location: community.location, description: community.description },
    number: membership.player_number,
    live, liveLine: live ? lines.get(live.id) ?? null : null,
    next, today, todayLineup,
    mySide: todayLineup.find((l) => l.user_id === user.id)?.position ?? null,
    results: results.map((r) => ({ ...r, line: lines.get(r.id) ?? null })),
  };
  return (
    <Frame
      communityId={id}
      title={greetingFor(Number.isFinite(hour) ? hour : 12, user.name)}
      subtitle={<CommunitySwitcherSlot communityId={id} variant="topbar" name={community.name} />}
      panel={<div className="hm-panel"><HomeSide d={data} /></div>}
    >
      <CacheRoster communityId={id} me={user.id} members={roster.members} teams={roster.teams} />
      <HomeView d={data} />
    </Frame>
  );
}
