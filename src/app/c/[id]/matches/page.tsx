import type { Metadata } from "next";
import Frame from "@/components/Frame";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  return (
    <Frame communityId={id} title="Matches">
      <div className="card center muted">Matches, scheduling and live scoring arrive in the next build phases. Nothing is lost: they are all in the plan.</div>
    </Frame>
  );
}
