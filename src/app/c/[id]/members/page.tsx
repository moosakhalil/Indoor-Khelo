import type { Metadata } from "next";
import Shirt from "@/components/Shirt";
import Frame from "@/components/Frame";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const members = await listApprovedMembers(id);
  return (
    <Frame communityId={id} title="Members" back={`/c/${id}`} right={<span className="muted">{members.length} of {COMMUNITY_MEMBER_CAP}</span>}>
      <section className="card list">
        {members.map((m) => (
          <div key={m.user_id} className="item">
            <Shirt number={m.player_number} />
            <span className="t grow"><b>{m.name}{m.user_id === user.id ? " (you)" : ""}</b>{m.role === "admin" && <small>Admin</small>}</span>
          </div>
        ))}
      </section>
    </Frame>
  );
}
