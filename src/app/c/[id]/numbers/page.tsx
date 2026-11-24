import type { Metadata } from "next";
import CnNumbers, { NumberMap } from "@/components/CnNumbers";
import Frame from "@/components/Frame";
import { listAllApprovedMembers } from "@/lib/b3Data";
import { requireAdmin } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";
import "@/components/cn.css";

export const metadata: Metadata = { title: "Player numbers" };

export default async function NumbersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community } = await requireAdmin(id, user.id);
  const members = await listAllApprovedMembers(id);
  const used = members.flatMap((m) => (m.player_number === null ? [] : [m.player_number]));
  return (
    <Frame
      communityId={id}
      title="Player numbers"
      back={`/c/${id}/community`}
      subtitle={<small className="muted">{used.length} of {COMMUNITY_MEMBER_CAP} numbers in use</small>}
      panel={<NumberMap used={used} />}
    >
      <CnNumbers
        communityId={id}
        communityName={community.name}
        members={members.map((m) => ({ user_id: m.user_id, name: m.name, player_number: m.player_number }))}
      />
    </Frame>
  );
}
