import type { Metadata } from "next";
import Link from "next/link";
import { IconCalendar, IconPlus } from "@/components/B4Icons";
import CacheRoster, { QuickMatchLink } from "@/components/CacheRoster";
import Frame from "@/components/Frame";
import MatchList from "@/components/MatchList";
import { requireMember } from "@/lib/community";
import { matchSummaries } from "@/lib/listB4";
import { PLANNED_EXPLAIN, plannedHeadline, toMatchItem } from "@/lib/matchList";
import { NO_SUMMARY } from "@/lib/matchSummary";
import { listMatches } from "@/lib/matches";
import { rosterFor } from "@/lib/quickMatch";
import { requireAcceptedUser } from "@/lib/session";
import { listTeams, teamsOfPlayer } from "@/lib/teams";
import { getZone } from "@/lib/zone";
import "@/components/b4.css";

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ planned?: string; deleted?: string; q?: string }> }) {
  const { id } = await params;
  const { planned, deleted, q } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [all, tz, roster, teams] = await Promise.all([listMatches(id, user.id), getZone(), rosterFor(id, user.id), listTeams(id)]);
  const summaries = await matchSummaries(all);
  // "My teams": a team I captain or play for. Their badges get the gold ring.
  const myTeams = new Set<string>();
  const squads = await teamsOfPlayer(id, user.id);
  for (const t of squads) myTeams.add(t.id);
  for (const t of teams) if (t.captain_id === user.id || t.vice_captain_id === user.id) myTeams.add(t.id);
  const plannedCount = Number(planned);
  // The matches that "Plan several" just made go first under Upcoming, so the person sees them at once.
  const newest = new Set(plannedCount > 0
    ? all.filter((m) => ["draft", "scheduled", "postponed"].includes(m.status)).sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, plannedCount).map((m) => m.id)
    : []);
  const items = all.map((m) => toMatchItem(m, tz, { myTeams, summary: summaries.get(m.id) ?? NO_SUMMARY, isNew: newest.has(m.id) }));
  return (
    <Frame communityId={id} title="Matches">
      <div className="stack">
        {plannedCount > 0 && (
          <div className="banner green ml-banner" role="status">
            <IconCalendar size={20} />
            <span><b style={{ display: "block" }}>{plannedHeadline(plannedCount)}.</b> {PLANNED_EXPLAIN}</span>
          </div>
        )}
        <div className="two">
          <Link href={`/c/${id}/matches/new`} className="btn gold ml-act"><IconPlus /> New match</Link>
          <Link href={`/c/${id}/matches/several`} className="btn ghost ml-act"><IconCalendar /> Plan several</Link>
        </div>
        <QuickMatchLink communityId={id} />
        <CacheRoster communityId={id} me={user.id} members={roster.members} teams={roster.teams} />
        <MatchList communityId={id} items={items} deleted={!!deleted} initialQuery={q ?? ""} />
      </div>
    </Frame>
  );
}
