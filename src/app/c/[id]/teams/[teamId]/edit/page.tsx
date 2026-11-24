import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import TeamDangerZone from "@/components/TeamDangerZone";
import TeamEditor from "@/components/TeamEditor";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { getTeam, teamMatchCount } from "@/lib/teams";

export const metadata: Metadata = { title: "Edit team" };

export default async function EditTeamPage({ params }: { params: Promise<{ id: string; teamId: string }> }) {
  const { id, teamId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const team = await getTeam(id, teamId);
  if (!team) notFound();
  const [members, matchCount] = await Promise.all([listApprovedMembers(id), teamMatchCount(teamId)]);
  return (
    <Frame communityId={id} title="Edit team" back={`/c/${id}/teams/${teamId}`}>
      <TeamEditor
        mode="edit"
        communityId={id}
        teamId={teamId}
        members={members}
        team={team}
        aside={<TeamDangerZone communityId={id} teamId={teamId} name={team.name} matchCount={matchCount} />}
      />
    </Frame>
  );
}
