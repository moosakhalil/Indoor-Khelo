import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ActionMenu from "@/components/ActionMenu";
import Frame from "@/components/Frame";
import PfFilterBar, { PfFilterPanel, type PfFilterState } from "@/components/PfFilters";
import PfIcon from "@/components/PfIcons";
import { PfCareerStrip, PfInThisMatch, PfPlayerCard, PfStatsStart, STATS_START_TEXT } from "@/components/PfParts";
import PlayerStats, { PfHelp, STAT_TABS, type StatTab } from "@/components/PlayerStats";
import { careerOf } from "@/lib/career";
import { isUuid } from "@/lib/community";
import { requireMember } from "@/lib/community";
import { getPlayerInCommunity } from "@/lib/profile";
import { playerLines } from "@/lib/reports";
import { requireAcceptedUser } from "@/lib/session";
import { listSeries } from "@/lib/seriesDb";
import { listTeams, teamsOfPlayer } from "@/lib/teams";
import { BATTING_HANDS, BATTING_POSITIONS, BOWLING_STYLES, PLAYING_ROLES, labelOf } from "@/lib/validation";

export const metadata: Metadata = { title: "Player" };
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type Q = { match?: string; tab?: string; lines?: string; scope?: string; team?: string; from?: string; to?: string; series?: string };

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ id: string; userId: string }>; searchParams: Promise<Q> }) {
  const { id, userId } = await params;
  const q = await searchParams;
  const me = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, me.id);
  const p = await getPlayerInCommunity(id, userId);
  if (!p) notFound();
  const isMe = me.id === userId;
  const [teams, allTeams, allSeries, myTeams] = await Promise.all([
    teamsOfPlayer(id, userId), listTeams(id), listSeries(id), isMe ? Promise.resolve([]) : teamsOfPlayer(id, me.id),
  ]);

  // filters live in the address, so a stats page can be shared or reloaded exactly as it is
  const from = q.from && DATE.test(q.from) ? q.from : null;
  const to = q.to && DATE.test(q.to) ? q.to : null;
  const teamId = q.team && allTeams.some((t) => t.id === q.team) ? q.team : null;
  const allCommunities = q.scope === "all";
  const seriesId = q.series && allSeries.some((x) => x.id === q.series) ? q.series : null;
  const hasFilters = !!(from || to || teamId || allCommunities || seriesId);
  const lines = await playerLines(id, userId, { allCommunities, teamId, from, to, seriesId });
  const career = careerOf(lines);
  // opened from a scorecard: this match's figures come first
  const fromMatch = q.match && isUuid(q.match) ? (await playerLines(id, userId, {})).find((l) => l.matchId === q.match) ?? null : null;
  const tab: StatTab = STAT_TABS.some(([k]) => k === q.tab) ? (q.tab as StatTab) : "overview";
  const linesFilter = q.lines === "bat" || q.lines === "bowl" ? q.lines : "all";
  const keep = new URLSearchParams();
  if (allCommunities) keep.set("scope", "all");
  if (teamId) keep.set("team", teamId);
  if (seriesId) keep.set("series", seriesId);
  if (from) keep.set("from", from);
  if (to) keep.set("to", to);
  const base = `/c/${id}/players/${userId}${keep.toString() ? `?${keep.toString()}` : ""}`;
  const clearHref = `/c/${id}/players/${userId}?tab=${tab}`;
  const filterState: PfFilterState = { allCommunities, teamId, seriesId, from, to };
  const teamNames = allTeams.map((t) => ({ id: t.id, name: t.name }));
  const seriesNames = allSeries.map((x) => ({ id: x.id, name: x.name }));

  const role = labelOf(PLAYING_ROLES, p.playing_role);
  const isAdminViewing = membership.role === "admin" && !isMe;
  const manageHref = `/c/${id}/members/${userId}`;
  const mineIds = new Set(myTeams.map((t) => t.id));

  return (
    <Frame
      communityId={id}
      title={isMe ? "My stats" : p.name}
      subtitle={<small className="muted">{isMe ? "How other members see me" : community.name}</small>}
      back={`/c/${id}/members`}
      right={isAdminViewing ? <ActionMenu label="More about this member" items={[{ label: "Manage this member (Admin)", href: manageHref }]} /> : undefined}
      panel={<PfFilterPanel tab={tab} state={filterState} teams={teamNames} series={seriesNames} clearHref={clearHref} />}
    >
      <div className="stack">
        <PfPlayerCard
          communityId={id} name={p.name} number={p.player_number} isMe={isMe}
          subtitle={`${p.community_role === "admin" ? "Admin · " : ""}Number ${p.player_number}`}
          role={role} hand={labelOf(BATTING_HANDS, p.batting_hand)} position={labelOf(BATTING_POSITIONS, p.batting_position)} bowling={labelOf(BOWLING_STYLES, p.bowling_style)}
          teams={teams.map((t) => ({ ...t, mine: isMe || mineIds.has(t.id) }))}
          editHref={isMe ? `/c/${id}/profile/edit` : undefined}
        />
        {isAdminViewing && <Link href={manageHref} className="pf-manage"><PfIcon name="shield" size={18} />Manage this member (Admin)</Link>}

        {fromMatch && <PfInThisMatch communityId={id} line={fromMatch} />}
        {career.matches > 0 && <PfCareerStrip career={career} title={hasFilters ? "Career with these filters" : "Career in this community"} />}

        <PfFilterBar tab={tab} state={filterState} teams={teamNames} series={seriesNames} clearHref={clearHref} />

        {career.matches === 0 ? (
          <>
            <PfStatsStart
              title={hasFilters ? "No matches for these filters" : "Stats start here"}
              text={hasFilters ? "Try clearing a filter." : STATS_START_TEXT}
              action={hasFilters ? <Link href={clearHref} className="btn gold"><PfIcon name="x" size={18} />Clear filters</Link> : undefined}
            />
            <PfHelp />
          </>
        ) : (
          <PlayerStats c={career} lines={lines} tab={tab} base={base} linesFilter={linesFilter} communityId={id} analyticsHref={`/c/${id}/players/${userId}/analytics`} showSummary={false} />
        )}

        {isMe && <Link href={`/c/${id}/profile/edit`} className="btn gold">Edit my profile</Link>}
      </div>
    </Frame>
  );
}
