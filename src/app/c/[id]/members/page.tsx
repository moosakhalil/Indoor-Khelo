import type { Metadata } from "next";
import Frame from "@/components/Frame";
import MembersList from "@/components/MembersList";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const members = await listApprovedMembers(id);
  return (
    <Frame communityId={id} title="Members" back={`/c/${id}`} right={<span className="muted">{members.length} of {COMMUNITY_MEMBER_CAP}</span>}>
      <MembersList members={members} meId={user.id} isAdmin={membership.role === "admin"} communityId={id} />
    </Frame>
  );
}
