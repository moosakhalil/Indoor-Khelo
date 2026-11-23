import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  return (
    <Frame communityId={id} title="Teams">
      <div className="stack">
        <Link href={`/c/${id}/members`} className="card row space">
          <span><b>Members</b><br /><small className="muted">Everyone in this community</small></span>
          <span aria-hidden="true">›</span>
        </Link>
        <div className="card center muted">Teams, squads and leaderboards arrive in the next build phases.</div>
      </div>
    </Frame>
  );
}
