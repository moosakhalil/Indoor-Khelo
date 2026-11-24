import type { Metadata } from "next";
import { LeaveCard, OnlyAdminCard } from "@/components/CnLeave";
import Frame from "@/components/Frame";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import "@/components/cn.css";

export const metadata: Metadata = { title: "Leave community" };

export default async function LeavePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string }> }) {
  const { id } = await params;
  const { blocked } = await searchParams;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const members = await listApprovedMembers(id);
  const otherAdmins = members.filter((m) => m.role === "admin" && m.user_id !== user.id);
  const onlyAdmin = membership.role === "admin" && otherAdmins.length === 0;
  const candidates = members.filter((m) => m.user_id !== user.id);

  return (
    <Frame communityId={id} title="Leave community" back={`/c/${id}/community`}>
      {onlyAdmin ? (
        <OnlyAdminCard
          communityId={id}
          communityName={community.name}
          candidates={candidates.map((m) => ({ user_id: m.user_id, name: m.name, player_number: m.player_number }))}
        />
      ) : (
        <LeaveCard
          communityId={id}
          communityName={community.name}
          role={membership.role}
          number={membership.player_number}
          justUnblocked={!!blocked}
        />
      )}
    </Frame>
  );
}
