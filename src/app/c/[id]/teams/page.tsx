import type { Metadata } from "next";
import Frame from "@/components/Frame";
import TeamsList from "@/components/TeamsList";
import { requireMember } from "@/lib/community";
import { teamMatchCounts } from "@/lib/listB4";
import { teamTable } from "@/lib/reports";
import { requireAcceptedUser } from "@/lib/session";
import { listTeams, teamsOfPlayer } from "@/lib/teams";
import type { TableRow, TeamItem } from "@/lib/teamList";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const teams = await listTeams(id);
  const [records, counts, squads] = await Promise.all([
    teamTable(id, teams.map((t) => ({ id: t.id, name: t.name }))),
    teamMatchCounts(id),
    teamsOfPlayer(id, user.id),
  ]);
  const mine = new Set(squads.map((s) => s.id));
  for (const t of teams) if (t.captain_id === user.id || t.vice_captain_id === user.id) mine.add(t.id);
  const byId = new Map(records.map((r) => [r.id, r]));
  const items: TeamItem[] = teams.map((t) => {
    const r = byId.get(t.id);
    return {
      id: t.id, name: t.name, captain: t.captain_name, vice: t.vice_name, squad: t.squad_count, mine: mine.has(t.id),
      matches: counts.get(t.id) ?? 0,
      played: r?.played ?? 0, won: r?.won ?? 0, lost: r?.lost ?? 0, tied: r?.tied ?? 0,
      form: (r?.history ?? []).slice(-5).map((h) => ({ result: h.result, opponent: h.opponent })),
    };
  });
  // The table is the records in their ranked order (wins, then win percentage, then runs). A team that has not played is not in it.
  const table: TableRow[] = records.filter((r) => r.played > 0).map((r, i) => ({
    id: r.id, name: r.name, rank: i + 1, played: r.played, won: r.won, lost: r.lost, tied: r.tied, winPercent: r.winPercent, totalRuns: r.totalRuns, mine: mine.has(r.id),
  }));
  return (
    <Frame communityId={id} title="Teams">
      <TeamsList communityId={id} teams={items} table={table} />
    </Frame>
  );
}
