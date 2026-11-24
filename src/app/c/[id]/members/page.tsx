import type { Metadata } from "next";
import Link from "next/link";
import Ic from "@/components/B3Icons";
import Frame from "@/components/Frame";
import MembersList from "@/components/MembersList";
import { requireMember } from "@/lib/community";
import { listAllApprovedMembers } from "@/lib/b3Data";
import { requireAcceptedUser } from "@/lib/session";
import "@/components/b3.css";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const members = await listAllApprovedMembers(id);
  return (
    <Frame
      communityId={id}
      title="Members"
      back={`/c/${id}`}
      right={<Link href={`/c/${id}/invite`} className="mb-invite"><Ic name="userPlus" />Invite</Link>}
    >
      <MembersList members={members} meId={user.id} isAdmin={membership.role === "admin"} communityId={id} />
    </Frame>
  );
}
