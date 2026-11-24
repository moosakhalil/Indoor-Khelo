import type { Metadata } from "next";
import Frame from "@/components/Frame";
import { BoardList, FilterSheet, type BoardItem } from "@/components/LeaderboardClient";
import { ActiveFilters, GroupTabs, OrderChip, Podium, RankCardView, RuleNote, StatChips } from "@/components/LeaderboardParts";
import { GROUPS, STATS, buildBoard, careerOf, fmt, type Career } from "@/lib/career";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { personLine, podiumOf, rangeLabel, rankCard } from "@/lib/ldView";
import { communityCareers } from "@/lib/reports";
import { requireAcceptedUser } from "@/lib/session";
import { listSeries } from "@/lib/seriesDb";
import { listTeams } from "@/lib/teams";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type Q = { group?: string; stat?: string; flip?: string; team?: string; from?: string; to?: string; series?: string };

// One leaderboard ranks every member by any stat. Nobody is hidden; rate stats need a minimum before a player is ranked.
export default async function LeaderboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Q> }) {
  const { id } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [teams, allSeries] = await Promise.all([listTeams(id), listSeries(id)]);
  const from = q.from && DATE.test(q.from) ? q.from : null;
  const to = q.to && DATE.test(q.to) ? q.to : null;
  const teamId = q.team && teams.some((t) => t.id === q.team) ? q.team : null;
  const seriesId = q.series && allSeries.some((x) => x.id === q.series) ? q.series : null;
  const def = STATS.find((s) => s.key === q.stat) ?? STATS.find((s) => s.group === (GROUPS.find((g) => g.key === q.group)?.key ?? "batting"))!;
  const group = def.group;
  const flip = q.flip === "1";

  const [members, careers] = await Promise.all([listApprovedMembers(id), communityCareers(id, { teamId, seriesId, from, to })]);
  const empty = careerOf([]);
  const rows = buildBoard(members.map((m) => ({ userId: m.user_id, name: m.name, number: m.player_number, career: (careers.get(m.user_id) ?? empty) as Career })), def, flip);
  const ranked = rows.filter((r) => r.ranked);
  const mine = rows.find((r) => r.userId === user.id);
  const noData = careers.size === 0;
  const filters = { team: teamId, series: seriesId, from, to };
  const valueOf = (r: { value: number | null }) => fmt(r.value, def);
  const roleOf = new Map(members.map((m) => [m.user_id, m.playing_role] as const));
  const items: BoardItem[] = rows.map((r) => ({
    userId: r.userId, name: r.name, number: r.number, line: personLine(r.number, roleOf.get(r.userId)), rank: r.rank, tied: r.tied, ranked: r.ranked, note: r.note, valueText: r.ranked ? valueOf(r) : "–",
  }));
  const card = rankCard(mine, ranked.length, def, mine ? valueOf(mine) : "–", (careers.get(user.id) ?? empty) as Career, !noData);
  const podium = podiumOf(rows, def, !noData);
  const seriesName = seriesId ? allSeries.find((x) => x.id === seriesId)?.name ?? null : null;
  const teamName = teamId ? teams.find((t) => t.id === teamId)?.name ?? null : null;
  const rangeText = from || to ? rangeLabel(from, to) : null;

  return (
    <Frame communityId={id} title="Leaderboard" back={`/c/${id}/teams`}>
      <div className="stack ld-page">
        <GroupTabs communityId={id} group={group} filters={filters} />
        <StatChips communityId={id} group={group} def={def} filters={filters} />
        <div className="ld-controls">
          <FilterSheet communityId={id} stat={def.key} flip={flip} series={allSeries.map((x) => ({ id: x.id, name: x.name }))} teams={teams.map((t) => ({ id: t.id, name: t.name }))} current={filters} />
          <OrderChip communityId={id} def={def} flip={flip} filters={filters} />
        </div>
        <ActiveFilters communityId={id} def={def} flip={flip} filters={filters} seriesName={seriesName} teamName={teamName} rangeText={rangeText} />

        <RankCardView card={card} def={def} number={mine?.number ?? null} name={mine?.name ?? ""} />
        <Podium rows={podium} def={def} valueOf={valueOf} communityId={id} />
        <RuleNote def={def} />
        {noData && (
          <div className="ld-note" role="note">
            <span>No finished matches yet. Everyone is listed, and the numbers fill in after the first match.</span>
          </div>
        )}

        <section className="card ld-board" aria-label={`${def.label} leaderboard`}>
          <div className="row space">
            <b>{def.label} leaderboard</b>
            {!noData && <span className="muted small">{ranked.length} ranked of {rows.length}</span>}
          </div>
          <BoardList communityId={id} rows={items} meId={user.id} hasData={!noData} label={`${def.label} leaderboard`} />
        </section>
      </div>
    </Frame>
  );
}
