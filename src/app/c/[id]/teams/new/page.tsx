import type { Metadata } from "next";
import Frame from "@/components/Frame";
import TeamEditor from "@/components/TeamEditor";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "New team" };

export default async function NewTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const members = await listApprovedMembers(id);
  return (
    <Frame communityId={id} title="New team" back={`/c/${id}/teams`}>
      <TeamEditor mode="create" communityId={id} members={members} />
    </Frame>
  );
}
