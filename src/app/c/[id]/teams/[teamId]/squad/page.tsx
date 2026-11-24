import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import SquadEditor from "@/components/SquadEditor";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { getTeam, listSquad } from "@/lib/teams";

export const metadata: Metadata = { title: "Edit squad" };

// The permanent squad. Ticking people works without any script too: the form posts one "member" per ticked person.
export default async function SquadPage({ params, searchParams }: { params: Promise<{ id: string; teamId: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id, teamId } = await params;
  const { new: isNew } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const team = await getTeam(id, teamId);
  if (!team) notFound();
  const [members, squad] = await Promise.all([listApprovedMembers(id), listSquad(teamId)]);
  return (
    <Frame communityId={id} title={`${team.name} squad`} back={isNew ? undefined : `/c/${id}/teams/${teamId}`}>
      <SquadEditor
        communityId={id}
        teamId={teamId}
        teamName={team.name}
        captainId={team.captain_id}
        viceId={team.vice_captain_id}
        members={members.map((m) => ({ user_id: m.user_id, name: m.name, player_number: m.player_number, playing_role: m.playing_role }))}
        initial={squad.map((s) => s.user_id)}
        me={user.id}
        isNew={!!isNew}
        cancelHref={`/c/${id}/teams/${teamId}`}
      />
    </Frame>
  );
}
