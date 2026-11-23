import type { Metadata } from "next";
import Frame from "@/components/Frame";
import { SeveralForm } from "@/components/Forms4";
import { requireMember } from "@/lib/community";
import { teamNames } from "@/lib/matches";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Plan several matches" };

export default async function SeveralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const teams = Array.from((await teamNames(id)).entries()).map(([tid, name]) => ({ id: tid, name }));
  return (
    <Frame communityId={id} title="Plan several matches" back={`/c/${id}/matches`}>
      <SeveralForm communityId={id} teams={teams} />
    </Frame>
  );
}
