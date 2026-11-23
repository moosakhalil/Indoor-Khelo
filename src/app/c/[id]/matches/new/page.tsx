import type { Metadata } from "next";
import Frame from "@/components/Frame";
import { MatchForm } from "@/components/Forms4";
import { requireMember } from "@/lib/community";
import { teamNames } from "@/lib/matches";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "New match" };

export default async function NewMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const teams = Array.from((await teamNames(id)).entries()).map(([tid, name]) => ({ id: tid, name }));
  return (
    <Frame communityId={id} title="New match" back={`/c/${id}/matches`}>
      <MatchForm mode="create" communityId={id} teams={teams} />
    </Frame>
  );
}
