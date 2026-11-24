import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import { IconCross } from "@/components/B4Icons";
import MatchWizard from "@/components/MatchWizard";
import type { TeamOpt } from "@/components/MatchSetup";
import { requireMember } from "@/lib/community";
import { recentSetup } from "@/lib/crData";
import { requireAcceptedUser } from "@/lib/session";
import { listTeams, teamsOfPlayer } from "@/lib/teams";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "New match" };

// `?team=<teamId>` (the "New match" link on a Team page) puts that team in as Team 1.
export default async function NewMatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ team?: string }> }) {
  const { id } = await params;
  const { team } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const tz = await getZone();
  const [rows, mine, recent] = await Promise.all([listTeams(id), teamsOfPlayer(id, user.id), recentSetup(id, tz)]);
  const mineIds = new Set(mine.map((t) => t.id));
  const teams: TeamOpt[] = rows.map((t) => ({
    id: t.id, name: t.name, captain: t.captain_name, vice: t.vice_name, squad: t.squad_count,
    mine: mineIds.has(t.id) || t.captain_id === user.id || t.vice_captain_id === user.id,
  }));
  return (
    <Frame communityId={id} title="New match" back={`/c/${id}/matches`}
      right={<Link href={`/c/${id}/matches`} className="cr-x" aria-label="Close and go back to matches"><IconCross size={20} /></Link>}>
      <MatchWizard communityId={id} teams={teams} preselect={typeof team === "string" ? team : null} recentVenues={recent.venues} lastWhen={recent.lastWhen} />
    </Frame>
  );
}
